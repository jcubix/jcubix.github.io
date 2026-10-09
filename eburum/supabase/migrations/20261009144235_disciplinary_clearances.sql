create table public.disciplinary_clearances(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 player_id uuid not null,
 season_start date not null check(extract(month from season_start)=7 and extract(day from season_start)=1),
 threshold_event_id uuid not null references public.match_events(id) on delete cascade,
 served_match_id uuid not null,
 confirmed_at timestamptz not null default now(),
 confirmed_by uuid references auth.users(id) on delete set null,
 unique(player_id,season_start,threshold_event_id),
 unique(player_id,served_match_id),
 foreign key(user_id,player_id) references public.players(user_id,id) on delete cascade,
 foreign key(user_id,served_match_id) references public.matches(user_id,id) on delete cascade
);
create index disciplinary_clearances_owner_idx on public.disciplinary_clearances(user_id);
create index disciplinary_clearances_threshold_idx on public.disciplinary_clearances(threshold_event_id);
create index disciplinary_clearances_match_idx on public.disciplinary_clearances(served_match_id);
create index disciplinary_clearances_actor_idx on public.disciplinary_clearances(confirmed_by);
alter table public.disciplinary_clearances enable row level security;
revoke all on public.disciplinary_clearances from anon,authenticated;
grant select,insert,delete on public.disciplinary_clearances to authenticated;
create policy disciplinary_clearances_read on public.disciplinary_clearances for select to authenticated
 using(user_id=(select private_access.team_owner()));
create policy disciplinary_clearances_create on public.disciplinary_clearances for insert to authenticated
 with check(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach'));
create policy disciplinary_clearances_remove on public.disciplinary_clearances for delete to authenticated
 using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach'));
create function private_access.validate_disciplinary_clearance() returns trigger language plpgsql security invoker set search_path='' as $$
declare milestone_date date; served_date date; event_rank bigint;
begin
 select m.match_date into milestone_date from public.match_events e join public.matches m on m.id=e.match_id
 where e.id=new.threshold_event_id and e.user_id=new.user_id and e.player_id=new.player_id and e.event_type='Ammonizione';
 if milestone_date is null then raise exception 'Ammonizione di riferimento non valida' using errcode='22023';end if;
 select n into event_rank from (
 select e.id,row_number() over(order by m.match_date,coalesce(e.minute,999),coalesce(e.created_at::text,''),e.id) as n
 from public.match_events e join public.matches m on m.id=e.match_id
 where e.user_id=new.user_id and e.player_id=new.player_id and e.event_type='Ammonizione'
 and m.match_date>=new.season_start and m.match_date<new.season_start+interval '1 year' and m.match_date<=current_date
 and not exists(select 1 from public.activities a where a.match_id=m.id and a.status='Annullato')
 ) ranked where id=new.threshold_event_id;
 if event_rank is null or event_rank%5<>0 then raise exception 'La soglia di cinque ammonizioni non risulta raggiunta' using errcode='22023';end if;
 select match_date into served_date from public.matches where id=new.served_match_id and user_id=new.user_id;
 if served_date is null or served_date<=milestone_date or served_date>current_date or served_date>=new.season_start+interval '1 year'
 or exists(select 1 from public.activities where match_id=new.served_match_id and status='Annullato') then
 raise exception 'Seleziona una gara successiva alla soglia, gia disputata nella stessa stagione' using errcode='22023';end if;
 if exists(select 1 from public.activities a join public.activity_roster r on r.activity_id=a.id
 where a.match_id=new.served_match_id and r.player_id=new.player_id and r.minutes_played>0) then
 raise exception 'Il giocatore ha minuti registrati nella gara selezionata' using errcode='22023';end if;
 new.confirmed_at:=now();new.confirmed_by:=auth.uid();return new;
end $$;
revoke all on function private_access.validate_disciplinary_clearance() from public,anon;
grant execute on function private_access.validate_disciplinary_clearance() to authenticated;
create trigger validate_disciplinary_clearance before insert on public.disciplinary_clearances
 for each row execute function private_access.validate_disciplinary_clearance();
