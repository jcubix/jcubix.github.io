create extension if not exists pg_cron with schema pg_catalog;
create table public.staff_communications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 player_id uuid,
 title text not null check(length(btrim(title)) between 1 and 120),
 body text not null check(length(btrim(body)) between 1 and 4000),
 retention_days integer not null check(retention_days in (1,3,7)),
 created_by uuid not null references auth.users(id) on delete cascade,
 author_label text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check(expires_at>created_at),
 foreign key(user_id,player_id) references public.players(user_id,id) on delete set null (player_id)
);
create index staff_communications_owner_expiry_idx on public.staff_communications(user_id,expires_at);
create index staff_communications_expiry_idx on public.staff_communications(expires_at);
create index staff_communications_author_idx on public.staff_communications(created_by);
create index staff_communications_player_idx on public.staff_communications(player_id);
alter table public.staff_communications enable row level security;
revoke all on public.staff_communications from anon,authenticated;
grant select,insert,delete on public.staff_communications to authenticated;
create policy staff_communications_read on public.staff_communications for select to authenticated
 using(user_id=(select private_access.team_owner()) and expires_at>now());
create policy staff_communications_create on public.staff_communications for insert to authenticated
 with check(user_id=(select private_access.team_owner()) and created_by=(select auth.uid()) and (select private_access.team_role()) in ('admin','manager','coach','secretary'));
create policy staff_communications_remove on public.staff_communications for delete to authenticated
 using(user_id=(select private_access.team_owner()) and (created_by=(select auth.uid()) or (select private_access.team_role())='admin'));
create function private_access.stamp_staff_communication() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Accesso richiesto' using errcode='42501';end if;
 new.title:=btrim(new.title);new.body:=btrim(new.body);
 new.created_at:=now();new.created_by:=auth.uid();
 new.expires_at:=now()+make_interval(hours=>24*new.retention_days);
 select coalesce(nullif(display_name,''),'Staff') into new.author_label from public.team_members where user_id=auth.uid();
 return new;
end $$;
revoke all on function private_access.stamp_staff_communication() from public,anon;
grant execute on function private_access.stamp_staff_communication() to authenticated;
create trigger stamp_staff_communication before insert on public.staff_communications for each row execute function private_access.stamp_staff_communication();
create function private_access.purge_expired_communications() returns integer language plpgsql security invoker set search_path='' as $$
declare removed integer;
begin
 delete from public.staff_communications where expires_at<=now();get diagnostics removed=row_count;return removed;
end $$;
revoke all on function private_access.purge_expired_communications() from public,anon,authenticated;
select cron.schedule('eburum-expire-communications','* * * * *','select private_access.purge_expired_communications();');
