-- Existing administrator, authenticated RLS, all fixtures rolled back.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.team_members where role='admin' order by user_id limit 1),true);
set local role authenticated;
do $test$
declare k text; s numeric; invalid jsonb; b public.tactical_boards; d jsonb; bad jsonb; test_id uuid:=gen_random_uuid();
begin
for k in select unnest(array['disc','cone','pole','mannequin','ball','hurdle','ladder','mini_goal','hoop']) loop
foreach s in array array[0.25,0.6,1,2]::numeric[] loop
d:=jsonb_build_object('background','pitch','marks',jsonb_build_array(jsonb_build_object('id',k,'kind',k,'color','#f4cf63','label','','scale',s,'points',jsonb_build_array(jsonb_build_object('x',500,'y',320)))));
select * into b from public.save_tactical_board(test_id,'Equipment size test (rollback)',null,d,case when b.id is null then 0 else b.revision end);
if b.document<>d then raise exception 'Roundtrip failed: % %',k,s;end if;
end loop;
end loop;
for invalid in select value from jsonb_array_elements('[0,0.24,2.01,null,"1",{},true]') loop
bad:=jsonb_set(d,'{marks,0,scale}',invalid);
begin
perform public.save_tactical_board(test_id,'Equipment size test (rollback)',null,bad,b.revision);
raise exception 'Invalid size accepted: %',invalid;
exception when sqlstate '22023' then null;end;
end loop;
d:=jsonb_set(d,'{marks,0,kind}','"home"');
begin
perform public.save_tactical_board(test_id,'Equipment size test (rollback)',null,d,b.revision);
raise exception 'Player resize accepted';
exception when sqlstate '22023' then null;end;
d:=d #- '{marks,0,scale}';
perform public.save_tactical_board(test_id,'Equipment size test (rollback)',null,d,b.revision);
end $test$;
rollback;
select 'PASS: 36 size roundtrips, invalid scales rejected, legacy mark accepted, all test rows rolled back' as result;
