begin;
select set_config('request.jwt.claim.sub',(select claimed_by::text from private_import.bootstrap_state where singleton),true);
set local role authenticated;
do $$
declare
  payload jsonb; result jsonb; sid uuid; rev integer; rid uuid:=gen_random_uuid(); pid uuid; before_count integer; blocked boolean;
begin
  select jsonb_agg(jsonb_build_object('player_id',id,'status','Presente','delay_minutes',0,'notified',null,'note',null) order by id)
  into payload from public.players where user_id=auth.uid() and active;
  result:=public.save_attendance_session('{"session_date":"2300-01-01","session_type":"Allenamento","note":"Synthetic test"}',payload,null,null,rid);
  sid:=(result->'session'->>'id')::uuid; rev:=(result->'session'->>'revision')::integer;
  if (select count(*) from public.attendance where session_id=sid)<>jsonb_array_length(payload) then raise exception 'Incomplete initial attendance'; end if;
  result:=public.save_attendance_session('{"session_date":"2300-01-01","session_type":"Allenamento","note":"Synthetic test"}',payload,null,null,rid);
  if not (result->>'replayed')::boolean or (result->'session'->>'id')::uuid<>sid then raise exception 'Idempotency failed'; end if;
  blocked:=false;
  begin perform public.save_attendance_session('{"session_date":"2300-01-01","session_type":"Allenamento","note":"Different replay"}',payload,null,null,rid);
  exception when serialization_failure then blocked:=true; end;
  if not blocked then raise exception 'Changed retry silently discarded'; end if;
  select count(*) into before_count from public.attendance_history where session_id=sid;
  result:=public.save_attendance_session('{"session_date":"2300-01-01","session_type":"Allenamento","note":"Synthetic test"}',payload,sid,rev,null);
  if (result->'session'->>'revision')::integer<>rev or (select count(*) from public.attendance_history where session_id=sid)<>before_count then raise exception 'No-op logged changes'; end if;
  pid:=(payload->0->>'player_id')::uuid;
  payload:=jsonb_set(jsonb_set(payload,'{0,status}','"Assente"'),'{0,note}','"Synthetic correction"');
  result:=public.save_attendance_session('{"session_date":"2300-01-01","session_type":"Allenamento","note":"Corrected note"}',payload,sid,rev,null);
  if not exists(select 1 from public.attendance_history where session_id=sid and player_id=pid and action='UPDATE' and before_data->>'status'='Presente' and after_data->>'status'='Assente' and actor_id=auth.uid()) then raise exception 'Missing audit actor or snapshots'; end if;
  blocked:=false;
  begin perform public.save_attendance_session('{"session_date":"2300-01-01","session_type":"Allenamento"}',payload,sid,rev,null);
  exception when serialization_failure then blocked:=true; end;
  if not blocked then raise exception 'Stale revision overwritten'; end if;
  rev:=(result->'session'->>'revision')::integer;
  blocked:=false;
  begin perform public.save_attendance_session('{"session_date":"2300-01-02","session_type":"Allenamento","note":"Must rollback"}',jsonb_set(payload,'{0,delay_minutes}','-1'),sid,rev,null);
  exception when invalid_parameter_value then blocked:=true; end;
  if not blocked or (select session_date from public.sessions where id=sid)<>'2300-01-01'::date then raise exception 'Validation was not atomic'; end if;
  update public.players set active=false where id=pid;
  payload:=jsonb_set(payload,'{0,status}','"Infortunato"');
  result:=public.save_attendance_session('{"session_date":"2300-01-01","session_type":"Allenamento","note":"Corrected note"}',payload,sid,rev,null);
  if not exists(select 1 from public.attendance where session_id=sid and player_id=pid and status='Infortunato') then raise exception 'Inactive historical player lost'; end if;
  blocked:=false;
  begin insert into public.attendance_history(user_id,session_id,entity,action) values(auth.uid(),sid,'session','UPDATE'); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Client forged audit log'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.attendance_history where session_id=sid) then raise exception 'Audit leaked across owners'; end if;
  blocked:=false;
  begin perform public.save_attendance_session('{"session_date":"2300-01-01","session_type":"Allenamento"}',payload,sid,0,null); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Cross-owner edit succeeded'; end if;
end $$;
rollback;
