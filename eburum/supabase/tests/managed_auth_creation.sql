begin;
do $$declare owner uuid; uid uuid; role_name text; blocked boolean;begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 foreach role_name in array array['admin','manager','coach','secretary'] loop
  uid:=gen_random_uuid();
  -- Reproduce GoTrue: app_metadata is not populated during INSERT.
  insert into auth.users(id,raw_app_meta_data) values(uid,'{"provider":"email"}');
  if exists(select 1 from public.team_members where user_id=uid) then raise exception 'Membership assigned too early';end if;
  update auth.users set raw_app_meta_data=raw_app_meta_data||jsonb_build_object('managed_account',true,'created_by',owner,'team_role',role_name) where id=uid;
  set constraints auth.eburum_finalize_managed_account immediate;
  if not exists(select 1 from public.team_members where user_id=uid and owner_id=owner and role=role_name) then raise exception 'Membership missing or incorrect';end if;
  set constraints auth.eburum_finalize_managed_account deferred;
 end loop;
 blocked:=false;begin
  insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values(gen_random_uuid(),'{}','{"managed_account":true,"team_role":"admin"}');
  set constraints auth.eburum_finalize_managed_account immediate;
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Public registration or user_metadata escalation allowed';end if;
 set constraints auth.eburum_finalize_managed_account deferred;
 blocked:=false;begin
  insert into auth.users(id,raw_app_meta_data) values(gen_random_uuid(),jsonb_build_object('managed_account',true,'created_by',gen_random_uuid(),'team_role','coach'));
  set constraints auth.eburum_finalize_managed_account immediate;
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Invalid admin accepted';end if;
 set constraints auth.eburum_finalize_managed_account deferred;
 blocked:=false;begin
  insert into auth.users(id,raw_app_meta_data) values(gen_random_uuid(),jsonb_build_object('managed_account',true,'created_by',owner,'team_role','invalid'));
  set constraints auth.eburum_finalize_managed_account immediate;
 exception when invalid_parameter_value then blocked:=true;end;
 if not blocked then raise exception 'Invalid role accepted';end if;
end $$;
rollback;
