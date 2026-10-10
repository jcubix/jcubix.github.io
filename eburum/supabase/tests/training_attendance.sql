begin;
-- Synthetic calendar entries and attendance, removed by rollback.
do $$declare owner uuid; secretary uuid:=gen_random_uuid(); outside uuid:=gen_random_uuid();begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 insert into auth.users(id,raw_app_meta_data) values
 (secretary,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','secretary')),
 (outside,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','manager'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=outside where user_id=outside;
 perform set_config('test.secretary',secretary::text,true);perform set_config('test.outside',outside::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$declare owner uuid:=auth.uid(); other_a uuid; aid uuid; canceled uuid; future_a uuid; revision integer;
 rows jsonb; result jsonb; sid uuid; request_id uuid:=gen_random_uuid(); blocked boolean;
begin
 insert into public.activities(user_id,activity_date,activity_type,title,start_time) values(owner,'2002-01-01','Allenamento','Synthetic other training','10:00') returning id into other_a;
 insert into public.activities(user_id,activity_date,activity_type,title,start_time) values(owner,'2002-01-01','Allenamento','Synthetic selected training','19:00') returning id,activities.revision into aid,revision;
 select jsonb_agg(jsonb_build_object('player_id',id,'status','Presente','delay_minutes',0,'notified',true,'note',null)) into rows from public.players where user_id=owner and active;
 blocked:=false;begin perform public.save_training_attendance(aid,revision+1,'{"session_date":"2002-01-01","session_type":"Allenamento"}',rows,null,null,request_id);exception when sqlstate '40001' then blocked:=true;end;assert blocked,'stale activity revision rejected';
 blocked:=false;begin perform public.save_training_attendance(aid,revision,'{"session_date":"2002-01-02","session_type":"Allenamento"}',rows,null,null,request_id);exception when sqlstate '22023' then blocked:=true;end;assert blocked,'date mismatch rejected';
 blocked:=false;begin perform public.save_training_attendance(aid,revision,'{"session_date":"2002-01-01","session_type":"Allenamento"}',jsonb_set(rows,'{0,status}','"Da confermare"'),null,null,request_id);exception when sqlstate '22023' then blocked:=true;end;assert blocked,'pending presence rejected';
 assert not exists(select 1 from public.sessions where user_id=owner and session_date='2002-01-01'),'failed calls create no attendance';
 result:=public.save_training_attendance(aid,revision,'{"session_date":"2002-01-01","session_type":"Allenamento"}',rows,null,null,request_id);sid:=(result->'session'->>'id')::uuid;
 assert (select session_id=sid and status='Concluso' from public.activities where id=aid),'explicit activity linked';
 assert (select session_id is null from public.activities where id=other_a),'earlier same-day activity untouched';
 result:=public.save_training_attendance(aid,revision,'{"session_date":"2002-01-01","session_type":"Allenamento"}',rows,null,null,request_id);
 assert (result->>'replayed')::boolean,'retry after lost response is idempotent';
 select a.revision into revision from public.activities a where id=aid;
 rows:=jsonb_set(rows,'{0,status}','"Infortunato"');
 result:=public.save_training_attendance(aid,revision,'{"session_date":"2002-01-01","session_type":"Allenamento"}',rows,sid,(result->'session'->>'revision')::integer,null);
 assert exists(select 1 from public.attendance where session_id=sid and status='Infortunato'),'correction saved';
 result:=public.save_attendance_session('{"session_date":"2002-01-03","session_type":"Allenamento"}',rows,sid,(result->'session'->>'revision')::integer,null);
 assert (select activity_date='2002-01-03' and session_id=sid from public.activities where id=aid),'legacy date correction keeps calendar linkage';
 assert (select session_id is null and activity_date='2002-01-01' from public.activities where id=other_a),'legacy correction leaves other training untouched';
 assert exists(select 1 from public.attendance_history where session_id=sid and entity='session' and after_data->>'session_date'='2002-01-03'),'legacy date correction audited';
 insert into public.activities(user_id,activity_date,activity_type,title,status) values(owner,'2002-01-02','Allenamento','Synthetic canceled training','Annullato') returning id into canceled;
 blocked:=false;begin perform public.save_training_attendance(canceled,0,'{"session_date":"2002-01-02","session_type":"Allenamento"}',rows,null,null,gen_random_uuid());exception when sqlstate '22023' then blocked:=true;end;assert blocked,'canceled rejected';
 insert into public.activities(user_id,activity_date,activity_type,title) values(owner,current_date+10,'Allenamento','Synthetic future training') returning id into future_a;
 blocked:=false;begin perform public.save_training_attendance(future_a,0,jsonb_build_object('session_date',current_date+10,'session_type','Allenamento'),rows,null,null,gen_random_uuid());exception when sqlstate '22023' then blocked:=true;end;assert blocked,'future rejected';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.secretary'),'role','authenticated')::text,true);
 blocked:=false;begin perform public.save_training_attendance(aid,revision,'{"session_date":"2002-01-01","session_type":"Allenamento"}',rows,sid,0,null);exception when sqlstate '42501' then blocked:=true;end;assert blocked,'secretary cannot save';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.outside'),'role','authenticated')::text,true);
 blocked:=false;begin perform public.save_training_attendance(aid,revision,'{"session_date":"2002-01-01","session_type":"Allenamento"}',rows,sid,0,null);exception when sqlstate '42501' then blocked:=true;end;assert blocked,'other team cannot save';
end $$;
rollback;
