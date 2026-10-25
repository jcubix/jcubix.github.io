-- Synthetic team only. Transaction always rolled back; no messages/emails to real staff.
begin;
do $$
declare creator uuid; owner uuid:=gen_random_uuid(); reader uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); notice uuid; othernotice uuid; match uuid:=gen_random_uuid(); activity uuid;
begin
 select user_id into creator from public.team_members where role='admin' limit 1;
 insert into auth.users(id,raw_app_meta_data) values(owner,jsonb_build_object('managed_account',true,'created_by',creator,'team_role','admin'));
 set constraints auth.eburum_finalize_managed_account immediate;
 update public.team_members set owner_id=owner,first_name='Synthetic',last_name='Owner' where user_id=owner;
 insert into auth.users(id,raw_app_meta_data) values(reader,jsonb_build_object('managed_account',true,'created_by',owner,'team_role','president')),
 (stranger,jsonb_build_object('managed_account',true,'created_by',creator,'team_role','coach'));
 perform set_config('request.jwt.claim.sub',owner::text,true);
 insert into public.staff_communications(user_id,title,body,retention_days,requires_ack) values(owner,'Synthetic important','Synthetic test',1,true) returning id into notice;
 insert into public.staff_communications(user_id,title,body,retention_days,requires_ack) values(creator,'Other team','Synthetic test',1,true) returning id into othernotice;
 insert into public.matches(id,user_id,match_date,opponent,venue) values(match,owner,current_date,'Synthetic match','Casa');
 select id into activity from public.activities where match_id=match;
 perform set_config('test.daily.owner',owner::text,true);perform set_config('test.daily.reader',reader::text,true);perform set_config('test.daily.stranger',stranger::text,true);
 perform set_config('test.daily.notice',notice::text,true);perform set_config('test.daily.othernotice',othernotice::text,true);perform set_config('test.daily.match',match::text,true);perform set_config('test.daily.activity',activity::text,true);
 perform set_config('request.jwt.claim.sub',reader::text,true);
end $$;
set local role authenticated;
do $$
declare blocked boolean; notice uuid:=current_setting('test.daily.notice')::uuid; activity uuid:=current_setting('test.daily.activity')::uuid; match uuid:=current_setting('test.daily.match')::uuid;
begin
 perform public.acknowledge_communication(notice);perform public.acknowledge_communication(notice);
 if (select count(*) from public.communication_receipts where communication_id=notice)<>1 then raise exception 'Receipt not idempotent';end if;
 if not exists(select 1 from public.communication_receipts where communication_id=notice and reader_id=auth.uid() and acknowledged_at<=now()) then raise exception 'Receipt actor/timestamp incorrect';end if;
 blocked:=false;begin perform public.acknowledge_communication(current_setting('test.daily.othernotice')::uuid);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Cross-team acknowledgement allowed';end if;
 blocked:=false;begin update public.communication_receipts set reader_label='Forged';exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Receipt mutable';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.daily.stranger'),true);
 if exists(select 1 from public.activity_history where activity_id=activity) or exists(select 1 from public.communication_receipts where communication_id=notice) then raise exception 'Cross-team data leaked';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.daily.owner'),true);
 blocked:=false;begin update public.activities set status='Concluso' where id=activity;exception when invalid_parameter_value then blocked:=true;end;if not blocked then raise exception 'Match without score concluded';end if;
 update public.matches set goals_for=0,goals_against=0 where id=match;
 update public.activities set status='Concluso' where id=activity;
 if not exists(select 1 from public.activity_history where activity_id=activity and entity='matches' and action='UPDATE' and after_data->>'goals_for'='0') then raise exception 'Score audit missing';end if;
 if not exists(select 1 from public.activity_history where activity_id=activity and entity='activities' and after_data->>'status'='Concluso' and actor_id=auth.uid() and actor_label='Synthetic Owner') then raise exception 'Actor/activity audit missing';end if;
 blocked:=false;begin delete from public.activity_history where activity_id=activity;exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Audit mutable';end if;
end $$;
reset role;
do $$
declare notice uuid:=current_setting('test.daily.notice')::uuid;
begin
 update public.staff_communications set expires_at=now()-interval '1 minute',created_at=now()-interval '1 day' where id=notice;
end $$;
set local role authenticated;
do $$
declare blocked boolean;
begin
 blocked:=false;begin perform public.acknowledge_communication(current_setting('test.daily.notice')::uuid);exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Expired acknowledgement allowed';end if;
 if exists(select 1 from public.communication_receipts where communication_id=current_setting('test.daily.notice')::uuid) then raise exception 'Expired receipts visible';end if;
end $$;
reset role;
delete from public.staff_communications where id=current_setting('test.daily.notice')::uuid;
do $$begin if exists(select 1 from public.communication_receipts where communication_id=current_setting('test.daily.notice')::uuid) then raise exception 'Receipt cascade failed';end if;end $$;
rollback;
