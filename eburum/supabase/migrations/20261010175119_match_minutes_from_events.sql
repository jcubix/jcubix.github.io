-- Existing games retain staff-entered minutes; new games use the event timeline.
alter table public.matches add column duration_minutes integer not null default 90
 check(duration_minutes between 1 and 130);
alter table public.matches add column minutes_auto boolean not null default false;
alter table public.matches alter column minutes_auto set default true;

create function private_access.recalculate_match_minutes(p_match uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare m public.matches%rowtype; a public.activities%rowtype; r record; e record;
 active uuid[]:='{}'; used uuid[]:='{}'; dismissed uuid[]:='{}';
 starts jsonb:='{}'; totals jsonb:='{}'; elapsed integer; started boolean;
begin
 select * into a from public.activities where match_id=p_match for update;
 if not found then return;end if;
 if auth.uid() is not null then
  if a.user_id is distinct from private_access.team_owner() or private_access.team_role() not in ('admin','manager','coach') then
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
 update public.activity_roster r set minutes_played=(totals->>r.player_id::text)::integer,
  lineup=case when r.lineup='Non impiegato' and r.player_id=any(used) then 'Panchina' else r.lineup end
 where r.activity_id=a.id and r.user_id=m.user_id and
  (r.minutes_played is distinct from (totals->>r.player_id::text)::integer or
   (r.lineup='Non impiegato' and r.player_id=any(used)));
end $$;
revoke all on function private_access.recalculate_match_minutes(uuid) from public,anon;
grant execute on function private_access.recalculate_match_minutes(uuid) to authenticated,service_role;

-- Lock the parent before an event changes, serializing concurrent event writers.
create function private_access.lock_match_timeline() returns trigger
language plpgsql security invoker set search_path='' as $$
declare mid uuid;begin
 if tg_op='UPDATE' and (new.match_id,new.user_id) is distinct from (old.match_id,old.user_id) then
  raise exception 'Collegamento dell’evento immutabile' using errcode='42501';end if;
 if tg_op='DELETE' then mid:=old.match_id;else mid:=new.match_id;end if;
 perform 1 from public.activities where match_id=mid for update;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger match_timeline_lock before insert or update or delete on public.match_events
 for each row execute function private_access.lock_match_timeline();

-- Deferred checks see the complete roster, not a half-written RPC payload.
create function private_access.sync_match_minutes() returns trigger
language plpgsql security invoker set search_path='' as $$
declare mid uuid; aid uuid;begin
 if tg_table_name='match_events' then
  if tg_op='DELETE' then mid:=old.match_id;else mid:=new.match_id;end if;
 elsif tg_table_name='matches' then mid:=new.id;
 elsif tg_table_name='activities' then mid:=new.match_id;
 else
  if tg_op='DELETE' then aid:=old.activity_id;else aid:=new.activity_id;end if;
  select match_id into mid from public.activities where id=aid;
 end if;
 if mid is not null then perform private_access.recalculate_match_minutes(mid);end if;
 return null;
end $$;
create constraint trigger match_event_minutes after insert or update or delete on public.match_events
 deferrable initially deferred for each row execute function private_access.sync_match_minutes();
create constraint trigger match_result_minutes after update on public.matches
 deferrable initially deferred for each row
 when ((old.duration_minutes,old.minutes_auto,old.goals_for,old.goals_against) is distinct from
       (new.duration_minutes,new.minutes_auto,new.goals_for,new.goals_against))
 execute function private_access.sync_match_minutes();
create constraint trigger match_roster_minutes after insert or update or delete on public.activity_roster
 deferrable initially deferred for each row execute function private_access.sync_match_minutes();
create constraint trigger match_status_minutes after update on public.activities
 deferrable initially deferred for each row when (old.status is distinct from new.status)
 execute function private_access.sync_match_minutes();
revoke all on function private_access.lock_match_timeline(),private_access.sync_match_minutes() from public,anon,authenticated;

create function public.save_match_result(p_id uuid,p_values jsonb,p_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.activities%rowtype; m public.matches%rowtype;begin
 if private_access.team_role() not in ('admin','manager','coach') or private_access.team_owner() is null then
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
end $$;
revoke all on function public.save_match_result(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_match_result(uuid,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
