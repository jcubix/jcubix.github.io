begin;
do $$declare owner uuid; outsider uuid:=gen_random_uuid(); actor uuid; r text;begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 perform set_config('test.board_owner',owner::text,true);
 perform set_config('test.board_id',gen_random_uuid()::text,true);
 for r in select unnest(array['coach','technical_assistant','manager','secretary','president','treasurer']) loop
   actor:=gen_random_uuid();
   insert into auth.users(id,raw_app_meta_data) values(actor,jsonb_build_object('managed_account',true,'created_by',owner,'team_role',r));
   perform set_config('test.board_'||r,actor::text,true);
 end loop;
 insert into auth.users(id,raw_app_meta_data) values(outsider,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','coach'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=outsider where user_id=outsider;
 perform set_config('test.board_outside',outsider::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$declare b public.tactical_boards; d jsonb:='{"background":"pitch","marks":[]}'::jsonb; board_id uuid:=current_setting('test.board_id')::uuid; a uuid;begin
 select id into a from public.activities where user_id=auth.uid() and activity_type='Allenamento' limit 1;
 b:=public.save_tactical_board(board_id,' Test lavagna ',a,d,0);
 if b.title<>'Test lavagna' or b.revision<>1 or b.updated_by<>auth.uid() then raise exception 'Create/stamp failed';end if;
 b:=public.save_tactical_board(board_id,'Test lavagna',a,d,0);
 if b.revision<>1 then raise exception 'Retry duplicated revision';end if;
 b:=public.save_tactical_board(board_id,'Test modificata',null,'{"background":"pitch","marks":[{"id":"x","kind":"arrow","label":"","color":"#ff7b8b","points":[{"x":20,"y":40},{"x":500,"y":300}]}]}'::jsonb,1);
 if b.revision<>2 then raise exception 'Update failed';end if;
 begin perform public.save_tactical_board(board_id,'Old writer',null,d,1);raise exception 'Stale write allowed';exception when serialization_failure then null;end;
 begin update public.tactical_boards set title='Direct stale',revision=1 where id=b.id;raise exception 'Direct stale update allowed';exception when serialization_failure then null;end;
 begin perform public.save_tactical_board(gen_random_uuid(),'Invalid',null,'{"background":"https://attacker.test/photo","marks":[]}',0);raise exception 'External photo allowed';exception when invalid_parameter_value then null;end;
 begin perform public.save_tactical_board(gen_random_uuid(),'Invalid',null,'{"background":"data:image/svg+xml;base64,abc","marks":[]}',0);raise exception 'SVG allowed';exception when invalid_parameter_value then null;end;
 begin perform public.save_tactical_board(gen_random_uuid(),'Invalid',null,'{"background":"pitch","marks":[{"id":"x","kind":"text","color":"#ffffff","label":"test","points":[{"x":1001,"y":0}]}]}',0);raise exception 'Out of bounds allowed';exception when invalid_parameter_value then null;end;
 begin perform public.save_tactical_board(gen_random_uuid(),'Invalid',null,'{"background":"pitch","marks":[{"id":"x","kind":"arrow","color":"#ffffff","label":"","points":[]}]}',0);raise exception 'Empty geometry allowed';exception when invalid_parameter_value then null;end;
 begin perform public.save_tactical_board(board_id,'Invalid link',gen_random_uuid(),d,2);raise exception 'Cross-team link allowed';exception when invalid_parameter_value then null;end;
 insert into public.activities(user_id,activity_type,title,activity_date,status) values(auth.uid(),'Allenamento','Synthetic board activity',current_date,'Programmato') returning id into a;
 b:=public.save_tactical_board(gen_random_uuid(),'Keep drawing',a,d,0);
 reset role;
 delete from public.activities where id=a;
 set local role authenticated;
 b:=public.save_tactical_board(b.id,'Activity removed, drawing retained',a,d,1);
 if b.revision<>2 then raise exception 'Activity removal invalidated the board';end if;
end $$;
reset role;
do $$declare r text; actor uuid;begin
 for r in select unnest(array['coach','technical_assistant','manager','secretary','president','treasurer','outside']) loop
   actor:=current_setting('test.board_'||r)::uuid;
   perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
   set local role authenticated;
   if r in ('coach','technical_assistant') then
     if not exists(select 1 from public.tactical_boards where id=current_setting('test.board_id')::uuid) then raise exception 'Technical reader denied';end if;
     perform public.save_tactical_board(gen_random_uuid(),'Technical test',null,'{"background":"pitch","marks":[]}',0);
   else
     if exists(select 1 from public.tactical_boards where id=current_setting('test.board_id')::uuid) then raise exception 'Private board leaked to %',r;end if;
     if r<>'outside' then
       begin perform public.save_tactical_board(gen_random_uuid(),'Denied',null,'{"background":"pitch","marks":[]}',0);raise exception 'Non technical write allowed';exception when insufficient_privilege then null;end;
     end if;
     update public.tactical_boards set title='Forbidden' where id=current_setting('test.board_id')::uuid;
     if found then raise exception 'Unauthorized update';end if;
     delete from public.tactical_boards where id=current_setting('test.board_id')::uuid;
     if found then raise exception 'Unauthorized delete';end if;
   end if;
   reset role;
 end loop;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.board_owner'),'role','authenticated')::text,true);
set local role authenticated;
delete from public.tactical_boards where id=current_setting('test.board_id')::uuid and revision=1;
do $$begin if not exists(select 1 from public.tactical_boards where id=current_setting('test.board_id')::uuid) then raise exception 'Stale delete removed board';end if;end $$;
delete from public.tactical_boards where id=current_setting('test.board_id')::uuid and revision=2;
do $$begin if exists(select 1 from public.tactical_boards where id=current_setting('test.board_id')::uuid) then raise exception 'Delete failed';end if;end $$;
reset role;
set local role anon;
do $$begin begin perform count(*) from public.tactical_boards;raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
select 'PASS: tactical boards validation, revisions, retry, roles, team isolation, deletion; fixtures rolled back' as result;
