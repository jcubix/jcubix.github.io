-- Add one-point training equipment; retain the existing authorization, limits,
-- revision conflict handling, and activity ownership checks unchanged.
CREATE OR REPLACE FUNCTION private_access.validate_tactical_board()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
   or kind is null or kind not in ('pen','arrow','circle','text','home','away','disc','cone','pole','mannequin','ball','hurdle','ladder','mini_goal','hoop')
   or (m->>'color') is null or (m->>'color') not in ('#ffffff','#ff7b8b','#f4cf63','#80caff')
   or jsonb_typeof(m->'label') is distinct from 'string' or length(m->>'label')>80
   or jsonb_typeof(m->'points') is distinct from 'array' then raise exception 'Elemento della lavagna non valido' using errcode='22023';end if;
   ids:=array_append(ids,m->>'id');
   if jsonb_array_length(m->'points') not between 1 and 600
   or (kind in ('arrow','circle') and jsonb_array_length(m->'points')<>2)
   or (kind in ('text','home','away','disc','cone','pole','mannequin','ball','hurdle','ladder','mini_goal','hoop') and jsonb_array_length(m->'points')<>1) then raise exception 'Geometria della lavagna non valida' using errcode='22023';end if;
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
   if new.revision<>old.revision then raise exception 'Lavagna modificata da un collega. Riaprila prima di salvare.' using errcode='PT409';end if;
   new.revision:=old.revision+1;
 else new.revision:=1;new.created_at:=now();new.created_by:=auth.uid();end if;
 new.updated_at:=now();new.updated_by:=auth.uid();return new;
end $function$;
