-- Isolated synthetic team; all fixtures, ledger and storage metadata roll back.
begin;
do $$
declare creator uuid; owner uuid:=gen_random_uuid(); treasurer uuid:=gen_random_uuid(); president uuid:=gen_random_uuid(); coach uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
begin
 select user_id into creator from public.team_members where role='admin' limit 1;
 insert into auth.users(id,raw_app_meta_data) values(owner,jsonb_build_object('managed_account',true,'created_by',creator,'team_role','admin'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=owner where user_id=owner;
 insert into auth.users(id,raw_app_meta_data) values
 (treasurer,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','treasurer')),
 (president,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','president')),
 (coach,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','coach')),
 (outsider,jsonb_build_object('managed_account',true,'created_by',creator,'team_role','treasurer'));
 perform set_config('test.finance.owner',owner::text,true);perform set_config('test.finance.treasurer',treasurer::text,true);
 perform set_config('test.finance.president',president::text,true);perform set_config('test.finance.coach',coach::text,true);perform set_config('test.finance.outsider',outsider::text,true);
 perform set_config('request.jwt.claim.sub',treasurer::text,true);
end $$;
set local role authenticated;
do $$
declare a uuid; b uuid; e uuid; transfer uuid; req uuid:=gen_random_uuid(); value jsonb; original jsonb; snap jsonb; blocked boolean; n integer;
begin
 if private_access.team_role()<>'treasurer' then raise exception 'Treasurer authoritative role missing';end if;
 original:=jsonb_build_object('name','Synthetic cash','kind','cash','date',current_date-2,'amount_cents',10000);
 value:=public.finance_mutate('account',original,req);a:=(value->>'id')::uuid;
 if public.finance_mutate('account',original,req)<>value then raise exception 'Replay changed response';end if;
 if (select count(*) from public.finance_accounts)<>1 then raise exception 'Replay duplicated account';end if;
 blocked:=false;begin perform public.finance_mutate('account',original||'{"name":"Changed"}',req);exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Reused request accepted';end if;
 value:=public.finance_mutate('account',jsonb_build_object('name','Synthetic bank','kind','bank','date',current_date-2,'amount_cents',0),gen_random_uuid());b:=(value->>'id')::uuid;
 original:=jsonb_build_object('account_id',a,'kind','income','date',current_date-1,'amount_cents',1234,'category','Sponsor','description','Synthetic income');
 value:=public.finance_mutate('entry',original,gen_random_uuid());e:=(value->>'id')::uuid;
 blocked:=false;begin perform public.finance_mutate('entry',original,gen_random_uuid());exception when unique_violation then blocked:=true;end;if not blocked then raise exception 'Duplicate not detected';end if;
 value:=public.finance_mutate('entry',original||'{"kind":"expense","category":"Materiale","description":"Synthetic expense","amount_cents":234}',gen_random_uuid());
 value:=public.finance_mutate('transfer',jsonb_build_object('account_id',a,'destination_id',b,'date',current_date-1,'amount_cents',3000,'description','Synthetic transfer'),gen_random_uuid());transfer:=(value->>'id')::uuid;
 snap:=public.finance_snapshot(current_date-2,current_date);
 if (snap->'totals'->>'closing')::bigint<>11000 or (snap->'totals'->>'income')::bigint<>1234 or (snap->'totals'->>'expense')::bigint<>234 then raise exception 'Exact cent totals failed: %',snap;end if;
 if (select sum(amount_cents) from public.finance_entries where kind='transfer')<>0 or (select count(*) from public.finance_entries where kind='transfer')<>2 then raise exception 'Transfer atomic legs failed';end if;
 perform public.finance_mutate('reverse',jsonb_build_object('entry_id',transfer,'date',current_date,'description','Correct transfer'),gen_random_uuid());
 if (select sum(amount_cents) from public.finance_entries where economic_type='transfer')<>0 or (select count(*) from public.finance_entries where kind='reversal')<>2 then raise exception 'Paired reversal failed';end if;
 blocked:=false;begin perform public.finance_mutate('reverse',jsonb_build_object('entry_id',transfer,'date',current_date,'description','Duplicate reversal'),gen_random_uuid());exception when serialization_failure then blocked:=true;end;if not blocked then raise exception 'Repeated reversal accepted';end if;
 blocked:=false;begin insert into public.finance_entries(user_id,account_id) values(private_access.team_owner(),a);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Direct ledger DML allowed';end if;
 if exists(select 1 from public.finance_entries where created_by<>auth.uid() or user_id<>private_access.team_owner()) then raise exception 'Server actor/owner stamp failed';end if;
 value:=public.finance_mutate('reconcile',jsonb_build_object('account_id',a,'date',current_date,'amount_cents',10900,'description','Mismatch','close_period',false),gen_random_uuid());
 if (value->>'difference_cents')::bigint<>-100 then raise exception 'Reconciliation difference failed';end if;
 blocked:=false;begin perform public.finance_mutate('reconcile',jsonb_build_object('account_id',a,'date',current_date,'amount_cents',10900,'description','Mismatch','close_period',true),gen_random_uuid());exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Mismatch closed period';end if;
 perform public.finance_mutate('reconcile',jsonb_build_object('account_id',a,'date',current_date,'amount_cents',11000,'description','Verified','close_period',true),gen_random_uuid());
 blocked:=false;begin perform public.finance_mutate('entry',original||'{"description":"Closed period"}',gen_random_uuid());exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Closed period edited';end if;
 blocked:=false;begin perform public.finance_mutate('entry',original||jsonb_build_object('account_id',b,'date',current_date+1),gen_random_uuid());exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Future actual movement accepted';end if;
 perform set_config('test.finance.entry',e::text,true);perform set_config('test.finance.account',a::text,true);
 insert into public.staff_communications(user_id,title,body,retention_days) values(private_access.team_owner(),'Synthetic treasury notice','Test',1);
 blocked:=false;begin insert into public.players(user_id,surname,name,role) values(private_access.team_owner(),'Forbidden','Treasurer','Difensore');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Treasurer sporting edit allowed';end if;
 if exists(select 1 from public.activity_technical) or exists(select 1 from public.player_administration) then raise exception 'Private data leaked';end if;
end $$;
reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('finance-receipts',current_setting('test.finance.owner')||'/'||current_setting('test.finance.entry')||'/test.pdf',current_setting('test.finance.treasurer'),'{"size":100,"mimetype":"application/pdf"}');
set local role authenticated;
do $$
declare value jsonb; blocked boolean; snap jsonb; a uuid:=current_setting('test.finance.account')::uuid; e uuid:=current_setting('test.finance.entry')::uuid;
begin
 value:=public.finance_mutate('receipt',jsonb_build_object('entry_id',e,'object_path',current_setting('test.finance.owner')||'/'||e||'/test.pdf','file_name','Receipt.pdf'),gen_random_uuid());
 if (select count(*) from storage.objects where bucket_id='finance-receipts')<>1 then raise exception 'Private receipt read failed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.finance.president'),true);
 snap:=public.finance_snapshot(current_date-2,current_date);if (snap->'totals'->>'closing')::bigint<>11000 then raise exception 'President read failed';end if;
 blocked:=false;begin perform public.finance_mutate('account','{}',gen_random_uuid());exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'President wrote finance';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.finance.coach'),true);
 if exists(select 1 from public.finance_entries) or exists(select 1 from storage.objects where bucket_id='finance-receipts') then raise exception 'Coach finance/receipt leak';end if;
 blocked:=false;begin perform public.finance_snapshot(current_date,current_date);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Coach finance snapshot allowed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.finance.outsider'),true);
 if exists(select 1 from public.finance_entries where account_id=a) or exists(select 1 from storage.objects where bucket_id='finance-receipts') then raise exception 'Cross-team finance leak';end if;
 blocked:=false;begin perform public.finance_mutate('reverse',jsonb_build_object('entry_id',e,'date',current_date,'description','Forbidden'),gen_random_uuid());exception when invalid_parameter_value or insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Cross-team mutation allowed';end if;
end $$;
reset role;
set constraints all immediate;
select 'treasury exact balances, atomic transfers, idempotency, reversals, period locks, receipts and role isolation passed; fixtures rolled back' result;
rollback;
