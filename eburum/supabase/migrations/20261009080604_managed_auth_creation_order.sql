-- GoTrue inserts auth.users before applying Admin API app_metadata.
-- Validate the final persisted row at transaction end, keeping Auth and membership atomic.
drop trigger eburum_require_managed_account on auth.users;
drop trigger assign_team_member on auth.users;

create function private_access.finalize_managed_account()
returns trigger language plpgsql security definer set search_path='' as $$
declare account auth.users%rowtype; creator public.team_members%rowtype; assigned_role text;
begin
 select * into account from auth.users where id=new.id;
 if not found then return null;end if;
 if account.raw_app_meta_data->>'managed_account' is distinct from 'true'
    or account.raw_app_meta_data->>'created_by' is null then
  raise exception 'Registrazione riservata agli amministratori' using errcode='42501';
 end if;
 select * into creator from public.team_members
 where user_id=(account.raw_app_meta_data->>'created_by')::uuid and role='admin' for share;
 if not found then raise exception 'Amministratore della squadra non valido' using errcode='42501';end if;
 assigned_role:=account.raw_app_meta_data->>'team_role';
 if assigned_role is null or assigned_role not in ('admin','manager','coach','secretary') then
  raise exception 'Ruolo non valido' using errcode='22023';
 end if;
 insert into public.team_members(user_id,owner_id,role,display_name)
 values(account.id,creator.owner_id,assigned_role,coalesce(account.email,''));
 return null;
end $$;
revoke all on function private_access.finalize_managed_account() from public,anon,authenticated;
grant execute on function private_access.finalize_managed_account() to supabase_auth_admin;
create constraint trigger eburum_finalize_managed_account
after insert on auth.users deferrable initially deferred
for each row execute function private_access.finalize_managed_account();
