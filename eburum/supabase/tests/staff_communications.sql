begin;
do $$declare owner uuid;writer uuid:=gen_random_uuid();reader uuid:=gen_random_uuid();outside uuid:=gen_random_uuid();
begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 insert into auth.users(id,raw_app_meta_data) values(writer,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','coach')),(reader,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','secretary')),(outside,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','manager'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=outside where user_id=outside;
 perform set_config('test.owner',owner::text,true);perform set_config('test.writer',writer::text,true);perform set_config('test.reader',reader::text,true);perform set_config('test.outside',outside::text,true);perform set_config('request.jwt.claim.sub',writer::text,true);
end $$;
set local role authenticated;
do $$declare owner uuid:=current_setting('test.owner')::uuid;msg public.staff_communications;blocked boolean; n integer;
begin
 foreach n in array array[1,3,7] loop
 insert into public.staff_communications(user_id,title,body,retention_days,created_by,author_label,created_at,expires_at)
 values(owner,' Synthetic TTL ',' Shared body ',n,owner,'Spoof',now()-interval '1 year',now()+interval '1 year') returning * into msg;
 if msg.created_by<>auth.uid() or msg.created_at<>now() or msg.expires_at<>now()+make_interval(hours=>24*n) or msg.title<>'Synthetic TTL' or msg.author_label='Spoof' then raise exception 'Lifetime or actor spoofing';end if;
 end loop;
 perform set_config('test.message',msg.id::text,true);
 blocked:=false;begin insert into public.staff_communications(user_id,title,body,retention_days) values(owner,'Bad','Bad',2);exception when check_violation then blocked:=true;end;if not blocked then raise exception 'Invalid duration accepted';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.reader'),true);
 if not exists(select 1 from public.staff_communications where id=msg.id) then raise exception 'Secretary cannot read';end if;
 delete from public.staff_communications where id=msg.id;if not exists(select 1 from public.staff_communications where id=msg.id) then raise exception 'Reader erased another author';end if;
 insert into public.staff_communications(user_id,title,body,retention_days) values(owner,'Secretary notice','Shared secretary notice',1) returning * into msg;
 delete from public.staff_communications where id=msg.id;if exists(select 1 from public.staff_communications where id=msg.id) then raise exception 'Author cannot remove';end if;
 blocked:=false;begin update public.staff_communications set expires_at=now()+interval '1 year';exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Expiry extension allowed';end if;
 blocked:=false;begin perform private_access.purge_expired_communications();exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Client purge privilege';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.outside'),true);
 if exists(select 1 from public.staff_communications where id=current_setting('test.message')::uuid) then raise exception 'Cross-team read';end if;
 blocked:=false;begin insert into public.staff_communications(user_id,title,body,retention_days) values(owner,'Cross team','Forbidden',1);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Cross-team publish';end if;
end $$;
reset role;
update public.staff_communications set created_at=now()-interval '8 days',expires_at=now()-interval '1 second' where id=current_setting('test.message')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.writer'),true);
do $$begin if exists(select 1 from public.staff_communications where id=current_setting('test.message')::uuid) then raise exception 'Expired notice remains visible';end if;end $$;
reset role;
do $$begin perform private_access.purge_expired_communications();if exists(select 1 from public.staff_communications where id=current_setting('test.message')::uuid) then raise exception 'Expired notice not purged';end if;if not exists(select 1 from public.staff_communications where title='Synthetic TTL' and created_by=current_setting('test.writer')::uuid) then raise exception 'Active notice purged';end if;end $$;
set local role anon;
do $$declare blocked boolean:=false;begin begin perform * from public.staff_communications;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous notice read';end if;end $$;
rollback;
