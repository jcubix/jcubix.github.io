begin;
do $$declare owner uuid; secretary uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid();begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 insert into auth.users(id,raw_app_meta_data) values(secretary,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','secretary')),(outsider,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','manager'));
 set constraints auth.eburum_finalize_managed_account immediate;
 if (select role from public.team_members where user_id=secretary)<>'secretary' then raise exception 'Secretary assignment failed';end if;
 insert into public.players(id,user_id,surname,name,role,active) values(pid,owner,'Synthetic secretary','Test','Difensore',true);
 insert into public.activities(id,user_id,activity_type,activity_date,title) values(aid,owner,'Allenamento','2300-05-01','Synthetic secretary activity');
 insert into public.activity_technical(activity_id,user_id,note) values(aid,owner,'Private technical note');
 perform set_config('test.owner',owner::text,true);perform set_config('test.secretary',secretary::text,true);perform set_config('test.outsider',outsider::text,true);perform set_config('test.player',pid::text,true);perform set_config('test.activity',aid::text,true);
 perform set_config('request.jwt.claim.sub',secretary::text,true);
end $$;
set local role authenticated;
do $$declare owner uuid:=current_setting('test.owner')::uuid; pid uuid:=current_setting('test.player')::uuid; aid uuid:=current_setting('test.activity')::uuid; blocked boolean; n integer;begin
 if private_access.team_role()<>'secretary' then raise exception 'Wrong authoritative role';end if;
 insert into public.player_administration(user_id,player_id,registration_status,certificate_until) values(owner,pid,'Da verificare','2300-06-01');
 update public.player_administration set registration_status='In regola' where player_id=pid;get diagnostics n=row_count;if n<>1 then raise exception 'Secretary cannot edit administration';end if;
 update public.players set name='Administrative update' where id=pid;get diagnostics n=row_count;if n<>1 then raise exception 'Secretary cannot edit roster';end if;
 if not exists(select 1 from public.player_administration where player_id=pid and registration_status='In regola') then raise exception 'Secretary cannot read administration';end if;
 if exists(select 1 from public.activity_technical where activity_id=aid) then raise exception 'Technical notes leaked';end if;
 if exists(select 1 from public.team_members where user_id<>auth.uid()) then raise exception 'Staff membership leaked';end if;
 blocked:=false;begin insert into public.sessions(user_id,session_date,session_type) values(owner,'2300-05-01','Allenamento');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Secretary can create actual attendance';end if;
 blocked:=false;begin perform public.save_team_activity(jsonb_build_object('activity_type','Allenamento','activity_date','2300-05-01','title','Forbidden','status','Programmato'), '[]');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Secretary can create activity through RPC';end if;
 update public.activities set title='Forbidden' where id=aid;get diagnostics n=row_count;if n<>0 then raise exception 'Secretary can update sporting data';end if;
 blocked:=false;begin insert into public.player_administration(user_id,player_id,registration_status) values(current_setting('test.outsider')::uuid,pid,'Da verificare');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Cross-team administration write allowed';end if;
 blocked:=false;begin update public.team_members set role='admin' where user_id=auth.uid();exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Self promotion allowed';end if;
end $$;
rollback;
