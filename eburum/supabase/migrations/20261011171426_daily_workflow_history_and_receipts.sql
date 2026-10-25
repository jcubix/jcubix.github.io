-- Important communications: explicit, immutable acknowledgements, never inferred from opening.
alter table public.staff_communications add column requires_ack boolean not null default false;
create table public.communication_receipts (
 communication_id uuid not null references public.staff_communications(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 reader_id uuid not null references auth.users(id) on delete cascade,
 reader_label text not null,
 acknowledged_at timestamptz not null default now(),
 primary key(communication_id,reader_id)
);
create index communication_receipts_owner_idx on public.communication_receipts(user_id);
create index communication_receipts_reader_idx on public.communication_receipts(reader_id);
alter table public.communication_receipts enable row level security;
revoke all on public.communication_receipts from public,anon,authenticated;
grant select,insert on public.communication_receipts to authenticated;
create policy communication_receipts_read on public.communication_receipts for select to authenticated
 using(user_id=(select private_access.team_owner()) and exists(select 1 from public.staff_communications m where m.id=communication_id and m.user_id=communication_receipts.user_id and m.expires_at>now()));
create policy communication_receipts_create on public.communication_receipts for insert to authenticated
 with check(user_id=(select private_access.team_owner()) and reader_id=(select auth.uid()) and exists(select 1 from public.staff_communications m where m.id=communication_id and m.user_id=communication_receipts.user_id and m.requires_ack and m.expires_at>now()));
create function private_access.stamp_communication_receipt() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 new.reader_id:=auth.uid();new.acknowledged_at:=now();
 select coalesce(nullif(btrim(concat_ws(' ',first_name,last_name)),''),nullif(display_name,''),'Staff') into new.reader_label from public.team_members where user_id=auth.uid();
 return new;
end $$;
revoke all on function private_access.stamp_communication_receipt() from public,anon,authenticated;
create trigger stamp_communication_receipt before insert on public.communication_receipts for each row execute function private_access.stamp_communication_receipt();
create trigger broadcast_communication_receipts after insert on public.communication_receipts for each row execute function private_access.broadcast_staff_communications();
create function public.acknowledge_communication(p_id uuid) returns void
 language plpgsql security invoker set search_path='' as $$
declare owner uuid:=private_access.team_owner();
begin
 if auth.uid() is null or owner is null then raise exception 'Accesso richiesto' using errcode='42501';end if;
 if not exists(select 1 from public.staff_communications where id=p_id and user_id=owner and requires_ack and expires_at>now()) then raise exception 'Comunicazione non disponibile o senza conferma di lettura' using errcode='42501';end if;
 insert into public.communication_receipts(communication_id,user_id,reader_id,reader_label) values(p_id,owner,auth.uid(),'Staff') on conflict do nothing;
end $$;
revoke all on function public.acknowledge_communication(uuid) from public,anon;
grant execute on function public.acknowledge_communication(uuid) to authenticated;

-- Append-only, server-written sporting audit. Never store private technical or medical data.
create table public.activity_history (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 activity_id uuid not null references public.activities(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,actor_label text not null,
 changed_at timestamptz not null default now(),entity text not null,action text not null,
 before_data jsonb,after_data jsonb
);
create index activity_history_activity_time_idx on public.activity_history(user_id,activity_id,changed_at desc,id);
create index activity_history_actor_idx on public.activity_history(actor_id);
create index activity_history_activity_idx on public.activity_history(activity_id);
alter table public.activity_history enable row level security;
revoke all on public.activity_history from public,anon,authenticated;
grant select on public.activity_history to authenticated;
create policy activity_history_read on public.activity_history for select to authenticated using(user_id=(select private_access.team_owner()));
create function private_access.audit_sporting_activity() returns trigger
 language plpgsql security definer set search_path='' as $$
declare oldrow jsonb;newrow jsonb;rowdata jsonb;target uuid;owner uuid;label text;
begin
 if tg_op<>'INSERT' then oldrow:=to_jsonb(old)-array['updated_at','updated_by','revision','request_id','save_request_id'];end if;
 if tg_op<>'DELETE' then newrow:=to_jsonb(new)-array['updated_at','updated_by','revision','request_id','save_request_id'];end if;
 if oldrow is not distinct from newrow then return null;end if;
 rowdata:=coalesce(newrow,oldrow);owner:=(rowdata->>'user_id')::uuid;
 if tg_table_name='activities' then target:=(rowdata->>'id')::uuid;
 elsif tg_table_name='activity_roster' then target:=(rowdata->>'activity_id')::uuid;
 else select id into target from public.activities where user_id=owner and match_id=case when tg_table_name='matches' then (rowdata->>'id')::uuid else (rowdata->>'match_id')::uuid end;
 end if;
 if target is null or not exists(select 1 from public.activities where id=target and user_id=owner) then return null;end if;
 select coalesce(nullif(btrim(concat_ws(' ',first_name,last_name)),''),nullif(display_name,''),'Staff') into label from public.team_members where user_id=auth.uid();
 insert into public.activity_history(user_id,activity_id,actor_id,actor_label,entity,action,before_data,after_data) values(owner,target,auth.uid(),coalesce(label,'Sistema'),tg_table_name,tg_op,oldrow,newrow);
 return null;
end $$;
revoke all on function private_access.audit_sporting_activity() from public,anon,authenticated;
create trigger audit_activity after insert or update on public.activities for each row execute function private_access.audit_sporting_activity();
create trigger audit_roster after insert or update or delete on public.activity_roster for each row execute function private_access.audit_sporting_activity();
create trigger audit_match after update on public.matches for each row execute function private_access.audit_sporting_activity();
create trigger audit_match_event after insert or update or delete on public.match_events for each row execute function private_access.audit_sporting_activity();
-- A completed match must have a saved score, including a valid 0–0.
create function private_access.check_match_completion() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if new.activity_type='Partita' and new.status='Concluso' and old.status is distinct from 'Concluso' then
  if new.activity_date>(now() at time zone 'Europe/Rome')::date then raise exception 'Non puoi concludere una partita futura' using errcode='22023';end if;
  if not exists(select 1 from public.matches where id=new.match_id and user_id=new.user_id and goals_for is not null and goals_against is not null) then raise exception 'Salva il risultato prima di concludere la partita' using errcode='22023';end if;
 end if;
 return new;
end $$;
revoke all on function private_access.check_match_completion() from public,anon,authenticated;
create trigger check_match_completion before update on public.activities for each row execute function private_access.check_match_completion();
create or replace function private_access.team_administration_summary() returns table(player_id uuid,registration_status text,certificate_status text,document_status text,needs_review boolean)
language plpgsql stable security definer set search_path='' as $$
declare owner uuid; actor_role text; local_day date:=(now() at time zone 'Europe/Rome')::date;
begin
 if auth.uid() is null then raise exception 'Accedi alla squadra' using errcode='42501';end if;
 owner:=private_access.team_owner();actor_role:=private_access.team_role();
 if owner is null or actor_role not in ('admin','president') then raise exception 'Riepilogo riservato alla presidenza' using errcode='42501';end if;
 return query select p.id,coalesce(d.registration_status,'Da verificare'),
 case when d.certificate_until is null then 'Mancante' when d.certificate_until<local_day then 'Scaduto' when d.certificate_until<=local_day+30 then 'In scadenza' else 'In regola' end,
 case when d.document_until is null then 'Mancante' when d.document_until<local_day then 'Scaduto' when d.document_until<=local_day+30 then 'In scadenza' else 'In regola' end,
 d.certificate_until is null or d.document_until is null or d.certificate_until<=local_day+30 or d.document_until<=local_day+30 or coalesce(d.registration_status,'Da verificare')<>'In regola'
 from public.players p left join public.player_administration d on d.player_id=p.id and d.user_id=owner where p.user_id=owner;
end $$;
notify pgrst,'reload schema';
