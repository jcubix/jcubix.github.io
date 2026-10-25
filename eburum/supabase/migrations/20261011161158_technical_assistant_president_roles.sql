-- Extend authoritative membership, preserving existing users and sporting history.
alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check check(role in ('admin','manager','coach','secretary','technical_assistant','president'));
CREATE OR REPLACE FUNCTION private_access.finalize_managed_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare account auth.users%rowtype; creator public.team_members%rowtype; assigned_role text;
begin
 select * into account from auth.users where id=new.id;
 if not found then return null;end if;
 if account.raw_app_meta_data->>'managed_account' is distinct from 'true'
    or account.raw_app_meta_data->>'created_by' is null then
  raise exception 'Registrazione riservata agli amministratori' using errcode='42501';
 end if;
 select * into creator from public.team_members
 where user_id=(account.raw_app_meta_data->>'created_by')::uuid and role='admin' for share;
 if not found then raise exception 'Amministratore della squadra non valido' using errcode='42501';end if;
 assigned_role:=account.raw_app_meta_data->>'team_role';
 if assigned_role is null or assigned_role not in ('admin','manager','coach','secretary','technical_assistant','president') then
  raise exception 'Ruolo non valido' using errcode='22023';
 end if;
 insert into public.team_members(user_id,owner_id,role,display_name)
 values(account.id,creator.owner_id,assigned_role,coalesce(account.email,''));
 return null;
