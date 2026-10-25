begin;
do $$declare owner uuid; assistant uuid:=gen_random_uuid(); reader uuid:=gen_random_uuid(); outside uuid:=gen_random_uuid();begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 insert into auth.users(id,raw_app_meta_data) values
 (assistant,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','technical_assistant')),
 (reader,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','secretary')),
 (outside,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','manager'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=outside where user_id=outside;
 perform set_config('test.assistant',assistant::text,true);perform set_config('test.reader',reader::text,true);perform set_config('test.outside',outside::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$declare owner uuid:=auth.uid(); p uuid; m uuid; aid uuid; e uuid:=gen_random_uuid(); rev integer;begin
 insert into public.players(user_id,surname,name,active) values(owner,'Synthetic score','Starter',true) returning id into p;
 insert into public.matches(user_id,match_date,opponent) values(owner,current_date,'Synthetic score flow') returning id into m;
 select id,revision into aid,rev from public.activities where match_id=m;
 perform set_config('test.match',m::text,true);perform set_config('test.player',p::text,true);
 insert into public.activity_roster(user_id,activity_id,player_id,called,lineup) values(owner,aid,p,true,'Titolare');
 set constraints all immediate;
 insert into public.match_events(id,user_id,match_id,event_type,player_id,minute) values(e,owner,m,'Gol',p,8);
 if not exists(select 1 from public.matches where id=m and goals_for=1 and goals_against=0) then raise exception 'Own goal score failed';end if;
 if (select revision from public.activities where id=aid)<=rev then raise exception 'Event did not invalidate stale drafts';end if;
 insert into public.match_events(id,user_id,match_id,event_type,player_id,minute) values(e,owner,m,'Gol',p,8) on conflict do nothing;
 if (select goals_for from public.matches where id=m)<>1 then raise exception 'Retry counted twice';end if;
 update public.match_events set player_id=null where id=e;
 if not exists(select 1 from public.matches where id=m and goals_for=0 and goals_against=1) then raise exception 'Reassignment failed';end if;
 update public.match_events set minute=9 where id=e;
 if (select goals_against from public.matches where id=m)<>1 then raise exception 'Minute edit counted again';end if;
 update public.match_events set event_type='Ammonizione' where id=e;
 if not exists(select 1 from public.matches where id=m and goals_for=0 and goals_against=0) then raise exception 'Goal conversion failed';end if;
 delete from public.match_events where id=e;
 update public.matches set goals_for=3,goals_against=2 where id=m;
 insert into public.match_events(id,user_id,match_id,event_type,player_id,minute) values(e,owner,m,'Gol',p,90);
 if not exists(select 1 from public.matches where id=m and goals_for=4 and goals_against=2) then raise exception 'Existing score overwritten';end if;
 delete from public.match_events where id=e;
 if not exists(select 1 from public.matches where id=m and goals_for=3 and goals_against=2) then raise exception 'Goal deletion not reverted';end if;
 -- Invalid event and its score update roll back together.
 begin
  insert into public.match_events(user_id,match_id,event_type,player_id,minute) values(owner,m,'Gol',p,999);
  raise exception 'Expected invalid minute';
 exception when check_violation then null;end;
 if not exists(select 1 from public.matches where id=m and goals_for=3 and goals_against=2) then raise exception 'Invalid event changed result';end if;
 if not exists(select 1 from public.activity_history where activity_id=aid and entity='matches') then raise exception 'Score audit missing';end if;
end $$;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.assistant'),'role','authenticated')::text,true);end $$;
do $$declare m uuid:=current_setting('test.match')::uuid;begin
 insert into public.match_events(user_id,match_id,event_type,minute) values(private_access.team_owner(),m,'Gol',50);
 if not exists(select 1 from public.matches where id=m and goals_for=3 and goals_against=3) then raise exception 'Assistant automatic score failed';end if;
end $$;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.reader'),'role','authenticated')::text,true);end $$;
do $$begin
 begin
  insert into public.match_events(user_id,match_id,event_type) values(private_access.team_owner(),current_setting('test.match')::uuid,'Gol');
  raise exception 'Reader wrote a goal';
 exception when insufficient_privilege then null;end;
end $$;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.outside'),'role','authenticated')::text,true);end $$;
do $$begin
 if exists(select 1 from public.matches where id=current_setting('test.match')::uuid) then raise exception 'Cross-team score visible';end if;
 begin
  insert into public.match_events(user_id,match_id,event_type) values(private_access.team_owner(),current_setting('test.match')::uuid,'Gol');
  raise exception 'Cross-team goal accepted';
 exception when insufficient_privilege or foreign_key_violation then null;end;
end $$;
rollback;
select 'PASS: automatic goals, opponent reassignment, edit/delete, retries, legacy scores, revisions, atomic rollback, audit and roles; fixtures rolled back' as result;
