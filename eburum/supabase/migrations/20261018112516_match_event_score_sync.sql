-- Keep existing scores and history intact. Only subsequent event mutations adjust the score.
create function private_access.sync_match_event_score() returns trigger
language plpgsql security invoker set search_path='' as $$
declare before_goal boolean:=false; after_goal boolean:=false;
 before_own boolean:=false; after_own boolean:=false;
 mid uuid; owner uuid; own_delta integer; away_delta integer;
begin
 if tg_op<>'INSERT' then
  mid:=old.match_id; owner:=old.user_id;
  before_goal:=old.event_type='Gol'; before_own:=old.player_id is not null;
 end if;
 if tg_op<>'DELETE' then
  mid:=new.match_id; owner:=new.user_id;
  after_goal:=new.event_type='Gol'; after_own:=new.player_id is not null;
 end if;
 if tg_op='UPDATE' and to_jsonb(old) is not distinct from to_jsonb(new) then return null;end if;
 -- The existing BEFORE trigger locks the parent activity first, serializing event writers.
 perform 1 from public.matches where id=mid and user_id=owner for update;
 if not found then return null;end if;
 own_delta:=(after_goal and after_own)::integer-(before_goal and before_own)::integer;
 away_delta:=(after_goal and not after_own)::integer-(before_goal and not before_own)::integer;
 if own_delta<>0 or away_delta<>0 then
  update public.matches set
   goals_for=greatest(0,coalesce(goals_for,0)+own_delta),
   goals_against=greatest(0,coalesce(goals_against,0)+away_delta)
  where id=mid and user_id=owner;
 end if;
 -- A result or lineup draft based on the previous timeline must fail its revision check.
 update public.activities set revision=revision+1 where match_id=mid and user_id=owner;
 return null;
end $$;
revoke all on function private_access.sync_match_event_score() from public,anon,authenticated;
create trigger match_event_score after insert or update or delete on public.match_events
 for each row execute function private_access.sync_match_event_score();
notify pgrst,'reload schema';
