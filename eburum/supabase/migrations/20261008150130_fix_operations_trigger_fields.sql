create or replace function private_access.stamp_operations() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Squadra immutabile' using errcode='42501';end if;
 if tg_table_name='activities' then
  if tg_op='UPDATE' then
   if new.match_id is distinct from old.match_id then raise exception 'Collegamenti attività immutabili' using errcode='42501';end if;
   if new.activity_type is distinct from old.activity_type and not exists(select 1 from public.sessions where id=new.session_id and user_id=new.user_id and session_type=new.activity_type) then raise exception 'Tipo attività immutabile' using errcode='42501';end if;
   if new.session_id is distinct from old.session_id and (old.session_id is not null or not exists(select 1 from public.sessions where id=new.session_id and user_id=new.user_id and session_date=new.activity_date and session_type=new.activity_type)) then raise exception 'Sessione non coerente' using errcode='42501';end if;
   new.request_id:=coalesce(old.request_id,new.request_id);new.revision:=old.revision+1;
  else new.revision:=0;end if;
 elsif tg_op='UPDATE' then
  if tg_table_name='activity_roster' then
   if (new.activity_id,new.player_id) is distinct from (old.activity_id,old.player_id) then raise exception 'Partecipante immutabile' using errcode='42501';end if;
  elsif tg_table_name='player_administration' then
   if new.player_id<>old.player_id then raise exception 'Giocatore immutabile' using errcode='42501';end if;
  elsif tg_table_name='activity_technical' then
   if new.activity_id<>old.activity_id then raise exception 'Attività immutabile' using errcode='42501';end if;
  end if;
 end if;
 new.updated_at:=clock_timestamp();new.updated_by:=auth.uid();return new;
end $$;
