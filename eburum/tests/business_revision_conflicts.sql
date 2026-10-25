-- Reject stale revisions without PostgREST's retryable serialization error.
-- No business records are changed; the transaction always rolls back.
begin;
select set_config('request.jwt.claim.sub',
  (select claimed_by::text from private_import.bootstrap_state where singleton),true);
set local role authenticated;
do $test$
declare activity_id uuid; rejected boolean:=false;
begin
  select id into strict activity_id from public.activities
    where user_id=private_access.team_owner() order by id limit 1;
  begin
    perform public.save_team_activity('{}'::jsonb,'[]'::jsonb,activity_id,-1);
  exception when sqlstate 'PT409' then rejected:=true;
  end;
  if not rejected then raise exception 'Stale revision must return HTTP 409';end if;
end
$test$;
reset role;
do $test$
begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and n.nspname in ('public','private_access')
      and p.prosrc like '%''40001''%') then
    raise exception 'Retryable business error remains';
  end if;
end
$test$;
rollback;
