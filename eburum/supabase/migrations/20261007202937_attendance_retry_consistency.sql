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
