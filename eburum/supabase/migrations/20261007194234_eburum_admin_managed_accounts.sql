create schema if not exists private_access;
revoke all on schema private_access from public, anon, authenticated;
create or replace function private_access.require_managed_account()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data->>'managed_account', '') <> 'true' then
    raise exception 'Registrazione riservata agli amministratori' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private_access.require_managed_account() from public, anon, authenticated;
grant usage on schema private_access to supabase_auth_admin;
grant execute on function private_access.require_managed_account() to supabase_auth_admin;
create trigger eburum_require_managed_account
before insert on auth.users for each row execute function private_access.require_managed_account();
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"role":"admin","managed_account":true}'::jsonb
from private_import.bootstrap_state b
where b.singleton and b.claimed_by = u.id;
