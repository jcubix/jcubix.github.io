-- Keep the privileged projection in the unexposed schema; the API wrapper follows RLS privileges.
alter function public.team_administration_summary() set schema private_access;
create function public.team_administration_summary() returns table(player_id uuid,registration_status text,certificate_status text,document_status text,needs_review boolean)
language sql stable security invoker set search_path='' as $$
 select * from private_access.team_administration_summary();
$$;
revoke all on function public.team_administration_summary() from public,anon;
grant execute on function public.team_administration_summary() to authenticated;
notify pgrst,'reload schema';
