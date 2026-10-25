-- Add an authoritative treasury role without expanding sporting permissions.
alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check check(role in ('admin','manager','coach','secretary','technical_assistant','president','treasurer'));
create or replace function private_access.finalize_managed_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare account auth.users%rowtype; creator public.team_members%rowtype; assigned_role text;
begin
 select * into account from auth.users where id=new.id;if not found then return null;end if;
 if account.raw_app_meta_data->>'managed_account' is distinct from 'true' or account.raw_app_meta_data->>'created_by' is null then raise exception 'Registrazione riservata agli amministratori' using errcode='42501';end if;
 select * into creator from public.team_members where user_id=(account.raw_app_meta_data->>'created_by')::uuid and role='admin' for share;
 if not found then raise exception 'Amministratore della squadra non valido' using errcode='42501';end if;
 assigned_role:=account.raw_app_meta_data->>'team_role';
 if assigned_role is null or assigned_role not in ('admin','manager','coach','secretary','technical_assistant','president','treasurer') then raise exception 'Ruolo non valido' using errcode='22023';end if;
 insert into public.team_members(user_id,owner_id,role,display_name) values(account.id,creator.owner_id,assigned_role,coalesce(account.email,''));return null;
end $$;
alter policy staff_communications_create on public.staff_communications with check(user_id=(select private_access.team_owner()) and created_by=(select auth.uid()) and (select private_access.team_role()) in ('admin','manager','coach','secretary','technical_assistant','president','treasurer'));
alter policy staff_communications_realtime_read on realtime.messages using(extension='broadcast' and realtime.topic()='team:'||(select private_access.team_owner())::text||':communications' and (select private_access.team_role()) in ('admin','manager','coach','secretary','technical_assistant','president','treasurer'));

create table public.finance_accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 name text not null check(char_length(btrim(name)) between 1 and 100), kind text not null check(kind in ('cash','bank')),
 opened_on date not null, closed_through date, created_at timestamptz not null default now(),
 unique(user_id,name)
);
create table public.finance_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), account_id uuid not null references public.finance_accounts(id),
 entry_date date not null, kind text not null check(kind in ('opening','income','expense','transfer','reversal')),
 economic_type text not null check(economic_type in ('opening','income','expense','transfer')),
 amount_cents bigint not null check(amount_cents<>0 and abs(amount_cents)<=10000000000),
 category text not null check(category in ('Sponsor','Contributi','Materiale','Campi','Trasferte','Rimborsi','Altro','Saldo iniziale','Trasferimento')),
 description text not null check(char_length(btrim(description)) between 1 and 1000),
 activity_id uuid references public.activities(id), transfer_id uuid, reverses_id uuid unique references public.finance_entries(id),
 created_by uuid not null references auth.users(id), actor_label text not null, created_at timestamptz not null default now(),
 check((kind='reversal')=(reverses_id is not null)), check((economic_type='transfer')=(transfer_id is not null)),
 check(kind not in ('income','expense') or (kind='income' and amount_cents>0) or (kind='expense' and amount_cents<0))
);
create index finance_entries_team_date on public.finance_entries(user_id,entry_date,id);
create index finance_entries_account_date on public.finance_entries(account_id,entry_date);
create index finance_entries_activity on public.finance_entries(activity_id) where activity_id is not null;
create index finance_entries_actor on public.finance_entries(created_by);
create index finance_entries_transfer on public.finance_entries(transfer_id) where transfer_id is not null;
create table public.finance_reconciliations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),account_id uuid not null references public.finance_accounts(id),
 checked_on date not null, observed_cents bigint not null, ledger_cents bigint not null, closes_period boolean not null default false,
 note text not null default '' check(char_length(note)<=1000),created_by uuid not null references auth.users(id),actor_label text not null,created_at timestamptz not null default now()
);
create index finance_reconciliations_account on public.finance_reconciliations(account_id,checked_on);
create index finance_reconciliations_team on public.finance_reconciliations(user_id);
create index finance_reconciliations_actor on public.finance_reconciliations(created_by);
create table public.finance_receipts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),entry_id uuid not null references public.finance_entries(id),
 object_path text not null unique,file_name text not null check(char_length(file_name) between 1 and 200),mime_type text not null,
 size_bytes bigint not null check(size_bytes between 1 and 10485760),created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index finance_receipts_entry on public.finance_receipts(entry_id);
