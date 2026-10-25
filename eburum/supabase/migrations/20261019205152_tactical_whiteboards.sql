-- Photo snapshots and vector marks share one RLS-protected row: no public image URLs.
create table public.tactical_boards (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (length(btrim(title)) between 1 and 120),
 activity_id uuid,
 document jsonb not null,
 revision integer not null default 1 check (revision > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid,
 updated_by uuid
);
create index tactical_boards_owner_updated_idx on public.tactical_boards(user_id,updated_at desc,id);
create index tactical_boards_activity_idx on public.tactical_boards(user_id,activity_id);
alter table public.tactical_boards enable row level security;
revoke all on public.tactical_boards from public, anon, authenticated;
grant select,insert,update,delete on public.tactical_boards to authenticated;
create policy tactical_boards_team on public.tactical_boards for all to authenticated
using (user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','coach','technical_assistant'))
with check (user_id=(select private_access.team_owner()) and (select private_access.team_role()) in ('admin','coach','technical_assistant'));

create function private_access.validate_tactical_board() returns trigger language plpgsql security invoker set search_path='' as $$
declare d jsonb:=new.document; m jsonb; p jsonb; ids text[]:='{}'; bg text:=d->>'background'; kind text;
begin
 if auth.uid() is null or private_access.team_role() not in ('admin','coach','technical_assistant') or new.user_id is distinct from private_access.team_owner() then
   raise exception 'Accesso riservato allo staff tecnico' using errcode='42501';
 end if;
 if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>2000000 or jsonb_typeof(d->'background') is distinct from 'string'
 or length(bg)>1400000 or (bg<>'pitch' and bg !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')
 or jsonb_typeof(d->'marks') is distinct from 'array' then raise exception 'Lavagna non valida' using errcode='22023';end if;
 if jsonb_array_length(d->'marks')>200 then raise exception 'Massimo 200 elementi sulla lavagna' using errcode='22023';end if;
 for m in select value from jsonb_array_elements(d->'marks') loop
   kind:=m->>'kind';
   if jsonb_typeof(m) is distinct from 'object' or jsonb_typeof(m->'id') is distinct from 'string' or length(m->>'id') not between 1 and 64 or (m->>'id')=any(ids)
   or kind is null or kind not in ('pen','arrow','circle','text','home','away')
   or (m->>'color') is null or (m->>'color') not in ('#ffffff','#ff7b8b','#f4cf63','#80caff')
   or jsonb_typeof(m->'label') is distinct from 'string' or length(m->>'label')>80
   or jsonb_typeof(m->'points') is distinct from 'array' then raise exception 'Elemento della lavagna non valido' using errcode='22023';end if;
   ids:=array_append(ids,m->>'id');
   if jsonb_array_length(m->'points') not between 1 and 600
   or (kind in ('arrow','circle') and jsonb_array_length(m->'points')<>2)
   or (kind in ('text','home','away') and jsonb_array_length(m->'points')<>1) then raise exception 'Geometria della lavagna non valida' using errcode='22023';end if;
   for p in select value from jsonb_array_elements(m->'points') loop
     if jsonb_typeof(p->'x') is distinct from 'number' or jsonb_typeof(p->'y') is distinct from 'number' then raise exception 'Coordinate non valide' using errcode='22023';end if;
     if (p->>'x')::numeric not between 0 and 1000 or (p->>'y')::numeric not between 0 and 640 then raise exception 'Coordinate fuori campo' using errcode='22023';end if;
   end loop;
 end loop;
 -- A soft activity link preserves the board without blocking deletion of a match.
 if new.activity_id is not null and (tg_op='INSERT' or new.activity_id is distinct from old.activity_id)
 and not exists(select 1 from public.activities where id=new.activity_id and user_id=new.user_id and activity_type in ('Allenamento','Partita')) then
   raise exception 'Collega un allenamento o una partita della squadra' using errcode='22023';
 end if;
 new.title:=btrim(new.title);
 if tg_op='UPDATE' then
   if (new.id,new.user_id,new.created_at,new.created_by) is distinct from (old.id,old.user_id,old.created_at,old.created_by) then raise exception 'Identità lavagna non modificabile' using errcode='42501';end if;
   if new.revision<>old.revision then raise exception 'Lavagna modificata da un collega. Riaprila prima di salvare.' using errcode='40001';end if;
   new.revision:=old.revision+1;
 else new.revision:=1;new.created_at:=now();new.created_by:=auth.uid();end if;
 new.updated_at:=now();new.updated_by:=auth.uid();return new;
end $$;
revoke all on function private_access.validate_tactical_board() from public,anon,authenticated;
create trigger validate_tactical_board before insert or update on public.tactical_boards for each row execute function private_access.validate_tactical_board();

create function public.save_tactical_board(p_id uuid,p_title text,p_activity_id uuid,p_document jsonb,p_revision integer)
returns public.tactical_boards language plpgsql security invoker set search_path='' as $$
declare owner uuid:=private_access.team_owner(); b public.tactical_boards;
begin
 if auth.uid() is null or private_access.team_role() not in ('admin','coach','technical_assistant') then raise exception 'Accesso riservato allo staff tecnico' using errcode='42501';end if;
 if p_id is null then raise exception 'Identificativo lavagna richiesto' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into b from public.tactical_boards where id=p_id and user_id=owner for update;
 if found then
   -- A retry after a lost response returns the committed version without duplicating it.
   if (b.title,b.activity_id,b.document) is not distinct from (btrim(p_title),p_activity_id,p_document) then return b;end if;
   if b.revision is distinct from p_revision then raise exception 'Lavagna modificata da un collega. La tua bozza è conservata: esportala o riapri la versione salvata.' using errcode='40001';end if;
   update public.tactical_boards set title=p_title,activity_id=p_activity_id,document=p_document,revision=p_revision where id=p_id and user_id=owner returning * into b;
 else
   if p_revision is distinct from 0 then raise exception 'Lavagna non più disponibile. La tua bozza è conservata.' using errcode='40001';end if;
   insert into public.tactical_boards(id,user_id,title,activity_id,document) values(p_id,owner,p_title,p_activity_id,p_document) returning * into b;
 end if;
 return b;
end $$;
revoke all on function public.save_tactical_board(uuid,text,uuid,jsonb,integer) from public,anon;
grant execute on function public.save_tactical_board(uuid,text,uuid,jsonb,integer) to authenticated;
