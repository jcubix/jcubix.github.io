-- Auth soft deletion keeps audit/finance references while revoking stale JWT permissions atomically.
create function private_access.revoke_deleted_staff_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.deleted_at is null and new.deleted_at is not null then
  if exists(select 1 from public.team_members where user_id=new.id and owner_id=new.id) then
   raise exception 'Il proprietario della squadra non può essere eliminato' using errcode='42501';
  end if;
  delete from public.team_members where user_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private_access.revoke_deleted_staff_access() from public,anon,authenticated;
create trigger eburum_revoke_deleted_staff_access after update of deleted_at on auth.users
for each row execute function private_access.revoke_deleted_staff_access();
