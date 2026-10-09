-- Composite indexes cover the team-scoped foreign keys. No rows or policies change.
set local lock_timeout = '5s';
create index if not exists disciplinary_clearances_owner_player_idx
 on public.disciplinary_clearances (user_id, player_id);
create index if not exists disciplinary_clearances_owner_served_idx
 on public.disciplinary_clearances (user_id, served_match_id);
create index if not exists staff_communications_owner_player_idx
 on public.staff_communications (user_id, player_id);
