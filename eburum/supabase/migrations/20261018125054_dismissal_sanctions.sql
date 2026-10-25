-- Official decisions are entered by staff, never inferred from a red card.
create table public.dismissal_sanctions (
 event_id uuid primary key references public.match_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 player_id uuid not null, match_id uuid not null,
 kind text not null check(kind in ('matches','until')),
 match_count integer, suspended_until date, note text check(length(note)<=2000),
 voided boolean not null default false, revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 foreign key(user_id,player_id) references public.players(user_id,id) on delete cascade,
 foreign key(user_id,match_id) references public.matches(user_id,id) on delete cascade,
 check((kind='matches' and match_count is not null and match_count between 1 and 100 and suspended_until is null)
    or (kind='until' and match_count is null and suspended_until is not null))
);
create table public.dismissal_clearances (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.dismissal_sanctions(event_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 player_id uuid not null,match_id uuid not null,
 confirmed_at timestamptz not null default now(),confirmed_by uuid references auth.users(id) on delete set null,
 unique(player_id,match_id),unique(event_id,match_id),
 foreign key(user_id,player_id) references public.players(user_id,id) on delete cascade,
 foreign key(user_id,match_id) references public.matches(user_id,id) on delete cascade
);
create index dismissal_sanctions_owner_player_idx on public.dismissal_sanctions(user_id,player_id);
create index dismissal_sanctions_match_idx on public.dismissal_sanctions(match_id);
create index dismissal_sanctions_actor_idx on public.dismissal_sanctions(updated_by);
create index dismissal_clearances_owner_idx on public.dismissal_clearances(user_id);
create index dismissal_clearances_match_idx on public.dismissal_clearances(match_id);
create index dismissal_clearances_actor_idx on public.dismissal_clearances(confirmed_by);
alter table public.dismissal_sanctions enable row level security;
alter table public.dismissal_clearances enable row level security;
revoke all on public.dismissal_sanctions,public.dismissal_clearances from public,anon,authenticated;
grant select,insert,update on public.dismissal_sanctions to authenticated;
grant select,insert,delete on public.dismissal_clearances to authenticated;
create policy dismissal_sanctions_read on public.dismissal_sanctions for select to authenticated using(user_id=(select private_access.team_owner()));
create policy dismissal_sanctions_insert on public.dismissal_sanctions for insert to authenticated with check(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach','technical_assistant'));
create policy dismissal_sanctions_update on public.dismissal_sanctions for update to authenticated using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach','technical_assistant')) with check(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach','technical_assistant'));
create policy dismissal_clearances_read on public.dismissal_clearances for select to authenticated using(user_id=(select private_access.team_owner()));
create policy dismissal_clearances_insert on public.dismissal_clearances for insert to authenticated with check(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach','technical_assistant'));
create policy dismissal_clearances_delete on public.dismissal_clearances for delete to authenticated using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','manager','coach','technical_assistant'));

create function private_access.validate_dismissal_sanction() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.match_events; d date; n integer;
begin
 select * into e from public.match_events where id=new.event_id and user_id=new.user_id for update;
 if not found or e.player_id is null then raise exception 'Associa prima un giocatore all espulsione' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text||e.player_id::text,0));
 select match_date into d from public.matches where id=e.match_id and user_id=new.user_id;
 select count(*) into n from public.dismissal_clearances where event_id=new.event_id;
 if tg_op='UPDATE' and (new.event_id,new.user_id,new.player_id,new.match_id) is distinct from (old.event_id,old.user_id,old.player_id,old.match_id) then raise exception 'Collegamenti del provvedimento immutabili' using errcode='42501';end if;
 if not new.voided and (e.event_type<>'Espulsione' or d>(now() at time zone 'Europe/Rome')::date or exists(select 1 from public.activities where match_id=e.match_id and status='Annullato')) then raise exception 'Espulsione non valida: verifica evento, data e stato della gara' using errcode='22023';end if;
 if tg_op='INSERT' then new.player_id:=e.player_id;new.match_id:=e.match_id;new.created_at:=now();new.revision:=1;
 else
  if old.voided and new.player_id<>e.player_id and n=0 then new.player_id:=e.player_id;end if;
  if not new.voided and new.player_id<>e.player_id then raise exception 'Il giocatore dell espulsione e cambiato: annulla il provvedimento' using errcode='22023';end if;
  new.created_at:=old.created_at;new.revision:=old.revision+1;
 end if;
 if n>0 and (new.kind<>'matches' or new.match_count<n) then raise exception 'Annulla prima le conferme incompatibili con il nuovo provvedimento' using errcode='22023';end if;
 if new.kind='until' and new.suspended_until<d then raise exception 'La scadenza non puo precedere l espulsione' using errcode='22023';end if;
 new.updated_at:=now();new.updated_by:=auth.uid();return new;
