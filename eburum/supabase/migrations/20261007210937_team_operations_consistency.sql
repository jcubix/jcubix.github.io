-- Keep activity, roster and private technical notes in one transaction.
drop function public.save_team_activity(jsonb,jsonb,uuid,integer);
create function public.save_team_activity(p_activity jsonb,p_roster jsonb,p_id uuid default null,p_revision integer default null,p_technical jsonb default null)
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
 if (select count(*) from public.activity_roster where activity_id=a.id and lineup='Titolare')>11 then raise exception 'Una formazione può avere al massimo 11 titolari' using errcode='22023';end if;
 if a.activity_type<>'Partita' and exists(select 1 from public.activity_roster where activity_id=a.id and (minutes_played>0 or lineup<>'Non impiegato')) then raise exception 'L’impiego è disponibile soltanto per le partite' using errcode='22023';end if;
 if p_technical is not null then
  if jsonb_typeof(p_technical) is distinct from 'object' then raise exception 'Note tecniche non valide' using errcode='22023';end if;
  insert into public.activity_technical(user_id,activity_id,formation,note) values(uid,a.id,nullif(p_technical->>'formation',''),nullif(p_technical->>'note',''))
  on conflict(activity_id) do update set formation=excluded.formation,note=excluded.note;
 end if;
 select * into a from public.activities where id=a.id;return to_jsonb(a);
end $$;

revoke all on function public.save_team_activity(jsonb,jsonb,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_team_activity(jsonb,jsonb,uuid,integer,jsonb) to authenticated;
create index activities_user_id_match_id_idx on public.activities(user_id,match_id);
create index activities_user_id_session_id_idx on public.activities(user_id,session_id);
create index activity_roster_user_id_activity_id_idx on public.activity_roster(user_id,activity_id);
create index activity_roster_user_id_player_id_idx on public.activity_roster(user_id,player_id);
create index activity_technical_user_id_activity_id_idx on public.activity_technical(user_id,activity_id);
create index player_administration_user_id_player_id_idx on public.player_administration(user_id,player_id);
create index match_events_user_id_match_id_idx on public.match_events(user_id,match_id);
create index match_events_user_id_player_id_idx on public.match_events(user_id,player_id);
create index match_events_user_id_outgoing_player_id_idx on public.match_events(user_id,outgoing_player_id);
notify pgrst,'reload schema';
