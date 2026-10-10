begin;
-- Synthetic records only; no staff credentials or retained writes.
do $$declare owner uuid; secretary uuid:=gen_random_uuid(); outside uuid:=gen_random_uuid();begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 insert into auth.users(id,raw_app_meta_data) values
 (secretary,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','secretary')),
 (outside,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','manager'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=outside where user_id=outside;
 perform set_config('test.owner',owner::text,true);perform set_config('test.secretary',secretary::text,true);
 perform set_config('test.outside',outside::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$declare owner uuid:=auth.uid(); p1 uuid; p2 uuid; p3 uuid; m uuid; aid uuid; e1 uuid; e2 uuid;
 manual uuid; manual_a uuid; revision integer; blocked boolean; n integer;begin
 insert into public.players(user_id,surname,name,active) values(owner,'Synthetic minutes','Starter',true) returning id into p1;
 insert into public.players(user_id,surname,name,active) values(owner,'Synthetic minutes','Bench A',true) returning id into p2;
 insert into public.players(user_id,surname,name,active) values(owner,'Synthetic minutes','Bench B',true) returning id into p3;
 insert into public.matches(user_id,match_date,opponent) values(owner,current_date,'Synthetic minute test') returning id into m;
 select id into aid from public.activities where match_id=m;
 insert into public.activity_roster(user_id,activity_id,player_id,called,lineup) values
 (owner,aid,p1,true,'Titolare'),(owner,aid,p2,true,'Panchina'),(owner,aid,p3,true,'Panchina');
 set constraints all immediate;
 if exists(select 1 from public.activity_roster where activity_id=aid and minutes_played<>0) then raise exception 'Pregame minutes must be zero';end if;

 insert into public.match_events(user_id,match_id,event_type,player_id,outgoing_player_id,minute)
 values(owner,m,'Sostituzione',p2,p1,65) returning id into e1;
 if (select minutes_played from public.activity_roster where activity_id=aid and player_id=p1)<>65 or
    (select minutes_played from public.activity_roster where activity_id=aid and player_id=p2)<>25 then raise exception '65/25 split failed';end if;
 insert into public.match_events(user_id,match_id,event_type,player_id,outgoing_player_id,minute)
 values(owner,m,'Sostituzione',p3,p2,80) returning id into e2;
 if (select minutes_played from public.activity_roster where activity_id=aid and player_id=p2)<>15 or
    (select minutes_played from public.activity_roster where activity_id=aid and player_id=p3)<>10 then raise exception 'Nested substitution failed';end if;
 update public.match_events set minute=70 where id=e1;
 if (select minutes_played from public.activity_roster where activity_id=aid and player_id=p1)<>70 or
    (select minutes_played from public.activity_roster where activity_id=aid and player_id=p2)<>10 then raise exception 'Correction failed';end if;

 blocked:=false;begin update public.match_events set minute=85 where id=e1;
 exception when invalid_parameter_value then blocked:=true;end;
 if not blocked or (select minute from public.match_events where id=e1)<>70 then raise exception 'Invalid ordering was not rolled back';end if;
 blocked:=false;begin delete from public.match_events where id=e1;
 exception when invalid_parameter_value then blocked:=true;end;
 if not blocked or not exists(select 1 from public.match_events where id=e1) then raise exception 'Dependent deletion must be atomic';end if;
 delete from public.match_events where id=e2;
 if (select minutes_played from public.activity_roster where activity_id=aid and player_id=p2)<>20 then raise exception 'Delete recalculation failed';end if;
 insert into public.match_events(user_id,match_id,event_type,player_id,minute)
 values(owner,m,'Espulsione',p2,85) returning id into e2;
 if (select minutes_played from public.activity_roster where activity_id=aid and player_id=p2)<>15 then raise exception 'Red card cutoff failed';end if;
 delete from public.match_events where id=e2;
 update public.matches set duration_minutes=95 where id=m;
 if (select minutes_played from public.activity_roster where activity_id=aid and player_id=p2)<>25 then raise exception 'Duration recalculation failed';end if;
 blocked:=false;begin update public.matches set duration_minutes=60 where id=m;
 exception when invalid_parameter_value then blocked:=true;end;
 if not blocked or (select duration_minutes from public.matches where id=m)<>95 then raise exception 'Duration bounds were not atomic';end if;

 select a.revision into revision from public.activities a where a.id=aid;
 blocked:=false;begin perform public.save_match_result(m,'{"goals_for":1,"goals_against":0,"venue":"Casa","duration_minutes":95,"minutes_auto":true}',revision-1);
 exception when serialization_failure then blocked:=true;end;
 if not blocked then raise exception 'Stale revision accepted';end if;
 perform public.save_match_result(m,'{"goals_for":1,"goals_against":0,"venue":"Casa","duration_minutes":95,"minutes_auto":true}',revision);
 if (select goals_for from public.matches where id=m)<>1 then raise exception 'Result RPC failed';end if;

 -- Switching lineup in one transaction is checked against its final state.
 set constraints all deferred;
 update public.activity_roster set lineup='Panchina' where activity_id=aid and player_id=p1;
 delete from public.match_events where id=e1;
 update public.activity_roster set lineup='Titolare' where activity_id=aid and player_id=p2;
 set constraints all immediate;
 if (select minutes_played from public.activity_roster where activity_id=aid and player_id=p1)<>0 or
    (select minutes_played from public.activity_roster where activity_id=aid and player_id=p2)<>95 then raise exception 'Final roster state failed';end if;
 update public.activity_roster set minutes_played=3 where activity_id=aid and player_id=p2;
 if (select minutes_played from public.activity_roster where activity_id=aid and player_id=p2)<>95 then raise exception 'Manual overwrite bypassed automatic calculation';end if;
 update public.activities set status='Annullato' where id=aid;
 if exists(select 1 from public.activity_roster where activity_id=aid and minutes_played<>0) then raise exception 'Cancelled match minutes must be zero';end if;

 insert into public.matches(user_id,match_date,opponent,minutes_auto) values(owner,current_date,'Synthetic manual history',false) returning id into manual;
 select id into manual_a from public.activities where match_id=manual;
 insert into public.activity_roster(user_id,activity_id,player_id,called,lineup,minutes_played) values(owner,manual_a,p1,true,'Titolare',78);
 update public.matches set duration_minutes=100 where id=manual;
 if (select minutes_played from public.activity_roster where activity_id=manual_a)<>78 then raise exception 'Manual history changed';end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.secretary'),'role','authenticated')::text,true);
 blocked:=false;begin perform public.save_match_result(manual,'{}',0);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Secretary changed a result';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.outside'),'role','authenticated')::text,true);
 if exists(select 1 from public.matches where id=m) then raise exception 'Cross-team result leaked';end if;
 blocked:=false;begin perform public.save_match_result(manual,'{}',0);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Another team changed a result';end if;
end $$;
reset role;
rollback;
