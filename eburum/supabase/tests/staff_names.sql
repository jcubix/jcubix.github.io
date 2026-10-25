begin;
do $$declare owner uuid;begin
 select claimed_by into owner from private_import.bootstrap_state where singleton;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 update public.team_members set first_name='Giàcomo',last_name='D’Angelo' where user_id=owner;
 if public.team_context()->>'first_name'<>'Giàcomo' then raise exception 'First name missing from team context';end if;
 if public.team_context()->>'last_name'<>'D’Angelo' then raise exception 'Last name missing from team context';end if;
 begin
  update public.team_members set first_name=repeat('x',81) where user_id=owner;
  raise exception 'Name constraint missing';
 exception when check_violation then null;end;
end $$;
set local role authenticated;
do $$declare blocked boolean:=false;begin
 if public.team_context()->>'first_name'<>'Giàcomo' then raise exception 'Current user cannot read greeting';end if;
 begin update public.team_members set first_name='Uncontrolled' where user_id=auth.uid();
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Client can bypass managed name changes';end if;
end $$;
rollback;