create index finance_receipts_team on public.finance_receipts(user_id);
create index finance_receipts_actor on public.finance_receipts(created_by);
create table public.finance_audit (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),action text not null,entity_id uuid not null,
 details jsonb not null,actor_id uuid not null references auth.users(id),actor_label text not null,created_at timestamptz not null default now()
);
create index finance_audit_team_created on public.finance_audit(user_id,created_at,id);
create index finance_audit_actor on public.finance_audit(actor_id);
create table private_access.finance_requests (
 user_id uuid not null,request_id uuid not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table private_access.finance_requests enable row level security;
revoke all on private_access.finance_requests from public,anon,authenticated;

alter table public.finance_accounts enable row level security;
alter table public.finance_entries enable row level security;
alter table public.finance_reconciliations enable row level security;
alter table public.finance_receipts enable row level security;
alter table public.finance_audit enable row level security;
revoke all on public.finance_accounts,public.finance_entries,public.finance_reconciliations,public.finance_receipts,public.finance_audit from public,anon,authenticated;
grant select on public.finance_accounts,public.finance_entries,public.finance_reconciliations,public.finance_receipts,public.finance_audit to authenticated;
create policy finance_accounts_read on public.finance_accounts for select to authenticated using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','treasurer','president'));
create policy finance_entries_read on public.finance_entries for select to authenticated using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','treasurer','president'));
create policy finance_reconciliations_read on public.finance_reconciliations for select to authenticated using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','treasurer','president'));
create policy finance_receipts_read on public.finance_receipts for select to authenticated using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','treasurer','president'));
create policy finance_audit_read on public.finance_audit for select to authenticated using(user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','treasurer','president'));

-- One atomic, replay-safe endpoint. All ledger writes are append-only and scoped here.
create function private_access.finance_mutate(p_action text,p_values jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=private_access.team_owner(); actor uuid:=auth.uid(); label text; payload jsonb; prior private_access.finance_requests%rowtype;
 a public.finance_accounts%rowtype; b public.finance_accounts%rowtype; e public.finance_entries%rowtype; entry_id uuid; second_id uuid; transfer uuid;
 amount bigint; d date; category text; description text; activity uuid; result jsonb; ledger bigint; object_meta jsonb; audit_id uuid;
begin
 if actor is null or owner is null or private_access.team_role() not in ('admin','treasurer') then raise exception 'Gestione economica riservata ad amministratore e tesoriere' using errcode='42501';end if;
 if p_request_id is null or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Richiesta non valida' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,981));
 payload:=jsonb_build_object('action',p_action,'values',p_values);
 select * into prior from private_access.finance_requests where user_id=owner and request_id=p_request_id;
 if found then if prior.payload is distinct from payload then raise exception 'Identificativo già usato per un’altra operazione' using errcode='22023';end if;return prior.result;end if;
 select coalesce(nullif(btrim(concat_ws(' ',first_name,last_name)),''),nullif(display_name,''),'Staff') into label from public.team_members where user_id=actor;
 if p_action='account' then
  d:=(p_values->>'date')::date;amount:=(p_values->>'amount_cents')::bigint;
  if d is null or d>(now() at time zone 'Europe/Rome')::date or amount is null or abs(amount)>10000000000 then raise exception 'Data o saldo iniziale non valido' using errcode='22023';end if;
  insert into public.finance_accounts(user_id,name,kind,opened_on) values(owner,btrim(p_values->>'name'),p_values->>'kind',d) returning * into a;
  if amount<>0 then insert into public.finance_entries(user_id,account_id,entry_date,kind,economic_type,amount_cents,category,description,created_by,actor_label) values(owner,a.id,d,'opening','opening',amount,'Saldo iniziale','Saldo iniziale · '||a.name,actor,label);end if;
  result:=jsonb_build_object('id',a.id);
 elsif p_action in ('entry','transfer','reverse','reconcile') then
  d:=(p_values->>'date')::date;
  if d is null or d>(now() at time zone 'Europe/Rome')::date then raise exception 'Inserisci una data effettiva, non futura' using errcode='22023';end if;
  if p_action='reverse' then
   select * into e from public.finance_entries where id=(p_values->>'entry_id')::uuid and user_id=owner;
   if not found or e.kind in ('opening','reversal') then raise exception 'Movimento non stornabile' using errcode='22023';end if;
   if exists(select 1 from public.finance_entries where reverses_id=e.id) then raise exception 'Movimento già stornato' using errcode='40001';end if;
   if d<e.entry_date then raise exception 'Lo storno non può precedere il movimento' using errcode='22023';end if;
   select * into a from public.finance_accounts where id=e.account_id and user_id=owner for update;
  else select * into a from public.finance_accounts where id=(p_values->>'account_id')::uuid and user_id=owner for update;end if;
  if not found then raise exception 'Fondo non disponibile nella squadra' using errcode='42501';end if;
  if d<a.opened_on or (a.closed_through is not null and d<=a.closed_through) then raise exception 'Data precedente all’apertura o periodo già chiuso' using errcode='22023';end if;
  description:=btrim(coalesce(p_values->>'description',''));
  if char_length(description) not between 1 and 1000 then raise exception 'Inserisci una descrizione entro 1000 caratteri' using errcode='22023';end if;
  if p_action='entry' then
   amount:=(p_values->>'amount_cents')::bigint;category:=p_values->>'category';activity:=nullif(p_values->>'activity_id','')::uuid;
   if amount is null or amount<=0 or amount>10000000000 or p_values->>'kind' not in ('income','expense') or p_values->>'kind' is null then raise exception 'Importo o tipo movimento non valido' using errcode='22023';end if;
   if category is null or category not in ('Sponsor','Contributi','Materiale','Campi','Trasferte','Rimborsi','Altro') then raise exception 'Categoria non valida' using errcode='22023';end if;
   if activity is not null and not exists(select 1 from public.activities where id=activity and user_id=owner) then raise exception 'Attività non disponibile nella squadra' using errcode='42501';end if;
   if coalesce((p_values->>'allow_duplicate')::boolean,false)=false and exists(select 1 from public.finance_entries x where x.user_id=owner and x.account_id=a.id and x.entry_date=d and x.kind=p_values->>'kind' and abs(x.amount_cents)=amount and lower(x.description)=lower(finance_mutate.description) and not exists(select 1 from public.finance_entries y where y.reverses_id=x.id)) then raise exception 'Possibile duplicato: esiste già un movimento con data, importo e descrizione uguali' using errcode='23505';end if;
   insert into public.finance_entries(user_id,account_id,entry_date,kind,economic_type,amount_cents,category,description,activity_id,created_by,actor_label) values(owner,a.id,d,p_values->>'kind',p_values->>'kind',case when p_values->>'kind'='expense' then -amount else amount end,category,description,activity,actor,label) returning id into entry_id;
   result:=jsonb_build_object('id',entry_id);
  elsif p_action='transfer' then
   select * into b from public.finance_accounts where id=(p_values->>'destination_id')::uuid and user_id=owner for update;
   if not found or b.id=a.id then raise exception 'Seleziona un fondo di destinazione diverso, della stessa squadra' using errcode='42501';end if;
   if d<b.opened_on or (b.closed_through is not null and d<=b.closed_through) then raise exception 'Destinazione: apertura o periodo chiuso incompatibile' using errcode='22023';end if;
   amount:=(p_values->>'amount_cents')::bigint;if amount is null or amount<=0 or amount>10000000000 then raise exception 'Importo non valido' using errcode='22023';end if;
   transfer:=gen_random_uuid();
   insert into public.finance_entries(user_id,account_id,entry_date,kind,economic_type,amount_cents,category,description,transfer_id,created_by,actor_label) values(owner,a.id,d,'transfer','transfer',-amount,'Trasferimento',description,transfer,actor,label) returning id into entry_id;
   insert into public.finance_entries(user_id,account_id,entry_date,kind,economic_type,amount_cents,category,description,transfer_id,created_by,actor_label) values(owner,b.id,d,'transfer','transfer',amount,'Trasferimento',description,transfer,actor,label) returning id into second_id;
   result:=jsonb_build_object('id',entry_id,'second_id',second_id);
  elsif p_action='reverse' then
   if e.economic_type='transfer' then
    select * into b from public.finance_accounts where id=(select account_id from public.finance_entries where transfer_id=e.transfer_id and kind='transfer' and id<>e.id) and user_id=owner for update;
    if b.closed_through is not null and d<=b.closed_through then raise exception 'Il periodo dell’altro fondo è chiuso' using errcode='22023';end if;
   end if;
   insert into public.finance_entries(user_id,account_id,entry_date,kind,economic_type,amount_cents,category,description,activity_id,transfer_id,reverses_id,created_by,actor_label)
    select x.user_id,x.account_id,d,'reversal',x.economic_type,-x.amount_cents,x.category,left(finance_mutate.description||' · '||x.description,1000),x.activity_id,x.transfer_id,x.id,actor,label from public.finance_entries x where x.id=e.id or (e.transfer_id is not null and x.transfer_id=e.transfer_id and x.kind='transfer');
   result:=jsonb_build_object('id',e.id);
  else
   amount:=(p_values->>'amount_cents')::bigint;
   select coalesce(sum(amount_cents),0) into ledger from public.finance_entries where account_id=a.id and user_id=owner and entry_date<=d;
   if amount is null or abs(amount)>10000000000 then raise exception 'Saldo osservato non valido' using errcode='22023';end if;
   if coalesce((p_values->>'close_period')::boolean,false) and amount<>ledger then raise exception 'Il saldo osservato non coincide: verifica la differenza prima di chiudere' using errcode='22023';end if;
   insert into public.finance_reconciliations(user_id,account_id,checked_on,observed_cents,ledger_cents,closes_period,note,created_by,actor_label) values(owner,a.id,d,amount,ledger,coalesce((p_values->>'close_period')::boolean,false),description,actor,label) returning id into entry_id;
   if coalesce((p_values->>'close_period')::boolean,false) then update public.finance_accounts set closed_through=d where id=a.id;end if;
   result:=jsonb_build_object('id',entry_id,'difference_cents',amount-ledger);
  end if;
 elsif p_action='receipt' then
  select * into e from public.finance_entries where id=(p_values->>'entry_id')::uuid and user_id=owner;
  if not found then raise exception 'Movimento non disponibile nella squadra' using errcode='42501';end if;
  if split_part(p_values->>'object_path','/',1)<>owner::text or split_part(p_values->>'object_path','/',2)<>e.id::text then raise exception 'Percorso ricevuta non valido' using errcode='42501';end if;
  select metadata into object_meta from storage.objects where bucket_id='finance-receipts' and name=p_values->>'object_path';
  if not found or (object_meta->>'size')::bigint not between 1 and 10485760 or object_meta->>'mimetype' not in ('application/pdf','image/jpeg','image/png','image/webp') then raise exception 'Ricevuta assente o formato non valido' using errcode='22023';end if;
  insert into public.finance_receipts(user_id,entry_id,object_path,file_name,mime_type,size_bytes,created_by) values(owner,e.id,p_values->>'object_path',p_values->>'file_name',object_meta->>'mimetype',(object_meta->>'size')::bigint,actor) returning id into entry_id;
  result:=jsonb_build_object('id',entry_id);
 else raise exception 'Operazione non valida' using errcode='22023';end if;
 audit_id:=(result->>'id')::uuid;
 insert into public.finance_audit(user_id,action,entity_id,details,actor_id,actor_label) values(owner,p_action,audit_id,p_values-array['allow_duplicate'],actor,label);
 insert into private_access.finance_requests(user_id,request_id,payload,result) values(owner,p_request_id,payload,result);
 return result;
end $$;
revoke all on function private_access.finance_mutate(text,jsonb,uuid) from public,anon;
grant execute on function private_access.finance_mutate(text,jsonb,uuid) to authenticated;
create function public.finance_mutate(p_action text,p_values jsonb,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private_access.finance_mutate(p_action,p_values,p_request_id)$$;
revoke all on function public.finance_mutate(text,jsonb,uuid) from public,anon;
grant execute on function public.finance_mutate(text,jsonb,uuid) to authenticated;

create function public.finance_snapshot(p_from date,p_to date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare owner uuid:=private_access.team_owner(); result jsonb;
begin
 if auth.uid() is null or owner is null or private_access.team_role() not in ('admin','treasurer','president') then raise exception 'Accesso economico non consentito' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Periodo non valido' using errcode='22023';end if;
 select jsonb_build_object(
 'accounts',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('balance_cents',coalesce((select sum(amount_cents) from public.finance_entries where account_id=a.id and entry_date<=p_to),0))) from public.finance_accounts a where a.user_id=owner),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(to_jsonb(x)) from (select e.*,exists(select 1 from public.finance_entries r where r.reverses_id=e.id) as reversed,coalesce((select jsonb_agg(to_jsonb(f)) from public.finance_receipts f where f.entry_id=e.id),'[]'::jsonb) as receipts from public.finance_entries e where user_id=owner and entry_date between p_from and p_to order by entry_date desc,created_at desc,id limit 100) x),'[]'::jsonb),
 'entry_count',(select count(*) from public.finance_entries where user_id=owner and entry_date between p_from and p_to),
 'totals',(select jsonb_build_object('opening',coalesce(sum(amount_cents) filter(where entry_date<p_from),0),'closing',coalesce(sum(amount_cents),0),'initial',coalesce(sum(amount_cents) filter(where entry_date>=p_from and economic_type='opening'),0),'income',coalesce(sum(amount_cents) filter(where entry_date>=p_from and economic_type='income'),0),'expense',-coalesce(sum(amount_cents) filter(where entry_date>=p_from and economic_type='expense'),0)) from public.finance_entries where user_id=owner and entry_date<=p_to),
 'categories',coalesce((select jsonb_agg(to_jsonb(c)) from (select category,economic_type,sum(amount_cents) as amount_cents from public.finance_entries where user_id=owner and entry_date between p_from and p_to and economic_type in ('income','expense') group by category,economic_type order by category) c),'[]'::jsonb),
 'reconciliations',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from public.finance_reconciliations where user_id=owner order by created_at desc,id limit 30) r),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(to_jsonb(h)) from (select * from public.finance_audit where user_id=owner order by created_at desc,id limit 50) h),'[]'::jsonb)
 ) into result;return result;
end $$;
revoke all on function public.finance_snapshot(date,date) from public,anon;
grant execute on function public.finance_snapshot(date,date) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('finance-receipts','finance-receipts',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy finance_storage_read on storage.objects for select to authenticated using(bucket_id='finance-receipts' and (select private_access.team_role()) in ('admin','treasurer','president') and exists(select 1 from public.finance_receipts r where r.object_path=name and r.user_id=(select private_access.team_owner())));
create policy finance_storage_upload on storage.objects for insert to authenticated with check(bucket_id='finance-receipts' and (select private_access.team_role()) in ('admin','treasurer') and (storage.foldername(name))[1]=(select private_access.team_owner())::text and exists(select 1 from public.finance_entries e where e.id::text=(storage.foldername(name))[2] and e.user_id=(select private_access.team_owner())));
create policy finance_storage_orphan_cleanup on storage.objects for delete to authenticated using(bucket_id='finance-receipts' and owner_id=(select auth.uid())::text and (select private_access.team_role()) in ('admin','treasurer') and (storage.foldername(name))[1]=(select private_access.team_owner())::text and not exists(select 1 from public.finance_receipts r where r.object_path=name));
