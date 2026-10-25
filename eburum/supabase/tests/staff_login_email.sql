begin;
do $$declare owner uuid; test_id uuid:=gen_random_uuid(); before_role text;begin
 select user_id into owner from public.team_members where role='admin' limit 1;
 insert into auth.users(id,email,raw_app_meta_data) values(test_id,'synthetic-old@example.test',jsonb_build_object('managed_account',true,'created_by',owner,'team_role','coach'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set first_name='Synthetic',last_name='Staff' where user_id=test_id;
 select role into before_role from public.team_members where user_id=test_id;
 update auth.users set email='synthetic-new@example.test' where id=test_id;
 if not exists(select 1 from public.team_members where user_id=test_id and display_name='synthetic-new@example.test' and role=before_role and owner_id=owner and first_name='Synthetic' and last_name='Staff') then
  raise exception 'Email sync changed membership or failed';
 end if;
 if (select count(*) from public.team_members where user_id=test_id)<>1 then raise exception 'Duplicate membership';end if;
end $$;
select 'Staff login email synchronizes without replacing account, team role or names; synthetic fixtures roll back' result;
rollback;
