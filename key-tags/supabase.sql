-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
create table if not exists items (
  id text primary key,
  kind text not null,
  data jsonb not null,
  created_at timestamptz default now()
);
create index if not exists items_kind on items (kind);

alter table items enable row level security;

-- Prototype only: anyone with the app link can read and write.
create policy "prototype open access" on items
  for all using (true) with check (true);
