-- Route attendance to the explicit training; retain the legacy calendar sync.
create or replace function private_access.sync_calendar() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid:=nullif(pg_catalog.current_setting('eburum.training_activity',true),'')::uuid;
begin
 if auth.uid() is not null and new.user_id is distinct from private_access.team_owner() then raise exception 'Squadra non consentita' using errcode='42501';end if;
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
end $$;
revoke all on function private_access.sync_calendar() from public,anon,authenticated;

create function public.save_training_attendance(
 p_activity_id uuid,p_activity_revision integer,p_session jsonb,p_attendance jsonb,
 p_session_id uuid default null,p_expected_revision integer default null,p_request_id uuid default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner uuid:=private_access.team_owner(); a public.activities%rowtype; result jsonb;
 prior_target text:=pg_catalog.current_setting('eburum.training_activity',true); replay boolean:=false;
begin
 if owner is null or private_access.team_role() not in ('admin','manager','coach') then raise exception 'Registrazione presenze riservata allo staff operativo' using errcode='42501';end if;
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
end $$;
revoke all on function public.save_training_attendance(uuid,integer,jsonb,jsonb,uuid,integer,uuid) from public,anon;
grant execute on function public.save_training_attendance(uuid,integer,jsonb,jsonb,uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
