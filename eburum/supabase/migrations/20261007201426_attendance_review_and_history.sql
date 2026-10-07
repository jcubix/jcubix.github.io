-- Atomic attendance saves, optimistic concurrency and server-authored history.
alter table public.sessions
  add column revision integer not null default 0,
  add column updated_at timestamptz,
  add column updated_by uuid references auth.users(id) on delete set null,
  add column save_request_id uuid;
create unique index sessions_save_request_unique on public.sessions(user_id,save_request_id) where save_request_id is not null;
alter table public.attendance
  add column updated_at timestamptz,
  add column updated_by uuid references auth.users(id) on delete set null;

create table public.attendance_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default clock_timestamp(),
  entity text not null check(entity in ('session','attendance')),
  action text not null check(action in ('INSERT','UPDATE','DELETE')),
  before_data jsonb,
  after_data jsonb
);
alter table public.attendance_history enable row level security;
revoke all on public.attendance_history from public,anon,authenticated;
grant select on public.attendance_history to authenticated;
create policy attendance_history_select on public.attendance_history for select to authenticated using ((select auth.uid())=user_id);
create index attendance_history_session_time on public.attendance_history(user_id,session_id,changed_at desc,id);

create or replace function private_access.stamp_attendance_changes()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if tg_op='UPDATE' and new.user_id<>old.user_id then
    raise exception 'Il proprietario non può essere modificato' using errcode='42501';
  end if;
  if tg_table_name='sessions' then
    if tg_op='INSERT' then
      new.revision:=0;
    else
      new.save_request_id:=old.save_request_id;
      if (new.session_date,new.session_type,new.note,new.revision) is not distinct from
         (old.session_date,old.session_type,old.note,old.revision) then
        new.updated_at:=old.updated_at; new.updated_by:=old.updated_by; return new;
      end if;
      new.revision:=old.revision+1;
    end if;
  else
    if tg_op='UPDATE' and (new.session_id,new.player_id) is distinct from (old.session_id,old.player_id) then
      raise exception 'Sessione e giocatore non possono essere riassegnati' using errcode='42501';
    end if;
    if not exists(select 1 from public.sessions where id=new.session_id and user_id=new.user_id)
       or not exists(select 1 from public.players where id=new.player_id and user_id=new.user_id) then
      raise exception 'Sessione o giocatore non disponibile' using errcode='42501';
    end if;
    if tg_op='UPDATE' and (new.status,new.delay_minutes,new.notified,new.note) is not distinct from
       (old.status,old.delay_minutes,old.notified,old.note) then
      new.updated_at:=old.updated_at; new.updated_by:=old.updated_by; return new;
    end if;
  end if;
  new.updated_at:=clock_timestamp(); new.updated_by:=auth.uid(); return new;
end;
$$;
revoke all on function private_access.stamp_attendance_changes() from public,anon,authenticated;

create or replace function private_access.record_attendance_changes()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  previous jsonb; current_data jsonb; owner_id uuid; activity_id uuid; person_id uuid;
begin
  owner_id:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  if auth.uid() is not null and auth.uid()<>owner_id then
    raise exception 'Accesso non consentito' using errcode='42501';
  end if;
  if tg_table_name='sessions' then
    activity_id:=new.id;
    if tg_op='UPDATE' then previous:=jsonb_build_object('session_date',old.session_date,'session_type',old.session_type,'note',old.note); end if;
    current_data:=jsonb_build_object('session_date',new.session_date,'session_type',new.session_type,'note',new.note);
  else
    activity_id:=case when tg_op='DELETE' then old.session_id else new.session_id end;
    person_id:=case when tg_op='DELETE' then old.player_id else new.player_id end;
    if tg_op<>'INSERT' then previous:=jsonb_build_object('status',old.status,'delay_minutes',old.delay_minutes,'notified',old.notified,'note',old.note); end if;
    if tg_op<>'DELETE' then current_data:=jsonb_build_object('status',new.status,'delay_minutes',new.delay_minutes,'notified',new.notified,'note',new.note); end if;
  end if;
  if previous is not distinct from current_data then return null; end if;
  -- A cascading delete of a session intentionally removes its related history.
  if not exists(select 1 from public.sessions where id=activity_id and user_id=owner_id) then return null; end if;
  insert into public.attendance_history(user_id,session_id,player_id,actor_id,entity,action,before_data,after_data)
  values(owner_id,activity_id,person_id,auth.uid(),case when tg_table_name='sessions' then 'session' else 'attendance' end,tg_op,previous,current_data);
  if tg_table_name='attendance' then
    update public.sessions set revision=revision+1 where id=activity_id and user_id=owner_id;
  end if;
  return null;
end;
$$;
revoke all on function private_access.record_attendance_changes() from public,anon,authenticated;

create trigger stamp_session_change before insert or update on public.sessions for each row execute function private_access.stamp_attendance_changes();
create trigger stamp_attendance_change before insert or update on public.attendance for each row execute function private_access.stamp_attendance_changes();
create trigger record_session_change after insert or update on public.sessions for each row execute function private_access.record_attendance_changes();
create trigger record_attendance_change after insert or update or delete on public.attendance for each row execute function private_access.record_attendance_changes();

