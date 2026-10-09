begin;
do $$declare owner uuid; staff uuid:=gen_random_uuid(); secretary uuid:=gen_random_uuid(); outside uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); mid uuid:=gen_random_uuid(); served uuid:=gen_random_uuid(); future uuid:=gen_random_uuid(); last_event uuid; eid uuid;
begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 insert into auth.users(id,raw_app_meta_data) values
 (staff,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','coach')),
 (secretary,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','secretary')),
 (outside,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','coach'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=outside where user_id=outside;
 insert into public.players(id,user_id,surname,name,role,active) values(pid,owner,'Synthetic discipline','Test','Difensore',false);
 insert into public.matches(id,user_id,match_date,opponent,venue) values(mid,owner,current_date-10,'Synthetic cards','Casa'),(served,owner,current_date-1,'Synthetic served','Casa'),(future,owner,current_date+1,'Synthetic future','Casa');
 for i in 1..5 loop
 eid:=gen_random_uuid();insert into public.match_events(id,user_id,match_id,player_id,event_type,minute) values(eid,owner,mid,pid,'Ammonizione',i);last_event:=eid;
 end loop;
 perform set_config('test.owner',owner::text,true);perform set_config('test.staff',staff::text,true);perform set_config('test.secretary',secretary::text,true);perform set_config('test.outside',outside::text,true);perform set_config('test.player',pid::text,true);perform set_config('test.milestone',last_event::text,true);perform set_config('test.served',served::text,true);perform set_config('test.future',future::text,true);
 perform set_config('request.jwt.claim.sub',staff::text,true);
end $$;
set local role authenticated;
do $$declare owner uuid:=current_setting('test.owner')::uuid;pid uuid:=current_setting('test.player')::uuid;eid uuid:=current_setting('test.milestone')::uuid;sid uuid:=current_setting('test.served')::uuid;season date:=make_date(extract(year from current_date)::integer,7,1);cid uuid;blocked boolean;
begin
 blocked:=false;begin insert into public.disciplinary_clearances(user_id,player_id,season_start,threshold_event_id,served_match_id) values(owner,pid,season,eid,current_setting('test.future')::uuid);exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Future clearance allowed';end if;
 insert into public.disciplinary_clearances(user_id,player_id,season_start,threshold_event_id,served_match_id,confirmed_by) values(owner,pid,season,eid,sid,owner) returning id into cid;
 if not exists(select 1 from public.disciplinary_clearances where id=cid and confirmed_by=auth.uid()) then raise exception 'Actor spoofing or missing shared read';end if;
 blocked:=false;begin insert into public.disciplinary_clearances(user_id,player_id,season_start,threshold_event_id,served_match_id) values(owner,pid,season,eid,sid);exception when unique_violation then blocked:=true;end;if not blocked then raise exception 'Duplicate clearance accepted';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.secretary'),true);
 if not exists(select 1 from public.disciplinary_clearances where id=cid) then raise exception 'Secretary cannot read';end if;
 delete from public.disciplinary_clearances where id=cid;if not exists(select 1 from public.disciplinary_clearances where id=cid) then raise exception 'Secretary erased confirmation';end if;
 blocked:=false;begin update public.disciplinary_clearances set confirmed_by=auth.uid() where id=cid;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Direct update allowed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.outside'),true);
 if exists(select 1 from public.disciplinary_clearances where id=cid) then raise exception 'Cross-team read';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.staff'),true);
 delete from public.disciplinary_clearances where id=cid;if exists(select 1 from public.disciplinary_clearances where id=cid) then raise exception 'Staff cannot undo';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.secretary'),true);
 blocked:=false;begin insert into public.disciplinary_clearances(user_id,player_id,season_start,threshold_event_id,served_match_id) values(owner,pid,season,eid,sid);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Secretary created confirmation';end if;
end $$;
set local role anon;
do $$declare blocked boolean:=false;begin begin perform * from public.disciplinary_clearances;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous read';end if;end $$;
rollback;
