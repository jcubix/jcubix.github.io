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
do $$declare a uuid;b uuid;empty_id uuid;request uuid:=gen_random_uuid(); result jsonb;before_entries bigint; blocked boolean;begin
 empty_id:=(public.finance_mutate('account',jsonb_build_object('name','Empty','kind','cash','date',current_date,'amount_cents',0),gen_random_uuid())->>'id')::uuid;
 result:=public.finance_mutate('account_remove',jsonb_build_object('account_id',empty_id,'expected_name','Empty','expected_kind','cash'),request);
 if exists(select 1 from public.finance_accounts where id=empty_id) then raise exception 'Empty account not deleted';end if;
 if public.finance_mutate('account_remove',jsonb_build_object('account_id',empty_id,'expected_name','Empty','expected_kind','cash'),request) is distinct from result then raise exception 'Delete replay failed';end if;
 empty_id:=(public.finance_mutate('account',jsonb_build_object('name','Initial test','kind','cash','date',current_date,'amount_cents',20000),gen_random_uuid())->>'id')::uuid;
 result:=public.finance_mutate('account_remove',jsonb_build_object('account_id',empty_id,'expected_name','Initial test','expected_kind','cash','remove_unused_initial',true),gen_random_uuid());
 if exists(select 1 from public.finance_accounts where id=empty_id) or exists(select 1 from public.finance_entries where account_id=empty_id) or not (result->>'removed_initial')::boolean then raise exception 'Initial-only removal failed';end if;
 if not exists(select 1 from public.finance_audit where entity_id=empty_id and action='unused_initial_removed' and details->'initial_entries'->0->>'amount_cents'='20000') then raise exception 'Initial-only audit missing';end if;
 a:=(public.finance_mutate('account',jsonb_build_object('name','Cash','kind','cash','date',current_date,'amount_cents',1000),gen_random_uuid())->>'id')::uuid;
 b:=(public.finance_mutate('account',jsonb_build_object('name','Bank','kind','bank','date',current_date,'amount_cents',0),gen_random_uuid())->>'id')::uuid;
 blocked:=false;begin perform public.finance_mutate('account_remove',jsonb_build_object('account_id',a,'expected_name','Cash','expected_kind','cash'),gen_random_uuid());exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Nonzero account deleted';end if;
 perform public.finance_mutate('account_edit',jsonb_build_object('account_id',a,'name','Team cash','kind','cash','expected_name','Cash','expected_kind','cash'),gen_random_uuid());
 if (select name from public.finance_accounts where id=a)<>'Team cash' or (select sum(amount_cents) from public.finance_entries where account_id=a)<>1000 then raise exception 'Edit altered ledger';end if;
 blocked:=false;begin perform public.finance_mutate('account_edit',jsonb_build_object('account_id',a,'name','Stale','kind','cash','expected_name','Cash','expected_kind','cash'),gen_random_uuid());exception when serialization_failure then blocked:=true;end;if not blocked then raise exception 'Stale edit accepted';end if;
 perform public.finance_mutate('transfer',jsonb_build_object('account_id',a,'destination_id',b,'date',current_date,'description','Close cash','amount_cents',1000),gen_random_uuid());
 blocked:=false;begin perform public.finance_mutate('account_remove',jsonb_build_object('account_id',b,'expected_name','Bank','expected_kind','bank','remove_unused_initial',true),gen_random_uuid());exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Used nonzero fund removed';end if;
 select count(*) into before_entries from public.finance_entries;
 result:=public.finance_mutate('account_remove',jsonb_build_object('account_id',a,'expected_name','Team cash','expected_kind','cash'),gen_random_uuid());
 if not (result->>'archived')::boolean or not exists(select 1 from public.finance_accounts where id=a and archived_at is not null) or (select count(*) from public.finance_entries)<>before_entries then raise exception 'Archive lost history';end if;
 blocked:=false;begin perform public.finance_mutate('entry',jsonb_build_object('account_id',a,'date',current_date,'description','Forbidden','amount_cents',1,'kind','income','category','Altro'),gen_random_uuid());exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Archived account accepted entry';end if;
 perform public.finance_mutate('account_restore',jsonb_build_object('account_id',a,'expected_name','Team cash','expected_kind','cash'),gen_random_uuid());
 if exists(select 1 from public.finance_accounts where id=a and archived_at is not null) then raise exception 'Restore failed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.finance.owner'),true);
 perform public.finance_mutate('account_edit',jsonb_build_object('account_id',a,'name','Admin cash','kind','cash','expected_name','Team cash','expected_kind','cash'),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',current_setting('test.finance.president'),true);
 for result in select to_jsonb(v) from (values ('account_edit'),('account_remove'),('account_restore')) x(v) loop
  blocked:=false;begin perform public.finance_mutate(result#>>'{}',jsonb_build_object('account_id',a,'expected_name','Admin cash','expected_kind','cash'),gen_random_uuid());exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'President managed account';end if;
 end loop;
 perform set_config('request.jwt.claim.sub',current_setting('test.finance.outsider'),true);
 blocked:=false;begin perform public.finance_mutate('account_remove',jsonb_build_object('account_id',a,'expected_name','Admin cash','expected_kind','cash'),gen_random_uuid());exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Cross-team deletion permitted';end if;
end $$;
reset role;
select 'account edit, empty deletion, deletion replay, zero-balance archive, history retention, restore, stale edits and role isolation passed' result;
rollback;
