-- Apply to staging first. Preflight: no players.shirt_number < 0.
begin;
alter table public.players add constraint players_shirt_number_nonnegative
  check (shirt_number is null or shirt_number >= 0) not valid;
alter table public.players validate constraint players_shirt_number_nonnegative;
commit;