end $$;
revoke all on function private_access.validate_dismissal_sanction() from public,anon,authenticated;
create trigger validate_dismissal_sanction before insert or update on public.dismissal_sanctions for each row execute function private_access.validate_dismissal_sanction();

create function private_access.validate_dismissal_clearance() returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.dismissal_sanctions; source_date date; served_date date;
begin
 select * into s from public.dismissal_sanctions where event_id=new.event_id and user_id=new.user_id;
 if not found or s.voided or s.kind<>'matches' then raise exception 'Provvedimento per giornate non disponibile' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(s.user_id::text||s.player_id::text,0));
 select * into s from public.dismissal_sanctions where event_id=new.event_id and user_id=new.user_id;
 if not found or s.voided or s.kind<>'matches' then raise exception 'Provvedimento modificato: ricarica i dati' using errcode='22023';end if;
 select m.match_date into source_date from public.matches m join public.match_events e on e.match_id=m.id where e.id=s.event_id and e.event_type='Espulsione' and e.player_id=s.player_id and e.user_id=s.user_id and not exists(select 1 from public.activities a where a.match_id=m.id and a.status='Annullato');
 select match_date into served_date from public.matches where id=new.match_id and user_id=new.user_id and goals_for is not null and goals_against is not null;
 if source_date is null or served_date is null or served_date<=source_date or served_date>(now() at time zone 'Europe/Rome')::date or exists(select 1 from public.activities where match_id=new.match_id and status='Annullato') then raise exception 'Scegli una gara successiva, gia disputata e con risultato registrato' using errcode='22023';end if;
 if exists(select 1 from public.activity_roster r join public.activities a on a.id=r.activity_id where a.match_id=new.match_id and r.player_id=s.player_id and r.minutes_played>0) then raise exception 'Il giocatore ha minuti registrati nella gara selezionata' using errcode='22023';end if;
 if exists(select 1 from public.disciplinary_clearances where player_id=s.player_id and served_match_id=new.match_id) then raise exception 'La gara e gia attribuita a una squalifica per ammonizioni' using errcode='22023';end if;
 if (select count(*) from public.dismissal_clearances where event_id=s.event_id)>=s.match_count then raise exception 'Tutte le giornate risultano gia confermate' using errcode='22023';end if;
 new.player_id:=s.player_id;new.confirmed_at:=now();new.confirmed_by:=auth.uid();return new;
end $$;
revoke all on function private_access.validate_dismissal_clearance() from public,anon,authenticated;
create trigger validate_dismissal_clearance before insert on public.dismissal_clearances for each row execute function private_access.validate_dismissal_clearance();
create function private_access.guard_yellow_clearance_overlap() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text||new.player_id::text,0));
 if exists(select 1 from public.dismissal_clearances where player_id=new.player_id and match_id=new.served_match_id) then raise exception 'La gara e gia attribuita a una squalifica per espulsione' using errcode='22023';end if;
 return new;
end $$;
revoke all on function private_access.guard_yellow_clearance_overlap() from public,anon,authenticated;
create trigger a_guard_yellow_clearance_overlap before insert on public.disciplinary_clearances for each row execute function private_access.guard_yellow_clearance_overlap();

create function private_access.guard_sanctioned_dismissal_edit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (new.player_id,new.event_type) is distinct from (old.player_id,old.event_type) and exists(select 1 from public.dismissal_sanctions where event_id=old.id and not voided) then raise exception 'Annulla prima il provvedimento in Cartellini e diffide, poi correggi l espulsione' using errcode='22023';end if;
 return new;
end $$;
revoke all on function private_access.guard_sanctioned_dismissal_edit() from public,anon,authenticated;
create trigger guard_sanctioned_dismissal_edit before update on public.match_events for each row execute function private_access.guard_sanctioned_dismissal_edit();
create trigger audit_dismissal_sanction after insert or update on public.dismissal_sanctions for each row execute function private_access.audit_sporting_activity();
create trigger audit_dismissal_clearance after insert or delete on public.dismissal_clearances for each row execute function private_access.audit_sporting_activity();