end $function$
;
CREATE OR REPLACE FUNCTION private_access.recalculate_match_minutes(p_match uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare m public.matches%rowtype; a public.activities%rowtype; r record; e record;
 active uuid[]:='{}'; used uuid[]:='{}'; dismissed uuid[]:='{}';
 starts jsonb:='{}'; totals jsonb:='{}'; elapsed integer; started boolean;
begin
 select * into a from public.activities where match_id=p_match for update;
 if not found then return;end if;
 if auth.uid() is not null then
  if a.user_id is distinct from private_access.team_owner() or private_access.team_role() not in ('admin','manager','coach','technical_assistant') then
   raise exception 'Modifica sportiva non consentita' using errcode='42501';end if;
 elsif current_user not in ('postgres','service_role','supabase_admin') then
  raise exception 'Accedi alla squadra' using errcode='42501';
 end if;
 select * into m from public.matches where id=p_match and user_id=a.user_id for update;
 if not found or not m.minutes_auto then return;end if;
 started:=m.goals_for is not null or a.status='Concluso' or exists(
  select 1 from public.match_events where match_id=m.id and user_id=m.user_id
   and (event_type='Sostituzione' or (event_type='Espulsione' and player_id is not null)));
 for r in select * from public.activity_roster where activity_id=a.id and user_id=m.user_id order by player_id loop
  totals:=totals||jsonb_build_object(r.player_id::text,0);
  if r.called and r.lineup='Titolare' then
   active:=array_append(active,r.player_id);used:=array_append(used,r.player_id);
   starts:=starts||jsonb_build_object(r.player_id::text,0);
  end if;
 end loop;
 if cardinality(active)>11 then raise exception 'Al massimo 11 titolari' using errcode='22023';end if;
 if started and a.status<>'Annullato' then
  for e in select * from public.match_events where match_id=m.id and user_id=m.user_id
   and (event_type='Sostituzione' or (event_type='Espulsione' and player_id is not null))
   order by minute,created_at,id loop
   if e.minute is null or e.minute<0 or e.minute>m.duration_minutes then
    raise exception 'Il minuto del cambio o dell’espulsione deve rientrare nella durata della gara' using errcode='22023';end if;
   if e.event_type='Sostituzione' then
    if e.player_id is null or e.outgoing_player_id is null or e.player_id=e.outgoing_player_id
     or not(e.outgoing_player_id=any(active)) then
     raise exception 'Il giocatore uscente deve essere in campo al minuto del cambio. Verifica titolari ed eventi.' using errcode='22023';end if;
    if e.player_id=any(used) or e.player_id=any(dismissed) or not exists(
     select 1 from public.activity_roster where activity_id=a.id and player_id=e.player_id and called and user_id=m.user_id) then
     raise exception 'Il subentrato deve essere convocato, non impiegato prima e non espulso' using errcode='22023';end if;
    elapsed:=e.minute-(starts->>e.outgoing_player_id::text)::integer;
    totals:=totals||jsonb_build_object(e.outgoing_player_id::text,elapsed);
    active:=array_remove(active,e.outgoing_player_id);active:=array_append(active,e.player_id);
    used:=array_append(used,e.player_id);starts:=starts||jsonb_build_object(e.player_id::text,e.minute);
   else
    if e.player_id=any(dismissed) or not exists(select 1 from public.activity_roster
     where activity_id=a.id and player_id=e.player_id and called and user_id=m.user_id) then
     raise exception 'Verifica il convocato espulso: espulsione duplicata o giocatore non convocato' using errcode='22023';end if;
    if e.player_id=any(active) then
     elapsed:=e.minute-(starts->>e.player_id::text)::integer;
     totals:=totals||jsonb_build_object(e.player_id::text,elapsed);active:=array_remove(active,e.player_id);
    end if;
    dismissed:=array_append(dismissed,e.player_id);
   end if;
  end loop;
  foreach p_match in array active loop
   totals:=totals||jsonb_build_object(p_match::text,m.duration_minutes-(starts->>p_match::text)::integer);
  end loop;
 end if;
 update public.activity_roster target set minutes_played=(totals->>target.player_id::text)::integer,
  lineup=case when target.lineup='Non impiegato' and target.player_id=any(used) then 'Panchina' else target.lineup end
 where target.activity_id=a.id and target.user_id=m.user_id and
  (target.minutes_played is distinct from (totals->>target.player_id::text)::integer or
   (target.lineup='Non impiegato' and target.player_id=any(used)));
end $function$
;
CREATE OR REPLACE FUNCTION public.save_match_result(p_id uuid, p_values jsonb, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a public.activities%rowtype; m public.matches%rowtype;begin
 if private_access.team_role() not in ('admin','manager','coach','technical_assistant') or private_access.team_owner() is null then
  raise exception 'Modifica sportiva non consentita' using errcode='42501';end if;
 select * into a from public.activities where match_id=p_id and user_id=private_access.team_owner() for update;
 if not found then raise exception 'Partita non disponibile' using errcode='42501';end if;
 if a.revision is distinct from p_revision then raise exception 'Partita modificata da un altro membro dello staff. Riaprila.' using errcode='40001';end if;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Dati non validi' using errcode='22023';end if;
 if (p_values->>'goals_for' is null)<>(p_values->>'goals_against' is null) then
  raise exception 'Inserisci entrambi i punteggi' using errcode='22023';end if;
 update public.matches set goals_for=(p_values->>'goals_for')::integer,goals_against=(p_values->>'goals_against')::integer,
  venue=p_values->>'venue',note=nullif(p_values->>'note',''),duration_minutes=(p_values->>'duration_minutes')::integer,
  minutes_auto=(p_values->>'minutes_auto')::boolean where id=p_id and user_id=a.user_id returning * into m;
 perform private_access.recalculate_match_minutes(m.id);
 update public.activities set revision=revision+1 where id=a.id;
 return to_jsonb(m);
end $function$
;
CREATE OR REPLACE FUNCTION public.save_training_attendance(p_activity_id uuid, p_activity_revision integer, p_session jsonb, p_attendance jsonb, p_session_id uuid DEFAULT NULL::uuid, p_expected_revision integer DEFAULT NULL::integer, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare owner uuid:=private_access.team_owner(); a public.activities%rowtype; result jsonb;
 prior_target text:=pg_catalog.current_setting('eburum.training_activity',true); replay boolean:=false;
begin
 if owner is null or private_access.team_role() not in ('admin','manager','coach','technical_assistant') then raise exception 'Registrazione presenze riservata allo staff operativo' using errcode='42501';end if;
 select * into a from public.activities where id=p_activity_id and user_id=owner for update;
 if not found or a.activity_type<>'Allenamento' then raise exception 'Apri un allenamento della squadra' using errcode='42501';end if;
 if a.status='Annullato' then raise exception 'L’allenamento è annullato' using errcode='22023';end if;
 if a.activity_date>(pg_catalog.now() at time zone 'Europe/Rome')::date then raise exception 'Le presenze si confermano il giorno dell’allenamento o dopo' using errcode='22023';end if;
 if p_session->>'session_type' is distinct from 'Allenamento' or (p_session->>'session_date')::date is distinct from a.activity_date then raise exception 'Data e tipo non corrispondono all’allenamento' using errcode='22023';end if;
 if p_session_id is null and a.session_id is not null then
  replay:=exists(select 1 from public.sessions where id=a.session_id and user_id=owner and save_request_id=p_request_id);
  if not replay then raise exception 'Presenze già registrate. Riapri l’allenamento.' using errcode='40001';end if;
 elsif a.session_id is distinct from p_session_id then raise exception 'Sessione non collegata all’allenamento' using errcode='42501';end if;
 if not replay and a.revision is distinct from p_activity_revision then raise exception 'Allenamento o risposte modificati nel frattempo. Riapri l’allenamento.' using errcode='40001';end if;
 perform pg_catalog.set_config('eburum.training_activity',a.id::text,true);
 result:=public.save_attendance_session(p_session,p_attendance,p_session_id,p_expected_revision,p_request_id);
 perform pg_catalog.set_config('eburum.training_activity',coalesce(prior_target,''),true);
 if not exists(select 1 from public.activities where id=a.id and session_id=(result->'session'->>'id')::uuid and user_id=owner) then raise exception 'Collegamento presenze non riuscito' using errcode='40001';end if;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION private_access.sync_calendar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target uuid:=nullif(pg_catalog.current_setting('eburum.training_activity',true),'')::uuid;
begin
 if auth.uid() is not null and new.user_id is distinct from private_access.team_owner() then raise exception 'Squadra non consentita' using errcode='42501';end if;
 if private_access.team_role()='technical_assistant' then
  if tg_table_name='matches' then return null;end if;
  if target is not null then
   update public.activities set session_id=new.id,status='Concluso'
   where id=target and user_id=new.user_id and activity_type='Allenamento' and activity_date=new.session_date
    and (session_id is null or session_id=new.id) and status<>'Annullato';
  else
   update public.activities set status='Concluso'
   where session_id=new.id and user_id=new.user_id and activity_type='Allenamento' and activity_date=new.session_date;
  end if;
  if not found then raise exception 'Apri un allenamento esistente per registrare le presenze' using errcode='42501';end if;
  return null;
 end if;
 if tg_table_name='matches' then
  insert into public.activities(user_id,activity_date,activity_type,title,organization_note,match_id)
   values(new.user_id,new.match_date,'Partita',new.opponent,new.note,new.id)
   on conflict(match_id) do update set activity_date=excluded.activity_date,title=excluded.title;
 else
  if not exists(select 1 from public.activities where session_id=new.id) then
   if target is not null then
    update public.activities set session_id=new.id,status='Concluso'
     where id=target and user_id=new.user_id and activity_type='Allenamento' and new.session_type='Allenamento'
      and activity_date=new.session_date and session_id is null and status='Programmato';
    if not found then raise exception 'Allenamento non disponibile. Riaprilo.' using errcode='40001';end if;
   else
    update public.activities set session_id=new.id,status='Concluso' where id=(select id from public.activities where user_id=new.user_id and activity_date=new.session_date and activity_type=new.session_type and session_id is null and status='Programmato' order by start_time nulls last,id limit 1);
   end if;
  end if;
  insert into public.activities(user_id,activity_date,activity_type,title,status,session_id)
   values(new.user_id,new.session_date,new.session_type,new.session_type,'Concluso',new.id)
   on conflict(session_id) do update set activity_date=excluded.activity_date,activity_type=excluded.activity_type,status='Concluso';
 end if;return null;
end $function$
;

-- Distinguish sporting recording from planning and lineup authority even for direct API writes.
create function private_access.guard_technical_assistant() returns trigger
language plpgsql security invoker set search_path='' as $$
declare kind text; existing public.activity_roster%rowtype; tech public.activity_technical%rowtype;
begin
 if private_access.team_role() is distinct from 'technical_assistant' then return new;end if;
 if new.user_id is distinct from private_access.team_owner() then raise exception 'Squadra non consentita' using errcode='42501';end if;
 if tg_table_name='activities' then
  if tg_op='INSERT' then raise exception 'Creazione attività riservata ai responsabili' using errcode='42501';end if;
  if (to_jsonb(new)-array['revision','updated_at','updated_by','request_id','session_id','status'])
    is distinct from (to_jsonb(old)-array['revision','updated_at','updated_by','request_id','session_id','status']) then
   raise exception 'Organizzazione riservata ai responsabili' using errcode='42501';end if;
  if (new.session_id,new.status) is distinct from (old.session_id,old.status) and
    not (new.activity_type='Allenamento' and new.status='Concluso' and new.session_id is not null
      and exists(select 1 from public.sessions where id=new.session_id and user_id=new.user_id
       and session_type='Allenamento' and session_date=new.activity_date)) then
   raise exception 'Stato attività riservato ai responsabili' using errcode='42501';end if;
 elsif tg_table_name='matches' then
  if tg_op='INSERT' or (to_jsonb(new)-array['goals_for','goals_against','note','duration_minutes'])
    is distinct from (to_jsonb(old)-array['goals_for','goals_against','note','duration_minutes']) then
   raise exception 'Impostazioni partita riservate ai responsabili' using errcode='42501';end if;
 elsif tg_table_name='sessions' then
  if new.session_type<>'Allenamento' then raise exception 'Registra soltanto le presenze degli allenamenti' using errcode='42501';end if;
  if tg_op='INSERT' then
   if not exists(select 1 from public.activities where id=nullif(pg_catalog.current_setting('eburum.training_activity',true),'')::uuid
     and user_id=new.user_id and activity_type='Allenamento' and activity_date=new.session_date) then
    raise exception 'Apri un allenamento esistente' using errcode='42501';end if;
  elsif (to_jsonb(new)-array['note','revision','updated_at','updated_by','save_request_id'])
    is distinct from (to_jsonb(old)-array['note','revision','updated_at','updated_by','save_request_id']) then
   raise exception 'Data sessione riservata ai responsabili' using errcode='42501';end if;
 elsif tg_table_name='activity_roster' then
  select activity_type into kind from public.activities where id=new.activity_id and user_id=new.user_id;
  if kind='Allenamento' then
   if new.called or new.lineup<>'Non impiegato' or new.position is not null or new.minutes_played<>0 then
    raise exception 'Impiego non disponibile negli allenamenti' using errcode='42501';end if;
  elsif kind='Partita' then
   if tg_op='INSERT' then
    select * into existing from public.activity_roster where activity_id=new.activity_id and player_id=new.player_id and user_id=new.user_id;
    if not found or (to_jsonb(new)-array['id','updated_at','updated_by']) is distinct from (to_jsonb(existing)-array['id','updated_at','updated_by']) then
     raise exception 'Convocazioni riservate ai responsabili' using errcode='42501';end if;
   else
    if (to_jsonb(new)-array['minutes_played','lineup','updated_at','updated_by'])
      is distinct from (to_jsonb(old)-array['minutes_played','lineup','updated_at','updated_by']) then
     raise exception 'Convocazioni riservate ai responsabili' using errcode='42501';end if;
    if new.lineup is distinct from old.lineup and not (old.lineup='Non impiegato' and new.lineup='Panchina'
      and exists(select 1 from public.match_events e join public.activities a on a.match_id=e.match_id
        where a.id=new.activity_id and e.user_id=new.user_id and e.event_type='Sostituzione' and e.player_id=new.player_id)) then
     raise exception 'Formazione riservata ai responsabili' using errcode='42501';end if;
   end if;
  else raise exception 'Attività non disponibile al collaboratore' using errcode='42501';end if;
 elsif tg_table_name='activity_technical' then
  if tg_op='INSERT' then
   select * into tech from public.activity_technical where activity_id=new.activity_id and user_id=new.user_id;
   if new.formation is distinct from tech.formation then raise exception 'Modulo riservato all’allenatore' using errcode='42501';end if;
  elsif new.formation is distinct from old.formation then
   raise exception 'Modulo riservato all’allenatore' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private_access.guard_technical_assistant() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['activities','activity_roster','activity_technical','matches','sessions'] loop
  execute format('create trigger guard_technical_assistant before insert or update on public.%I for each row execute function private_access.guard_technical_assistant()',t);
 end loop;
end $$;

do $$declare t text; rule text;begin
 foreach t in array array['sessions','attendance','matches','match_events','activities','activity_roster'] loop
  rule:='user_id=(select private_access.team_owner()) and (select private_access.team_role()) in (''admin'',''manager'',''coach'',''technical_assistant'')';
  if t='activities' then
   execute format('alter policy %I on public.%I with check(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in (''admin'',''manager'',''coach''))',t||'_create',t);
  else execute format('alter policy %I on public.%I with check(%s)',t||'_create',t,rule);end if;
  execute format('alter policy %I on public.%I using(%s) with check(%s)',t||'_edit',t,rule,rule);
 end loop;
end $$;
alter policy activity_technical_read on public.activity_technical using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','coach','technical_assistant'));
alter policy activity_technical_create on public.activity_technical with check(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','coach','technical_assistant'));
alter policy activity_technical_edit on public.activity_technical using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','coach','technical_assistant')) with check(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','coach','technical_assistant'));
alter policy disciplinary_clearances_create on public.disciplinary_clearances with check(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach','technical_assistant'));
alter policy disciplinary_clearances_remove on public.disciplinary_clearances using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach','technical_assistant'));
alter policy staff_communications_create on public.staff_communications with check(user_id=(select private_access.team_owner()) and created_by=(select auth.uid()) and (select private_access.team_role()) in ('admin','manager','coach','secretary','technical_assistant','president'));
alter policy staff_communications_realtime_read on realtime.messages using(extension='broadcast' and realtime.topic()='team:'||(select private_access.team_owner())::text||':communications' and (select private_access.team_role()) in ('admin','manager','coach','secretary','technical_assistant','president'));

-- This deliberately privileged projection returns only state labels, never dates or contacts.
create function public.team_administration_summary() returns table(player_id uuid,registration_status text,certificate_status text,document_status text,needs_review boolean)
language plpgsql stable security definer set search_path='' as $$
declare owner uuid; actor_role text; local_day date:=(pg_catalog.now() at time zone 'Europe/Rome')::date;
begin
 if auth.uid() is null then raise exception 'Accedi alla squadra' using errcode='42501';end if;
 owner:=private_access.team_owner();actor_role:=private_access.team_role();
 if owner is null or actor_role not in ('admin','president') then raise exception 'Riepilogo riservato alla presidenza' using errcode='42501';end if;
 return query
 select p.id,coalesce(d.registration_status,'Da verificare'),
  case when d.certificate_until is null then 'Da verificare' when d.certificate_until<local_day then 'Scaduto' when d.certificate_until<=local_day+30 then 'In scadenza' else 'In regola' end,
  case when d.document_until is null then 'Da verificare' when d.document_until<local_day then 'Scaduto' when d.document_until<=local_day+30 then 'In scadenza' else 'In regola' end,
  d.certificate_until is null or d.document_until is null or d.certificate_until<=local_day+30 or d.document_until<=local_day+30 or coalesce(d.registration_status,'Da verificare')<>'In regola'
 from public.players p left join public.player_administration d on d.player_id=p.id and d.user_id=owner
 where p.user_id=owner;
end $$;
revoke all on function public.team_administration_summary() from public,anon;
grant execute on function public.team_administration_summary() to authenticated;
notify pgrst,'reload schema';
-- Collaborators save observations without rewriting a stale lineup or organization snapshot.
create function public.save_activity_observation(p_id uuid,p_revision integer,p_note text) returns void
language plpgsql security invoker set search_path='' as $$
declare a public.activities%rowtype; prior_formation text;
begin
 if private_access.team_role() not in ('admin','coach','technical_assistant') or private_access.team_owner() is null then raise exception 'Osservazioni riservate allo staff tecnico' using errcode='42501';end if;
 if length(p_note)>10000 then raise exception 'Nota troppo lunga' using errcode='22023';end if;
 select * into a from public.activities where id=p_id and user_id=private_access.team_owner() for update;
 if not found or a.activity_type<>'Partita' then raise exception 'Partita non disponibile' using errcode='42501';end if;
 if a.revision is distinct from p_revision then raise exception 'Partita modificata nel frattempo. Riaprila.' using errcode='40001';end if;
 select formation into prior_formation from public.activity_technical where activity_id=a.id and user_id=a.user_id;
 insert into public.activity_technical(activity_id,user_id,formation,note) values(a.id,a.user_id,prior_formation,nullif(btrim(p_note),''))
 on conflict(activity_id) do update set note=excluded.note;
 update public.activities set revision=revision+1 where id=a.id;
end $$;
revoke all on function public.save_activity_observation(uuid,integer,text) from public,anon;
grant execute on function public.save_activity_observation(uuid,integer,text) to authenticated;
CREATE OR REPLACE FUNCTION public.save_team_activity(p_activity jsonb, p_roster jsonb, p_id uuid DEFAULT NULL::uuid, p_revision integer DEFAULT NULL::integer, p_technical jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare uid uuid:=private_access.team_owner(); a public.activities%rowtype; mid uuid; n integer;begin
 if private_access.team_role() not in ('admin','manager','coach','technical_assistant') or uid is null then raise exception 'Accedi alla squadra' using errcode='42501';end if;
 if private_access.team_role()='technical_assistant' and p_id is null then raise exception 'Creazione attività riservata ai responsabili' using errcode='42501';end if;
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
end $function$
;
