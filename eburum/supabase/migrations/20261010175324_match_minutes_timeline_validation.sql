create or replace function private_access.recalculate_match_minutes(p_match uuid) returns void
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
 update public.activity_roster target set minutes_played=(totals->>target.player_id::text)::integer,
  lineup=case when target.lineup='Non impiegato' and target.player_id=any(used) then 'Panchina' else target.lineup end
 where target.activity_id=a.id and target.user_id=m.user_id and
  (target.minutes_played is distinct from (totals->>target.player_id::text)::integer or
   (target.lineup='Non impiegato' and target.player_id=any(used)));
end $$;
