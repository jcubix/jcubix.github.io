create or replace function private_access.finance_mutate(p_action text,p_values jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
<<finance_mutate>>
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
 elsif p_action in ('account_edit','account_remove','account_restore') then
  select * into a from public.finance_accounts where id=(p_values->>'account_id')::uuid and user_id=owner for update;
  if not found then raise exception 'Fondo non disponibile nella squadra' using errcode='42501';end if;
  if a.name is distinct from p_values->>'expected_name' or a.kind is distinct from p_values->>'expected_kind' then raise exception 'Fondo modificato nel frattempo. Ricarica Economia.' using errcode='40001';end if;
  if p_action='account_edit' then
   if a.archived_at is not null then raise exception 'Riattiva prima il fondo' using errcode='22023';end if;
   if char_length(btrim(coalesce(p_values->>'name',''))) not between 1 and 100 or p_values->>'kind' is null or p_values->>'kind' not in ('cash','bank') then raise exception 'Nome o tipo fondo non valido' using errcode='22023';end if;
   update public.finance_accounts set name=btrim(p_values->>'name'),kind=p_values->>'kind' where id=a.id;
   result:=jsonb_build_object('id',a.id);
  elsif p_action='account_restore' then
   update public.finance_accounts set archived_at=null where id=a.id;
   result:=jsonb_build_object('id',a.id);
  else
   select coalesce(sum(amount_cents),0) into ledger from public.finance_entries where account_id=a.id;
   if coalesce((p_values->>'remove_unused_initial')::boolean,false)
      and a.closed_through is null
      and not exists(select 1 from public.finance_entries where account_id=a.id and kind<>'opening')
      and not exists(select 1 from public.finance_reconciliations where account_id=a.id)
      and not exists(select 1 from public.finance_receipts r join public.finance_entries initial_entry on initial_entry.id=r.entry_id where initial_entry.account_id=a.id) then
    select coalesce(jsonb_agg(to_jsonb(initial_entry)),'[]'::jsonb) into object_meta from public.finance_entries initial_entry where initial_entry.account_id=a.id;
    delete from public.finance_entries where account_id=a.id;
    delete from public.finance_accounts where id=a.id;
    result:=jsonb_build_object('id',a.id,'archived',false,'removed_initial',true);
    insert into public.finance_audit(user_id,action,entity_id,details,actor_id,actor_label)
     values(owner,'unused_initial_removed',a.id,jsonb_build_object('account',to_jsonb(a),'initial_entries',object_meta),actor,label);
   else
   if ledger<>0 then raise exception 'Il fondo contiene ancora denaro. Se è stato usato, trasferisci il saldo reale prima di archiviarlo. Un fondo con solo saldo iniziale può essere rimosso confermando l’eliminazione.' using errcode='22023';end if;
   if exists(select 1 from public.finance_entries where account_id=a.id) or exists(select 1 from public.finance_reconciliations where account_id=a.id) then
    update public.finance_accounts set archived_at=coalesce(archived_at,now()) where id=a.id;
    result:=jsonb_build_object('id',a.id,'archived',true);
   else
    delete from public.finance_accounts where id=a.id;
    result:=jsonb_build_object('id',a.id,'archived',false);
   end if;
   end if;
  end if;
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
  if a.archived_at is not null then raise exception 'Fondo archiviato. Riattivalo prima di registrare movimenti.' using errcode='22023';end if;
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
   if b.archived_at is not null then raise exception 'Fondo di destinazione archiviato' using errcode='22023';end if;
   if d<b.opened_on or (b.closed_through is not null and d<=b.closed_through) then raise exception 'Destinazione: apertura o periodo chiuso incompatibile' using errcode='22023';end if;
   amount:=(p_values->>'amount_cents')::bigint;if amount is null or amount<=0 or amount>10000000000 then raise exception 'Importo non valido' using errcode='22023';end if;
   transfer:=gen_random_uuid();
   insert into public.finance_entries(user_id,account_id,entry_date,kind,economic_type,amount_cents,category,description,transfer_id,created_by,actor_label) values(owner,a.id,d,'transfer','transfer',-amount,'Trasferimento',description,transfer,actor,label) returning id into entry_id;
   insert into public.finance_entries(user_id,account_id,entry_date,kind,economic_type,amount_cents,category,description,transfer_id,created_by,actor_label) values(owner,b.id,d,'transfer','transfer',amount,'Trasferimento',description,transfer,actor,label) returning id into second_id;
   result:=jsonb_build_object('id',entry_id,'second_id',second_id);
  elsif p_action='reverse' then
   if e.economic_type='transfer' then
    select * into b from public.finance_accounts where id=(select account_id from public.finance_entries where transfer_id=e.transfer_id and kind='transfer' and id<>e.id) and user_id=owner for update;
    if b.archived_at is not null then raise exception 'Riattiva anche l’altro fondo prima di stornare il trasferimento' using errcode='22023';end if;
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
