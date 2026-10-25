-- Live-safe authorization regression: synthetic isolated team, always rolled back.
begin;
do $$
declare creator uuid; owner uuid:=gen_random_uuid(); assistant uuid:=gen_random_uuid(); president uuid:=gen_random_uuid();
 p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); training uuid:=gen_random_uuid(); match uuid:=gen_random_uuid(); activity uuid;
begin
 select user_id into creator from public.team_members where role='admin' limit 1;
 if creator is null then raise exception 'Test requires an existing administrator';end if;
 insert into auth.users(id,raw_app_meta_data) values(owner,jsonb_build_object('managed_account',true,'created_by',creator,'team_role','admin'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=owner where user_id=owner;
 insert into auth.users(id,raw_app_meta_data) values
 (assistant,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','technical_assistant')),
 (president,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','president'));
 insert into public.players(id,user_id,surname,name,role,active) values(p1,owner,'Synthetic role','Starter','Difensore',true),(p2,owner,'Synthetic role','Substitute','Attaccante',true);
 insert into public.activities(id,user_id,activity_date,activity_type,title,start_time,location)
 values(training,owner,current_date,'Allenamento','Synthetic roles training','18:30','Test ground');
 insert into public.matches(id,user_id,match_date,opponent,venue,minutes_auto) values(match,owner,current_date,'Synthetic opponent','Casa',true);
 select id into activity from public.activities where match_id=match;
 insert into public.activity_roster(user_id,activity_id,player_id,called,lineup) values(owner,activity,p1,true,'Titolare'),(owner,activity,p2,true,'Panchina');
 insert into public.activity_technical(user_id,activity_id,formation,note) values(owner,activity,'4-3-3','Private observation');
 insert into public.player_administration(user_id,player_id,registration_status,certificate_until,document_until,emergency_contact)
 values(owner,p1,'In regola',current_date+60,current_date+10,'MUST NOT LEAK');
 perform set_config('test.role.owner',owner::text,true);perform set_config('test.role.assistant',assistant::text,true);
 perform set_config('test.role.president',president::text,true);perform set_config('test.role.p1',p1::text,true);
 perform set_config('test.role.p2',p2::text,true);perform set_config('test.role.training',training::text,true);
 perform set_config('test.role.match',match::text,true);perform set_config('test.role.activity',activity::text,true);
 perform set_config('request.jwt.claim.sub',assistant::text,true);
end $$;
set local role authenticated;
do $$
declare owner uuid:=current_setting('test.role.owner')::uuid; p1 uuid:=current_setting('test.role.p1')::uuid; p2 uuid:=current_setting('test.role.p2')::uuid;
 training uuid:=current_setting('test.role.training')::uuid; match uuid:=current_setting('test.role.match')::uuid; activity uuid:=current_setting('test.role.activity')::uuid;
 blocked boolean; n integer; a public.activities%rowtype; result jsonb;
begin
 if private_access.team_role()<>'technical_assistant' then raise exception 'Assistant authoritative role failed';end if;
 select * into a from public.activities where id=training;
 perform public.save_team_activity(jsonb_build_object('activity_type','Allenamento','title',a.title,'activity_date',a.activity_date,'start_time',a.start_time,'end_time',a.end_time,'location',a.location,'status',a.status,'organization_note',a.organization_note,'meeting_time',a.meeting_time,'meeting_place',a.meeting_place),
 jsonb_build_array(jsonb_build_object('player_id',p1,'called',false,'lineup','Non impiegato','position',null,'minutes_played',0,'availability','Disponibile','response_note',null),jsonb_build_object('player_id',p2,'called',false,'lineup','Non impiegato','position',null,'minutes_played',0,'availability','Indisponibile','response_note',null)),training,a.revision,null);
 if not exists(select 1 from public.activity_roster where activity_id=training and player_id=p1 and availability='Disponibile') then raise exception 'Assistant reply save failed';end if;
 select * into a from public.activities where id=training;
 result:=public.save_training_attendance(training,a.revision,jsonb_build_object('session_date',current_date,'session_type','Allenamento','note','Recorded by assistant'),
 jsonb_build_array(jsonb_build_object('player_id',p1,'status','Presente','delay_minutes',0,'notified',true,'note',null),jsonb_build_object('player_id',p2,'status','Assente','delay_minutes',0,'notified',true,'note',null)),null,null,gen_random_uuid());
 if (result->'session'->>'id') is null then raise exception 'Assistant attendance save failed';end if;
 blocked:=false;begin update public.activities set title='Forbidden' where id=training;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Assistant changed organization';end if;
 blocked:=false;begin insert into public.matches(user_id,match_date,opponent) values(owner,current_date,'Forbidden');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Assistant created match';end if;
 blocked:=false;begin update public.activity_roster set called=false where activity_id=activity and player_id=p1;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Assistant changed callups';end if;
 blocked:=false;begin update public.activity_roster set lineup='Titolare' where activity_id=activity and player_id=p2;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Assistant changed starting lineup';end if;
 select * into a from public.activities where id=activity;
 perform public.save_activity_observation(activity,a.revision,'Assistant observation');
 if not exists(select 1 from public.activity_technical where activity_id=activity and note='Assistant observation' and formation='4-3-3') then raise exception 'Observation save failed';end if;
 blocked:=false;begin update public.activity_technical set formation='4-4-2' where activity_id=activity;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Assistant changed formation';end if;
 insert into public.match_events(user_id,match_id,player_id,outgoing_player_id,event_type,minute) values(owner,match,p2,p1,'Sostituzione',60);
 perform private_access.recalculate_match_minutes(match);
 if (select minutes_played from public.activity_roster where activity_id=activity and player_id=p1)<>60 or
 (select minutes_played from public.activity_roster where activity_id=activity and player_id=p2)<>30 then raise exception 'Assistant substitution minutes failed';end if;
 select * into a from public.activities where id=activity;
 perform public.save_match_result(match,jsonb_build_object('goals_for',1,'goals_against',0,'venue','Casa','note','Result by assistant','duration_minutes',90,'minutes_auto',true),a.revision);
 if exists(select 1 from public.player_administration) then raise exception 'Assistant saw administration';end if;
 update public.players set name='Forbidden' where id=p1;get diagnostics n=row_count;if n<>0 then raise exception 'Assistant edited players';end if;
 blocked:=false;begin update public.team_members set role='admin' where user_id=auth.uid();exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Assistant self promotion';end if;
 insert into public.staff_communications(user_id,title,body,retention_days) values(owner,'Assistant notice','Synthetic',1);
 perform set_config('request.jwt.claim.sub',current_setting('test.role.president'),true);
end $$;
do $$
declare owner uuid:=current_setting('test.role.owner')::uuid; p1 uuid:=current_setting('test.role.p1')::uuid;
 match uuid:=current_setting('test.role.match')::uuid; activity uuid:=current_setting('test.role.activity')::uuid;
 summary jsonb; n integer; blocked boolean;
begin
 if private_access.team_role()<>'president' then raise exception 'President assignment failed';end if;
 if not exists(select 1 from public.matches where id=match) then raise exception 'President sporting read failed';end if;
 if exists(select 1 from public.activity_technical) or exists(select 1 from public.player_administration) then raise exception 'President private data leaked';end if;
 select to_jsonb(s) into summary from public.team_administration_summary() s where s.player_id=p1;
 if summary->>'certificate_status'<>'In regola' or summary->>'document_status'<>'In scadenza' or (summary->>'needs_review')::boolean is not true then raise exception 'President summary failed';end if;
 if summary ? 'emergency_contact' or summary ? 'document_until' or summary ? 'certificate_until' then raise exception 'Summary leaked sensitive fields';end if;
 if (select count(*) from public.team_administration_summary())<>2 then raise exception 'Summary leaked other team';end if;
 insert into public.staff_communications(user_id,title,body,retention_days) values(owner,'President notice','Synthetic',3);
 update public.matches set goals_for=9 where id=match;get diagnostics n=row_count;if n<>0 then raise exception 'President wrote sporting data';end if;
 update public.players set name='Forbidden' where id=p1;get diagnostics n=row_count;if n<>0 then raise exception 'President edited players';end if;
 blocked:=false;begin perform public.save_match_result(match,'{}',0);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'President RPC sports write';end if;
 blocked:=false;begin perform public.save_activity_observation(activity,0,'Forbidden');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'President RPC notes write';end if;
 blocked:=false;begin insert into public.staff_communications(user_id,title,body,retention_days) values(auth.uid(),'Cross team','Forbidden',1);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Cross-team message allowed';end if;
 blocked:=false;begin update public.team_members set role='admin' where user_id=auth.uid();exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'President self promotion';end if;
end $$;
set constraints all immediate;
reset role;
select 'staff role authorization, replies, attendance, substitutions and privacy checks passed; fixtures rolled back' as result;
rollback;
