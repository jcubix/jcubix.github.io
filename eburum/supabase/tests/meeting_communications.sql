begin;
do $$declare owner uuid; actor uuid; r text;begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 perform set_config('test.meeting_owner',owner::text,true);
 for r in select unnest(array['manager','coach','secretary','technical_assistant','president','treasurer']) loop
   actor:=gen_random_uuid();insert into auth.users(id,raw_app_meta_data) values(actor,jsonb_build_object('managed_account',true,'created_by',owner,'team_role',r));
   perform set_config('test.meeting_'||r,actor::text,true);
 end loop;
 set constraints auth.eburum_finalize_managed_account immediate;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$declare m public.staff_communications; d date:=(now() at time zone 'Europe/Rome')::date+30;begin
 insert into public.staff_communications(user_id,title,body,retention_days,kind,meeting_date,meeting_time,meeting_location,requires_ack)
 values(auth.uid(),' Synthetic invitation ','Review',1,'meeting',d,'20:30',' Sede ',false) returning * into m;
 if m.title<>'Synthetic invitation' or not m.requires_ack or m.player_id is not null or m.meeting_location<>'Sede' then raise exception 'Meeting normalization failed';end if;
 if m.expires_at<>((d+time '20:30') at time zone 'Europe/Rome')+interval '24 hours' then raise exception 'Meeting expires before or at wrong event time';end if;
 if m.created_by<>auth.uid() or m.created_at>now() then raise exception 'Author stamp failed';end if;
 perform set_config('test.meeting_id',m.id::text,true);
 perform public.acknowledge_communication(m.id);
 if not exists(select 1 from public.communication_receipts where communication_id=m.id and reader_id=auth.uid()) then raise exception 'Read receipt failed';end if;
 insert into public.staff_communications(user_id,title,body,retention_days) values(auth.uid(),'Ordinary','Still three days',3) returning * into m;
 if m.kind<>'notice' or m.expires_at<>now()+interval '72 hours' then raise exception 'Ordinary expiry changed';end if;
 begin insert into public.staff_communications(user_id,title,body,retention_days,kind) values(auth.uid(),'Missing fields','Test',3,'meeting');raise exception 'Missing date accepted';exception when invalid_parameter_value then null;end;
 begin insert into public.staff_communications(user_id,title,body,retention_days,kind,meeting_date,meeting_time) values(auth.uid(),'Past','Test',3,'meeting',d-40,'18:00');raise exception 'Past date accepted';exception when invalid_parameter_value then null;end;
 begin insert into public.staff_communications(user_id,title,body,retention_days,meeting_date) values(auth.uid(),'Mixed types','Test',3,d);raise exception 'Notice meeting metadata accepted';exception when check_violation then null;end;
end $$;
reset role;
do $$declare r text;actor uuid;begin
 for r in select unnest(array['manager','coach','secretary','technical_assistant','president','treasurer']) loop
   actor:=current_setting('test.meeting_'||r)::uuid;
   perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
   set local role authenticated;
   if not exists(select 1 from public.staff_communications where id=current_setting('test.meeting_id')::uuid) then raise exception 'Staff cannot read invitation';end if;
   perform public.acknowledge_communication(current_setting('test.meeting_id')::uuid);
   if r in ('manager','coach') then
     insert into public.staff_communications(user_id,title,body,retention_days,kind,meeting_date,meeting_time) values(current_setting('test.meeting_owner')::uuid,'Allowed meeting','Review',3,'meeting',current_date+10,'18:00');
   else
     begin insert into public.staff_communications(user_id,title,body,retention_days,kind,meeting_date,meeting_time) values(current_setting('test.meeting_owner')::uuid,'Denied meeting','Review',3,'meeting',current_date+10,'18:00');raise exception 'Non planner created meeting';exception when insufficient_privilege then null;end;
     insert into public.staff_communications(user_id,title,body,retention_days) values(current_setting('test.meeting_owner')::uuid,'Allowed notice','News',3);
   end if;
   reset role;
 end loop;
end $$;
rollback;
select 'PASS: meeting expiry, read receipts, ordinary notices, field validation and all seven roles; fixtures rolled back' as result;
