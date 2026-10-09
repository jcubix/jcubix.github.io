-- Private, owner-scoped invalidation events. Message text never enters the broadcast.
create policy staff_communications_realtime_read on realtime.messages
for select to authenticated using (
 extension='broadcast'
 and realtime.topic() = 'team:' || (select private_access.team_owner())::text || ':communications'
 and (select private_access.team_role()) in ('admin','manager','coach','secretary')
);
create function private_access.broadcast_staff_communications() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 owner_id := case when tg_op='DELETE' then old.user_id else new.user_id end;
 perform realtime.send('{}'::jsonb,'communications_changed','team:'||owner_id::text||':communications',true);
 return null;
end $$;
revoke all on function private_access.broadcast_staff_communications() from public,anon,authenticated;
create trigger broadcast_staff_communications after insert or update or delete on public.staff_communications
for each row execute function private_access.broadcast_staff_communications();
