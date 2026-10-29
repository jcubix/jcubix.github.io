begin;
-- All fixtures are isolated by a unique request and disappear at rollback.
do $$declare owner uuid;begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$declare owner uuid:=auth.uid(); aid uuid; rev integer; rows jsonb; sid uuid; result jsonb; request_id uuid:=gen_random_uuid(); blocked boolean; prior jsonb; day date;
begin
 select d::date into day from generate_series('1991-01-01'::date,'1991-12-31'::date,'1 day') d where not exists(select 1 from public.sessions s where s.user_id=owner and s.session_date=d::date) and not exists(select 1 from public.activities a where a.user_id=owner and a.activity_date=d::date) limit 1;
 assert day is not null,'free synthetic date required';
 select jsonb_agg(jsonb_build_object('player_id',id,'availability','Disponibile','called',false,'lineup','Non impiegato','minutes_played',0,'position',null,'response_note',null)) into rows from public.players where user_id=owner and active;
 rows:=jsonb_set(jsonb_set(rows,'{0,availability}','"Indisponibile"'),'{0,response_note}','"Synthetic absence notice"');
 result:=public.save_team_activity(jsonb_build_object('activity_date',day,'activity_type','Allenamento','title','Synthetic absence-notice check','status','Programmato','request_id',gen_random_uuid()),rows,null,null,null);
 aid:=(result->>'id')::uuid;rev:=(result->>'revision')::integer;
 assert aid is not null,'planned training created';
 assert not exists(select 1 from public.sessions where user_id=owner and session_date=day),'forecast never records actual attendance';
 assert exists(select 1 from public.activity_roster where activity_id=aid and availability='Indisponibile' and response_note='Synthetic absence notice'),'absence notice stored';
 select jsonb_agg(jsonb_build_object('player_id',id,'status','Presente','delay_minutes',0,'notified',null,'note',null)) into rows from public.players where user_id=owner and active;
 rows:=jsonb_set(rows,'{0,status}','"Assente"');
 result:=public.save_training_attendance(aid,rev,jsonb_build_object('session_date',day,'session_type','Allenamento','attendance_mode','absence_notice'),rows,null,null,request_id);
 sid:=(result->'session'->>'id')::uuid;
 assert result->'session'->>'attendance_mode'='absence_notice','method persisted';
 assert (select count(*) from public.attendance where session_id=sid)=(select count(*) from public.players where user_id=owner and active),'whole team saved';
 assert not exists(select 1 from public.attendance where session_id=sid and notified is not null),'no survey answers fabricated';
 result:=public.save_training_attendance(aid,rev,jsonb_build_object('session_date',day,'session_type','Allenamento','attendance_mode','absence_notice'),rows,null,null,request_id);
 assert (result->>'replayed')::boolean,'lost-response retry remains idempotent';
 blocked:=false;begin perform public.save_attendance_session(jsonb_build_object('session_date',day,'session_type','Allenamento','attendance_mode','poll'),rows,sid,(result->'session'->>'revision')::integer,null);exception when sqlstate '22023' then blocked:=true;end;assert blocked,'cannot reclassify existing session';
 blocked:=false;begin perform public.save_attendance_session(jsonb_build_object('session_date',day,'session_type','Allenamento','attendance_mode','absence_notice'),jsonb_set(rows,'{0,notified}','true'),sid,(result->'session'->>'revision')::integer,null);exception when sqlstate '22023' then blocked:=true;end;assert blocked,'new method rejects survey values';
 prior:=result;
 result:=public.save_attendance_session(jsonb_build_object('session_date',day,'session_type','Allenamento','attendance_mode','absence_notice'),jsonb_set(rows,'{0,status}','"Infortunato"'),sid,(result->'session'->>'revision')::integer,null);
 assert exists(select 1 from public.attendance where session_id=sid and status='Infortunato'),'actual attendance still correctable';
 blocked:=false;begin perform public.save_attendance_session(jsonb_build_object('session_date',day,'session_type','Allenamento'),rows,sid,(prior->'session'->>'revision')::integer,null);exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'revision guard preserved';
 blocked:=false;begin perform public.save_attendance_session(jsonb_build_object('session_date',day+1,'session_type','Allenamento','attendance_mode','invalid'),rows,null,null,gen_random_uuid());exception when sqlstate '22023' then blocked:=true;end;assert blocked,'invalid mode rejected';
 -- Old clients can still create survey-era records; no historical rewrite occurs.
 result:=public.save_attendance_session(jsonb_build_object('session_date',day+1,'session_type','Allenamento'),jsonb_set(rows,'{0,notified}','true'),null,null,gen_random_uuid());
 assert result->'session'->>'attendance_mode'='poll','old client semantics retained';
end $$;
rollback;
