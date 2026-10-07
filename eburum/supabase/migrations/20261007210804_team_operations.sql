-- Keep existing owner keys; membership determines shared-team access.
create table public.team_members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','manager','coach')),
 display_name text not null default '',
 created_at timestamptz not null default now()
);
create index team_members_owner_idx on public.team_members(owner_id);
alter table public.team_members enable row level security;
revoke all on public.team_members from public,anon,authenticated;
grant select on public.team_members to authenticated;
grant all on public.team_members to service_role;
insert into public.team_members(user_id,owner_id,role,display_name)
 select id,id,case when raw_app_meta_data->>'role'='admin' then 'admin' else 'manager' end,coalesce(email,'') from auth.users;
create function private_access.team_owner() returns uuid language sql stable security definer set search_path='' as $$select owner_id from public.team_members where user_id=auth.uid()$$;
create function private_access.team_role() returns text language sql stable security definer set search_path='' as $$select role from public.team_members where user_id=auth.uid()$$;
revoke all on function private_access.team_owner(),private_access.team_role() from public,anon;
grant usage on schema private_access to authenticated;
grant execute on function private_access.team_owner(),private_access.team_role() to authenticated;
create policy team_members_read on public.team_members for select to authenticated using(user_id=(select auth.uid()) or (owner_id=(select private_access.team_owner()) and (select private_access.team_role())='admin'));
create function public.team_context() returns jsonb language sql stable security invoker set search_path='' as $$select jsonb_build_object('owner_id',owner_id,'role',role,'name','Eburum') from public.team_members where user_id=auth.uid()$$;
revoke all on function public.team_context() from public,anon;
grant execute on function public.team_context() to authenticated;
create function private_access.assign_team_member() returns trigger language plpgsql security definer set search_path='' as $$
declare creator public.team_members%rowtype; assigned_role text;begin
 if new.raw_app_meta_data->>'created_by' is not null then
  select * into creator from public.team_members where user_id=(new.raw_app_meta_data->>'created_by')::uuid and role='admin';
  if not found then raise exception 'Amministratore della squadra non valido' using errcode='42501';end if;
  assigned_role:=coalesce(new.raw_app_meta_data->>'team_role','manager');
  if assigned_role not in ('admin','manager','coach') then raise exception 'Ruolo non valido' using errcode='22023';end if;
  insert into public.team_members(user_id,owner_id,role,display_name) values(new.id,creator.owner_id,assigned_role,coalesce(new.email,''));
 else
  insert into public.team_members(user_id,owner_id,role,display_name) values(new.id,new.id,'manager',coalesce(new.email,''));
 end if;return null;end $$;
revoke all on function private_access.assign_team_member() from public,anon,authenticated;
create trigger assign_team_member after insert on auth.users for each row execute function private_access.assign_team_member();

do $$declare t text; p record; write_rule text; begin
 foreach t in array array['players','sessions','attendance','matches','match_events','attendance_history'] loop
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
  execute format('create policy %I on public.%I for select to authenticated using(user_id=(select private_access.team_owner()))',t||'_read',t);
  if t='attendance_history' then continue; end if;
  write_rule:='user_id=(select private_access.team_owner())';
  if t='players' then write_rule:=write_rule||' and (select private_access.team_role()) in (''admin'',''manager'')'; end if;
  execute format('create policy %I on public.%I for insert to authenticated with check(%s)',t||'_create',t,write_rule);
  execute format('create policy %I on public.%I for update to authenticated using(%s) with check(%s)',t||'_edit',t,write_rule,write_rule);
  execute format('create policy %I on public.%I for delete to authenticated using(%s and (select private_access.team_role())=''admin'')',t||'_delete',t,write_rule);
 end loop;
end $$;

