-- À exécuter une fois dans le SQL Editor du projet Supabase de Fusiona.
begin;
create table if not exists public.fusiona_equipe (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('task','money')),
  label text not null check (length(label) between 1 and 180),
  member text not null default '' check (member in ('','Gatien','Jules')),
  article text not null default '',
  cents bigint not null default 0,
  done boolean not null default false,
  check ((kind='task' and cents=0) or (kind='money' and cents between 1 and 9999999900 and not done))
);
create index if not exists fusiona_equipe_owner on public.fusiona_equipe(user_id, id);
alter table public.fusiona_equipe enable row level security;
revoke all on public.fusiona_equipe from public, anon, authenticated;
grant select, insert, delete on public.fusiona_equipe to authenticated;
grant update(member, done) on public.fusiona_equipe to authenticated;
drop policy if exists equipe_compte on public.fusiona_equipe;
create policy equipe_compte on public.fusiona_equipe for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='fusiona_equipe') then
    alter publication supabase_realtime add table public.fusiona_equipe;
  end if;
end $$;
do $$ declare t text; begin
  foreach t in array array['articles','reglages'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
        and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
commit;
