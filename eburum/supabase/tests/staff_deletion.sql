-- Synthetic team only: revocation, retained attribution and owner protection all roll back.
begin;
do $$declare creator uuid; owner uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid();begin
 select user_id into creator from public.team_members where role='admin' limit 1;
 insert into auth.users(id,raw_app_meta_data) values(owner,jsonb_build_object('managed_account',true,'created_by',creator,'team_role','admin'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=owner where user_id=owner;
 insert into auth.users(id,email,raw_app_meta_data) values(staff,'deletion-test@example.invalid',jsonb_build_object('managed_account',true,'created_by',owner,'team_role','treasurer'));
 perform set_config('test.deletion.owner',owner::text,true);perform set_config('test.deletion.staff',staff::text,true);
 perform set_config('request.jwt.claim.sub',staff::text,true);
end $$;
set local role authenticated;
do $$declare account uuid;entry uuid;begin
 account:=(public.finance_mutate('account',jsonb_build_object('name','Deletion fixture','kind','cash','date',current_date,'amount_cents',0),gen_random_uuid())->>'id')::uuid;
 entry:=(public.finance_mutate('entry',jsonb_build_object('account_id',account,'kind','income','date',current_date,'amount_cents',100,'category','Altro','description','Retained staff attribution'),gen_random_uuid())->>'id')::uuid;
 perform set_config('test.deletion.entry',entry::text,true);
 insert into public.staff_communications(user_id,title,body,retention_days) values(private_access.team_owner(),'Deletion fixture','Retained communication',1);
end $$;
reset role;
do $$declare staff uuid:=current_setting('test.deletion.staff')::uuid; owner uuid:=current_setting('test.deletion.owner')::uuid;begin
 update auth.users set email='corrected-deletion-test@example.invalid' where id=staff;
 if not exists(select 1 from public.team_members where user_id=staff) then raise exception 'Email update revoked membership';end if;
 update auth.users set deleted_at=now() where id=staff;
 if exists(select 1 from public.team_members where user_id=staff) then raise exception 'Deleted member retains permissions';end if;
 if not exists(select 1 from auth.users where id=staff and deleted_at is not null) then raise exception 'Historical identity lost';end if;
 if not exists(select 1 from public.finance_entries where id=current_setting('test.deletion.entry')::uuid and created_by=staff and user_id=owner and actor_label='deletion-test@example.invalid') then raise exception 'Accounting attribution changed';end if;
 if not exists(select 1 from public.staff_communications where user_id=owner and created_by=staff and title='Deletion fixture') then raise exception 'Communication lost';end if;
 begin
  update auth.users set deleted_at=now() where id=owner;
  raise exception 'Owner deletion allowed';
 exception when insufficient_privilege then null;end;
 if not exists(select 1 from public.team_members where user_id=owner and role='admin') then raise exception 'Owner membership lost';end if;
end $$;
-- A still-unexpired JWT must no longer authorize data reads or mutations.
set local role authenticated;
do $$begin
 if private_access.team_owner() is not null or private_access.team_role() is not null then raise exception 'Stale JWT retains membership';end if;
 if exists(select 1 from public.finance_entries) or exists(select 1 from public.staff_communications) then raise exception 'Stale JWT can read team data';end if;
 begin
  perform public.finance_mutate('account',jsonb_build_object('name','Denied','kind','cash','date',current_date,'amount_cents',0),gen_random_uuid());
  raise exception 'Deleted member can mutate finance';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
