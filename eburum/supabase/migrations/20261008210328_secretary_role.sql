-- Administrative staff can maintain roster and documents, with sporting data read-only.
alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check check(role in ('admin','manager','coach','secretary'));
create or replace function private_access.assign_team_member() returns trigger language plpgsql security definer set search_path='' as $$
declare creator public.team_members%rowtype; assigned_role text;begin
 if new.raw_app_meta_data->>'created_by' is not null then
  select * into creator from public.team_members where user_id=(new.raw_app_meta_data->>'created_by')::uuid and role='admin';
  if not found then raise exception 'Amministratore della squadra non valido' using errcode='42501';end if;
  assigned_role:=coalesce(new.raw_app_meta_data->>'team_role','manager');
  if assigned_role not in ('admin','manager','coach','secretary') then raise exception 'Ruolo non valido' using errcode='22023';end if;
  insert into public.team_members(user_id,owner_id,role,display_name) values(new.id,creator.owner_id,assigned_role,coalesce(new.email,''));
 else
  insert into public.team_members(user_id,owner_id,role,display_name) values(new.id,new.id,'manager',coalesce(new.email,''));
 end if;return null;end $$;
revoke all on function private_access.assign_team_member() from public,anon,authenticated;

grant execute on function private_access.assign_team_member() to supabase_auth_admin;
do $$declare t text; rule text;begin
 foreach t in array array['players','player_administration','sessions','attendance','matches','match_events','activities','activity_roster'] loop
  rule:='user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ';
  if t in ('players','player_administration') then rule:=rule||'(''admin'',''manager'',''secretary'')';else rule:=rule||'(''admin'',''manager'',''coach'')';end if;
  execute format('alter policy %I on public.%I with check(%s)',t||'_create',t,rule);
  execute format('alter policy %I on public.%I using(%s) with check(%s)',t||'_edit',t,rule,rule);
  if t='player_administration' then execute format('alter policy %I on public.%I using(%s)',t||'_read',t,rule);end if;
 end loop;
end $$;
