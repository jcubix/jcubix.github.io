-- Run against a configured database with an administrator. No fixtures persist.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.team_members where role='admin' order by user_id limit 1),true);
set local role authenticated;
do $test$
declare k text; b public.tactical_boards; d jsonb; bad jsonb; new_id uuid:=gen_random_uuid();
begin
for k in select unnest(array['disc','cone','pole','mannequin','ball','hurdle','ladder','mini_goal','hoop']) loop
d:=jsonb_build_object('background','pitch','marks',jsonb_build_array(jsonb_build_object('id',k,'kind',k,'color','#f4cf63','label','','points',jsonb_build_array(jsonb_build_object('x',500,'y',320)))));
select * into b from public.save_tactical_board(new_id,'Equipment validation (rollback)',null,d,case when b.id is null then 0 else b.revision end);
if b.document<>d then raise exception 'Roundtrip failed: %',k; end if;
bad:=jsonb_set(d,'{marks,0,points}','[{"x":1,"y":2},{"x":3,"y":4}]'::jsonb);
begin
 perform public.save_tactical_board(new_id,'Equipment validation (rollback)',null,bad,b.revision);
 raise exception 'Invalid geometry accepted: %',k;
exception when sqlstate '22023' then null; end;
end loop;
end $test$;
rollback;
select 'PASS: all nine equipment kinds roundtrip; malformed geometry rejected; test rows rolled back' as result;