alter table public.players add column secondary_role text;
create unique index players_owner_id_unique on public.players(user_id,id);
create unique index matches_owner_id_unique on public.matches(user_id,id);
create unique index sessions_owner_id_unique on public.sessions(user_id,id);
create table public.activities(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 activity_date date not null,activity_type text not null check(activity_type in ('Allenamento','Partita','Riunione')),
 title text not null check(length(title) between 1 and 160),start_time time,end_time time,meeting_time time,location text check(length(location)<=500),meeting_place text check(length(meeting_place)<=500),
 status text not null default 'Programmato' check(status in ('Programmato','Concluso','Annullato')),
 organization_note text check(length(organization_note)<=10000),
 match_id uuid unique,session_id uuid unique,revision integer not null default 0,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null,
 unique(user_id,id),foreign key(user_id,match_id) references public.matches(user_id,id) on delete cascade,
 foreign key(user_id,session_id) references public.sessions(user_id,id) on delete cascade,
 check(end_time is null or start_time is null or end_time>start_time)
);
alter table public.activities add column request_id uuid;
create unique index activities_request_unique on public.activities(user_id,request_id) where request_id is not null;
create index activities_owner_date_idx on public.activities(user_id,activity_date);
create index activities_actor_idx on public.activities(updated_by);
create table public.activity_roster(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 activity_id uuid not null,player_id uuid not null,called boolean not null default false,
 availability text not null default 'In attesa' check(availability in ('In attesa','Disponibile','Indisponibile')),
 response_note text check(length(response_note)<=2000),lineup text not null default 'Non impiegato' check(lineup in ('Non impiegato','Titolare','Panchina')),
 position text check(length(position)<=50),minutes_played integer not null default 0 check(minutes_played between 0 and 130),
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null,
 unique(activity_id,player_id),foreign key(user_id,activity_id) references public.activities(user_id,id) on delete cascade,
 foreign key(user_id,player_id) references public.players(user_id,id) on delete cascade,
 check(called or (lineup='Non impiegato' and minutes_played=0))
);
create index activity_roster_owner_idx on public.activity_roster(user_id);
create index activity_roster_player_idx on public.activity_roster(player_id);
create index activity_roster_actor_idx on public.activity_roster(updated_by);
create table public.player_administration(
 player_id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 registration_status text not null default 'Da verificare' check(registration_status in ('Da verificare','In regola','Da completare')),
 certificate_until date,document_until date,emergency_contact text check(length(emergency_contact)<=300),
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null,
 foreign key(user_id,player_id) references public.players(user_id,id) on delete cascade
);
create index player_administration_owner_idx on public.player_administration(user_id);
create index player_administration_actor_idx on public.player_administration(updated_by);
create table public.activity_technical(
 activity_id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 formation text check(length(formation)<=30),note text check(length(note)<=10000),updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null,
 foreign key(user_id,activity_id) references public.activities(user_id,id) on delete cascade
);
create index activity_technical_owner_idx on public.activity_technical(user_id);
create index activity_technical_actor_idx on public.activity_technical(updated_by);
alter table public.match_events add column outgoing_player_id uuid references public.players(id) on delete set null;
create index match_events_outgoing_idx on public.match_events(outgoing_player_id);
alter table public.match_events add constraint match_events_team_match_fk foreign key(user_id,match_id) references public.matches(user_id,id) on delete cascade;
alter table public.match_events add constraint match_events_team_player_fk foreign key(user_id,player_id) references public.players(user_id,id);
alter table public.match_events add constraint match_events_team_outgoing_fk foreign key(user_id,outgoing_player_id) references public.players(user_id,id);
alter table public.match_events add constraint different_substitution_players check(outgoing_player_id is null or (event_type='Sostituzione' and player_id is not null and outgoing_player_id<>player_id));
do $$declare t text; rule text;begin
 foreach t in array array['activities','activity_roster','player_administration','activity_technical'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  rule:='user_id=(select private_access.team_owner())';
  if t='player_administration' then rule:=rule||' and (select private_access.team_role()) in (''admin'',''manager'')';end if;
  if t='activity_technical' then rule:=rule||' and (select private_access.team_role()) in (''admin'',''coach'')';end if;
  execute format('create policy %I on public.%I for select to authenticated using(%s)',t||'_read',t,rule);
  execute format('create policy %I on public.%I for insert to authenticated with check(%s)',t||'_create',t,rule);
  execute format('create policy %I on public.%I for update to authenticated using(%s) with check(%s)',t||'_edit',t,rule,rule);
 end loop;
end $$;
create function private_access.stamp_operations() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Squadra immutabile' using errcode='42501';end if;
 if tg_table_name='activities' then
  if tg_op='UPDATE' then
   if new.match_id is distinct from old.match_id then raise exception 'Collegamenti attività immutabili' using errcode='42501';end if;
   if new.activity_type is distinct from old.activity_type and not exists(select 1 from public.sessions where id=new.session_id and user_id=new.user_id and session_type=new.activity_type) then raise exception 'Tipo attività immutabile' using errcode='42501';end if;
   if new.session_id is distinct from old.session_id and (old.session_id is not null or not exists(select 1 from public.sessions where id=new.session_id and user_id=new.user_id and session_date=new.activity_date and session_type=new.activity_type)) then raise exception 'Sessione non coerente' using errcode='42501';end if;
   new.request_id:=coalesce(old.request_id,new.request_id);new.revision:=old.revision+1;
  else new.revision:=0;end if;
 elsif tg_op='UPDATE' then
  if tg_table_name='activity_roster' and (new.activity_id,new.player_id) is distinct from (old.activity_id,old.player_id) then raise exception 'Partecipante immutabile' using errcode='42501';end if;
  if tg_table_name='player_administration' and new.player_id<>old.player_id then raise exception 'Giocatore immutabile' using errcode='42501';end if;
  if tg_table_name='activity_technical' and new.activity_id<>old.activity_id then raise exception 'Attività immutabile' using errcode='42501';end if;
 end if;
 new.updated_at:=clock_timestamp();new.updated_by:=auth.uid();return new;
end $$;
revoke all on function private_access.stamp_operations() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['activities','activity_roster','player_administration','activity_technical'] loop execute format('create trigger stamp_operations before insert or update on public.%I for each row execute function private_access.stamp_operations()',t);end loop;end $$;
insert into public.activities(user_id,activity_date,activity_type,title,status,session_id)
 select user_id,session_date,session_type,session_type,'Concluso',id from public.sessions;
insert into public.activities(user_id,activity_date,activity_type,title,organization_note,match_id)
 select user_id,match_date,'Partita',opponent,note,id from public.matches;

create function private_access.sync_calendar() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null and new.user_id is distinct from private_access.team_owner() then raise exception 'Squadra non consentita' using errcode='42501';end if;
 if tg_table_name='matches' then
  insert into public.activities(user_id,activity_date,activity_type,title,organization_note,match_id)
   values(new.user_id,new.match_date,'Partita',new.opponent,new.note,new.id)
   on conflict(match_id) do update set activity_date=excluded.activity_date,title=excluded.title;
 else
  if not exists(select 1 from public.activities where session_id=new.id) then
   update public.activities set session_id=new.id,status='Concluso' where id=(select id from public.activities where user_id=new.user_id and activity_date=new.session_date and activity_type=new.session_type and session_id is null and status='Programmato' order by start_time nulls last,id limit 1);
  end if;
  insert into public.activities(user_id,activity_date,activity_type,title,status,session_id)
   values(new.user_id,new.session_date,new.session_type,new.session_type,'Concluso',new.id)
   on conflict(session_id) do update set activity_date=excluded.activity_date,activity_type=excluded.activity_type,status='Concluso';
 end if;return null;
end $$;
revoke all on function private_access.sync_calendar() from public,anon,authenticated;
create trigger sync_match_calendar after insert or update of match_date,opponent on public.matches for each row execute function private_access.sync_calendar();
create trigger sync_session_calendar after insert or update of session_date,session_type on public.sessions for each row execute function private_access.sync_calendar();

create function public.save_team_activity(p_activity jsonb,p_roster jsonb,p_id uuid default null,p_revision integer default null)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=private_access.team_owner(); a public.activities%rowtype; mid uuid; n integer;begin
 if uid is null then raise exception 'Accedi alla squadra' using errcode='42501';end if;
 if jsonb_typeof(p_activity) is distinct from 'object' or jsonb_typeof(p_roster) is distinct from 'array' then raise exception 'Dati non validi' using errcode='22023';end if;
 if p_id is null and p_activity->>'request_id' is not null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text||(p_activity->>'request_id'),0));
  if exists(select 1 from public.activities where user_id=uid and request_id=(p_activity->>'request_id')::uuid) then raise exception 'Attività già creata. Riaprila dall’Agenda.' using errcode='40001';end if;
 end if;
 if p_id is not null then
  select * into a from public.activities where id=p_id and user_id=uid for update;
  if not found then raise exception 'Attività non disponibile' using errcode='42501';end if;
  if a.revision is distinct from p_revision then raise exception 'Attività modificata nel frattempo. Riaprila.' using errcode='40001';end if;
  if a.activity_type is distinct from p_activity->>'activity_type' then raise exception 'Tipo attività immutabile' using errcode='22023';end if;
  if a.session_id is not null and a.activity_date is distinct from (p_activity->>'activity_date')::date then raise exception 'Correggi la data della sessione dal Registro' using errcode='22023';end if;
 else
  if p_activity->>'activity_type'='Partita' then
   insert into public.matches(user_id,match_date,opponent) values(uid,(p_activity->>'activity_date')::date,p_activity->>'title') returning id into mid;
   select * into a from public.activities where match_id=mid;
  else
   insert into public.activities(user_id,activity_date,activity_type,title,request_id) values(uid,(p_activity->>'activity_date')::date,p_activity->>'activity_type',p_activity->>'title',(p_activity->>'request_id')::uuid) returning * into a;
  end if;
 end if;
 update public.activities set title=p_activity->>'title',activity_date=(p_activity->>'activity_date')::date,request_id=coalesce(a.request_id,(p_activity->>'request_id')::uuid),
 start_time=nullif(p_activity->>'start_time','')::time,end_time=nullif(p_activity->>'end_time','')::time,
 meeting_time=nullif(p_activity->>'meeting_time','')::time,location=nullif(p_activity->>'location',''),meeting_place=nullif(p_activity->>'meeting_place',''),
 status=p_activity->>'status',organization_note=nullif(p_activity->>'organization_note','') where id=a.id and user_id=uid;
 if a.match_id is not null then update public.matches set match_date=(p_activity->>'activity_date')::date,opponent=p_activity->>'title' where id=a.match_id and user_id=uid;end if;
 if exists(select 1 from jsonb_to_recordset(p_roster) as r(player_id uuid) where not exists(select 1 from public.players where id=r.player_id and user_id=uid)) then raise exception 'Giocatore di un’altra squadra' using errcode='42501';end if;
 if (select count(*) from jsonb_to_recordset(p_roster) as r(player_id uuid))<>(select count(distinct player_id) from jsonb_to_recordset(p_roster) as r(player_id uuid)) then raise exception 'Partecipanti duplicati' using errcode='22023';end if;
 insert into public.activity_roster(user_id,activity_id,player_id,called,availability,response_note,lineup,position,minutes_played)
 select uid,a.id,player_id,called,availability,nullif(response_note,''),lineup,nullif(position,''),minutes_played
 from jsonb_to_recordset(p_roster) as r(player_id uuid,called boolean,availability text,response_note text,lineup text,position text,minutes_played integer)
 on conflict(activity_id,player_id) do update set called=excluded.called,availability=excluded.availability,response_note=excluded.response_note,lineup=excluded.lineup,position=excluded.position,minutes_played=excluded.minutes_played;
 select * into a from public.activities where id=a.id;return to_jsonb(a);