create or replace function public.save_attendance_session(
  p_session jsonb, p_attendance jsonb, p_session_id uuid default null,
  p_expected_revision integer default null, p_request_id uuid default null
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
  uid uuid:=auth.uid(); activity public.sessions%rowtype; entry record;
  total integer; distinct_players integer; expected_total integer;
begin
  if uid is null then raise exception 'Accedi per salvare' using errcode='42501'; end if;
  if jsonb_typeof(p_session) is distinct from 'object' or jsonb_typeof(p_attendance) is distinct from 'array' then
    raise exception 'Dati della sessione non validi' using errcode='22023';
  end if;
  if coalesce(p_session->>'session_date','')='' or coalesce(p_session->>'session_type','') not in ('Allenamento','Partita','Riunione')
     or length(coalesce(p_session->>'note',''))>10000 then
    raise exception 'Controlla data, tipo e nota della sessione' using errcode='22023';
  end if;
  if p_session_id is null then
    if p_request_id is null then raise exception 'Identificativo del salvataggio mancante' using errcode='22023'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text||p_request_id::text,0));
    select * into activity from public.sessions where user_id=uid and save_request_id=p_request_id for update;
    if found then return jsonb_build_object('session',to_jsonb(activity),'replayed',true); end if;
  else
    select * into activity from public.sessions where id=p_session_id and user_id=uid for update;
    if not found then raise exception 'Sessione non disponibile' using errcode='42501'; end if;
    if p_expected_revision is null or activity.revision<>p_expected_revision then
      raise exception 'La sessione è stata modificata nel frattempo. Riaprila dal Registro prima di salvare.' using errcode='40001';
    end if;
  end if;
  select count(*),count(distinct player_id) into total,distinct_players
  from jsonb_to_recordset(p_attendance) as x(player_id uuid,status text,delay_minutes integer,notified boolean,note text);
  if total=0 or total<>distinct_players then raise exception 'Lista giocatori vuota o duplicata' using errcode='22023'; end if;
  for entry in select * from jsonb_to_recordset(p_attendance) as x(player_id uuid,status text,delay_minutes integer,notified boolean,note text)
  loop
    if entry.status is null or entry.status not in ('Presente','Assente','Infortunato') or entry.delay_minutes is null or entry.delay_minutes<0 or length(coalesce(entry.note,''))>10000 then
      raise exception 'Controlla stato, ritardo e note dei giocatori' using errcode='22023';
    end if;
    if not exists(select 1 from public.players where id=entry.player_id and user_id=uid and (p_session_id is not null or active)) then
      raise exception 'La rosa è cambiata. Ricarica la sessione.' using errcode='22023';
    end if;
    if p_session_id is not null and not exists(select 1 from public.attendance where session_id=p_session_id and player_id=entry.player_id and user_id=uid) then
      raise exception 'Il giocatore non appartiene alla sessione storica' using errcode='22023';
    end if;
  end loop;
  if p_session_id is null then
    select count(*) into expected_total from public.players where user_id=uid and active;
  else
    select count(*) into expected_total from public.attendance where user_id=uid and session_id=p_session_id;
  end if;
  if total<>expected_total then raise exception 'La lista delle presenze è cambiata. Riapri la sessione.' using errcode='22023'; end if;
  if p_session_id is null then
    insert into public.sessions(user_id,session_date,session_type,note,save_request_id)
    values(uid,(p_session->>'session_date')::date,p_session->>'session_type',nullif(btrim(p_session->>'note'),''),p_request_id) returning * into activity;
    insert into public.attendance(user_id,session_id,player_id,status,delay_minutes,notified,note)
    select uid,activity.id,player_id,status,delay_minutes,notified,nullif(btrim(note),'')
    from jsonb_to_recordset(p_attendance) as x(player_id uuid,status text,delay_minutes integer,notified boolean,note text);
  else
    update public.sessions set session_date=(p_session->>'session_date')::date,session_type=p_session->>'session_type',note=nullif(btrim(p_session->>'note'),'') where id=activity.id and user_id=uid;
    update public.attendance a set status=x.status,delay_minutes=x.delay_minutes,notified=x.notified,note=nullif(btrim(x.note),'')
    from jsonb_to_recordset(p_attendance) as x(player_id uuid,status text,delay_minutes integer,notified boolean,note text)
    where a.session_id=activity.id and a.user_id=uid and a.player_id=x.player_id
      and (a.status,a.delay_minutes,a.notified,a.note) is distinct from (x.status,x.delay_minutes,x.notified,nullif(btrim(x.note),''));
  end if;
  select * into activity from public.sessions where id=activity.id and user_id=uid;
  return jsonb_build_object('session',to_jsonb(activity),'replayed',false);
end;
$$;
revoke all on function public.save_attendance_session(jsonb,jsonb,uuid,integer,uuid) from public,anon;
grant execute on function public.save_attendance_session(jsonb,jsonb,uuid,integer,uuid) to authenticated;
