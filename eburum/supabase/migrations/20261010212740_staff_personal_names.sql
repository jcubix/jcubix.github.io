-- Personal names are staff data, independent of authorization and Auth email.
alter table public.team_members
  add column first_name text not null default '',
  add column last_name text not null default '',
  add constraint team_members_first_name_length check (char_length(first_name) <= 80),
  add constraint team_members_last_name_length check (char_length(last_name) <= 80);

-- Existing SELECT-only RLS is retained: clients cannot edit names or roles.
create or replace function public.team_context()
returns jsonb language sql stable set search_path = ''
as $$
  select jsonb_build_object('owner_id',owner_id,'role',role,'name','Eburum',
    'first_name',first_name,'last_name',last_name)
  from public.team_members where user_id=auth.uid()
$$;