end $$;
revoke all on function public.save_team_activity(jsonb,jsonb,uuid,integer) from public,anon;
grant execute on function public.save_team_activity(jsonb,jsonb,uuid,integer) to authenticated;

create or replace function private_access.record_attendance_changes()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  previous jsonb; current_data jsonb; owner_id uuid; activity_id uuid; person_id uuid;
begin
  owner_id:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  if auth.uid() is not null and private_access.team_owner() is distinct from owner_id then
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


create or replace function public.save_attendance_session(
  p_session jsonb, p_attendance jsonb, p_session_id uuid default null,
  p_expected_revision integer default null, p_request_id uuid default null
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
  uid uuid:=private_access.team_owner(); activity public.sessions%rowtype; entry record;
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
    if found then
      -- Retrying an identical request is safe; editing an ambiguous request must not silently discard changes.
      if (activity.session_date,activity.session_type,activity.note) is distinct from
         ((p_session->>'session_date')::date,p_session->>'session_type',nullif(btrim(p_session->>'note'),''))
         or (select count(*) from public.attendance where session_id=activity.id and user_id=uid)<>jsonb_array_length(p_attendance)
         or exists(
           select player_id,status,delay_minutes,notified,nullif(btrim(note),'')
           from jsonb_to_recordset(p_attendance) as x(player_id uuid,status text,delay_minutes integer,notified boolean,note text)
           except
           select player_id,status,delay_minutes,notified,note from public.attendance where session_id=activity.id and user_id=uid
         ) then
        raise exception 'Questa richiesta è già stata salvata. Apri la sessione dal Registro per correggerla.' using errcode='40001';
      end if;
      return jsonb_build_object('session',to_jsonb(activity),'replayed',true);
    end if;
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

create function private_access.bump_roster_revision() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null and new.user_id is distinct from private_access.team_owner() then raise exception 'Squadra non consentita' using errcode='42501';end if;
 update public.activities set revision=revision+1 where id=new.activity_id and user_id=new.user_id;return null;end $$;
revoke all on function private_access.bump_roster_revision() from public,anon,authenticated;
create trigger bump_roster_revision after insert or update on public.activity_roster for each row execute function private_access.bump_roster_revision();
notify pgrst,'reload schema';