create function public.save_dismissal_sanction(p_event_id uuid,p_values jsonb,p_revision integer default null) returns public.dismissal_sanctions language plpgsql security invoker set search_path='' as $$
declare owner uuid:=private_access.team_owner(); e public.match_events; s public.dismissal_sanctions; k text:=p_values->>'kind'; n integer:=(p_values->>'match_count')::integer; d date:=(p_values->>'suspended_until')::date; note_value text:=nullif(btrim(p_values->>'note'),''); v boolean:=coalesce((p_values->>'voided')::boolean,false);
begin
 if auth.uid() is null or private_access.team_role() not in ('admin','manager','coach','technical_assistant') then raise exception 'Permesso sportivo richiesto' using errcode='42501';end if;
 select * into e from public.match_events where id=p_event_id and user_id=owner;
 if not found or e.player_id is null then raise exception 'Espulsione non disponibile' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text||e.player_id::text,0));
 select * into s from public.dismissal_sanctions where event_id=p_event_id and user_id=owner for update;
 if found then
  if (s.kind,s.match_count,s.suspended_until,s.note,s.voided) is not distinct from (k,n,d,note_value,v) then return s;end if;
  if p_revision is distinct from s.revision then raise exception 'Provvedimento modificato nel frattempo. Riapri la scheda.' using errcode='40001';end if;
  update public.dismissal_sanctions set kind=k,match_count=n,suspended_until=d,note=note_value,voided=v where event_id=p_event_id returning * into s;
 else
  if p_revision is not null then raise exception 'Provvedimento non piu disponibile' using errcode='40001';end if;
  insert into public.dismissal_sanctions(event_id,user_id,player_id,match_id,kind,match_count,suspended_until,note,voided) values(p_event_id,owner,e.player_id,e.match_id,k,n,d,note_value,v) returning * into s;
 end if;
 return s;
end $$;
revoke all on function public.save_dismissal_sanction(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_dismissal_sanction(uuid,jsonb,integer) to authenticated;

create function public.confirm_dismissal_match(p_event_id uuid,p_match_id uuid) returns public.dismissal_clearances language plpgsql security invoker set search_path='' as $$
declare owner uuid:=private_access.team_owner(); s public.dismissal_sanctions; c public.dismissal_clearances;
begin
 if auth.uid() is null or private_access.team_role() not in ('admin','manager','coach','technical_assistant') then raise exception 'Permesso sportivo richiesto' using errcode='42501';end if;
 select * into s from public.dismissal_sanctions where event_id=p_event_id and user_id=owner;
 if not found then raise exception 'Provvedimento non disponibile' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text||s.player_id::text,0));
 select * into c from public.dismissal_clearances where event_id=p_event_id and match_id=p_match_id and user_id=owner;
 if found then return c;end if;
 insert into public.dismissal_clearances(event_id,user_id,player_id,match_id) values(p_event_id,owner,s.player_id,p_match_id) returning * into c;return c;
end $$;
revoke all on function public.confirm_dismissal_match(uuid,uuid) from public,anon;
grant execute on function public.confirm_dismissal_match(uuid,uuid) to authenticated;

-- Include outstanding decisions from previous seasons; changing season never clears a sanction.
create function public.disciplinary_dismissal_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'dismissals',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('match_date',m.match_date,'opponent',m.opponent,'activity_status',a.status)) from public.match_events e join public.matches m on m.id=e.match_id left join public.activities a on a.match_id=m.id where e.user_id=(select private_access.team_owner()) and (e.event_type='Espulsione' or exists(select 1 from public.dismissal_sanctions s where s.event_id=e.id))),'[]'::jsonb),
 'dismissal_sanctions',coalesce((select jsonb_agg(to_jsonb(s)) from public.dismissal_sanctions s where s.user_id=(select private_access.team_owner())),'[]'::jsonb),
 'dismissal_clearances',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('match_date',m.match_date,'opponent',m.opponent,'activity_status',a.status,'has_result',m.goals_for is not null and m.goals_against is not null,'has_minutes',exists(select 1 from public.activity_roster r where r.activity_id=a.id and r.player_id=c.player_id and r.minutes_played>0))) from public.dismissal_clearances c join public.matches m on m.id=c.match_id left join public.activities a on a.match_id=m.id where c.user_id=(select private_access.team_owner())),'[]'::jsonb));
$$;
revoke all on function public.disciplinary_dismissal_snapshot() from public,anon;
grant execute on function public.disciplinary_dismissal_snapshot() to authenticated;
notify pgrst,'reload schema';
