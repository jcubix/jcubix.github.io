-- Auth's dedicated runtime executes the managed-account membership trigger.
grant execute on function private_access.assign_team_member() to supabase_auth_admin;
