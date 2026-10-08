-- Synthetic planned replies and actual attendance must remain separate. Always rolls back.
begin;
select set_config('request.jwt.claim.sub',(select claimed_by::text from private_import.bootstrap_state where singleton),true);
set local role authenticated;
do $$
declare rows jsonb;actual jsonb;planned jsonb;result jsonb;pid uuid;aid uuid;sid uuid;n integer;blocked boolean;
begin
 select id into pid from public.players where user_id=private_access.team_owner() and active order by id limit 1;
 select jsonb_agg(jsonb_build_object('player_id',id,'called',false,'availability',case when id=pid then 'Indisponibile' else 'In attesa' end,'response_note',null,'lineup','Non impiegato','position',null,'minutes_played',0)) into rows from public.players where user_id=private_access.team_owner() and active;
 select count(*) into n from public.sessions where user_id=private_access.team_owner();
 planned:=public.save_team_activity(jsonb_build_object('activity_date','2300-04-01','activity_type','Allenamento','title','Synthetic poll','status','Programmato','request_id',gen_random_uuid()),rows);
 aid:=(planned->>'id')::uuid;
 if (select count(*) from public.sessions where user_id=private_access.team_owner())<>n then raise exception 'Poll created actual attendance session';end if;
 if exists(select 1 from public.activities where id=aid and session_id is not null) then raise exception 'Poll linked an actual session too early';end if;
 select jsonb_agg(jsonb_build_object('player_id',id,'status','Presente','delay_minutes',0,'notified',id=pid,'note',null)) into actual from public.players where user_id=private_access.team_owner() and active;
 result:=public.save_attendance_session('{"session_date":"2300-04-01","session_type":"Allenamento"}',actual,null,null,gen_random_uuid());
 sid:=(result->'session'->>'id')::uuid;
 if not exists(select 1 from public.activity_roster where activity_id=aid and player_id=pid and availability='Indisponibile') then raise exception 'Actual attendance overwrote planned availability';end if;
 if not exists(select 1 from public.attendance where session_id=sid and player_id=pid and status='Presente' and notified=true) then raise exception 'Actual attendance not saved independently';end if;
 if not exists(select 1 from public.activities where id=aid and session_id=sid and status='Concluso') then raise exception 'Planned activity not linked and concluded';end if;
 if (select count(*) from public.activities where user_id=private_access.team_owner() and activity_date='2300-04-01' and activity_type='Allenamento')<>1 then raise exception 'Duplicate activity';end if;
 blocked:=false;begin perform public.save_team_activity(planned,rows,aid,(planned->>'revision')::integer);exception when serialization_failure then blocked:=true;end;
 if not blocked then raise exception 'Stale poll revision overwrote completed attendance';end if;
end $$;
rollback;
