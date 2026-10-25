alter table public.staff_communications
 add column kind text not null default 'notice' check(kind in ('notice','meeting')),
 add column meeting_date date,
 add column meeting_time time without time zone,
 add column meeting_location text check(length(meeting_location)<=500),
 add constraint staff_communication_meeting_fields check(
   (kind='notice' and meeting_date is null and meeting_time is null and meeting_location is null)
   or (kind='meeting' and meeting_date is not null and meeting_time is not null and player_id is null and requires_ack)
 );

create or replace function private_access.stamp_staff_communication() returns trigger language plpgsql security invoker set search_path='' as $$
declare meeting_at timestamptz; local_today date:=(now() at time zone 'Europe/Rome')::date;
begin
 if auth.uid() is null then raise exception 'Accesso richiesto' using errcode='42501';end if;
 new.title:=btrim(new.title);new.body:=btrim(new.body);
 new.created_at:=now();new.created_by:=auth.uid();
 if new.kind='meeting' then
   if private_access.team_role() not in ('admin','manager','coach') then raise exception 'Permesso di pianificazione richiesto per invitare a una riunione' using errcode='42501';end if;
   if new.meeting_date is null or new.meeting_time is null or new.meeting_date<local_today or new.meeting_date>local_today+366 then raise exception 'Inserisci data e ora di una riunione entro il prossimo anno' using errcode='22023';end if;
   new.player_id:=null;new.requires_ack:=true;new.meeting_location:=nullif(btrim(new.meeting_location),'');
   meeting_at:=(new.meeting_date+new.meeting_time) at time zone 'Europe/Rome';
   new.expires_at:=meeting_at+make_interval(hours=>24*new.retention_days);
 else new.expires_at:=now()+make_interval(hours=>24*new.retention_days);end if;
 select coalesce(nullif(display_name,''),'Staff') into new.author_label from public.team_members where user_id=auth.uid();
 return new;
end $$;
