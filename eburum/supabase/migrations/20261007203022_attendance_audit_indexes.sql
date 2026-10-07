create index sessions_updated_by_idx on public.sessions(updated_by);
create index attendance_updated_by_idx on public.attendance(updated_by);
create index attendance_history_actor_idx on public.attendance_history(actor_id);
create index attendance_history_player_idx on public.attendance_history(player_id);
create index attendance_history_session_idx on public.attendance_history(session_id);
