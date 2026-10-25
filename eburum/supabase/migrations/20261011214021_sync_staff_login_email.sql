-- Auth and staff directory change in the same transaction.
create function private_access.sync_staff_login_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.email is distinct from old.email then
  update public.team_members set display_name=new.email where user_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private_access.sync_staff_login_email() from public,anon,authenticated;
create trigger eburum_sync_staff_login_email after update of email on auth.users
for each row execute function private_access.sync_staff_login_email();
