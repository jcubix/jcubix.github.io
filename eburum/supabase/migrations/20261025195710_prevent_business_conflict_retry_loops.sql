-- Business revision conflicts must not use serialization_failure: PostgREST 14
-- retries 40001 indefinitely. PT409 preserves the conflict and returns HTTP 409.
-- Replace only the audited functions; keep their signatures, privileges and logic.
do $migration$
declare
  target record;
  definition text;
begin
  for target in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and (
      (n.nspname='public' and p.proname in (
        'save_dismissal_sanction','save_attendance_session','save_tactical_board',
        'save_match_result','save_team_activity','save_training_attendance',
        'save_activity_observation'
      )) or
      (n.nspname='private_access' and p.proname in (
        'validate_tactical_board','sync_calendar','finance_mutate'
      ))
    ) and p.prosrc like '%''40001''%'
  loop
    definition := pg_get_functiondef(target.oid);
    execute replace(definition, '''40001''', '''PT409''');
  end loop;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and n.nspname in ('public','private_access')
      and p.prosrc like '%''40001''%'
  ) then
    raise exception 'Unreviewed business serialization error remains';
  end if;
end
$migration$;
