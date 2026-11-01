-- Track what contributes to each merged shopping line + add a notes field.
-- A single "2 cans tomato" row might have contributions from 2 recipes
-- plus a staple plus a manual add; we want to show that breakdown on expand.
-- Run in Supabase SQL editor.

alter table shopping_items add column if not exists notes text;

create table if not exists shopping_item_sources (
  id uuid primary key default gen_random_uuid(),
  shopping_item_id uuid not null references shopping_items(id) on delete cascade,
  kind text not null check (kind in ('meal', 'staple', 'manual')),
  meal_plan_id uuid references meal_plan(id) on delete set null,
  quantity text,
  created_at timestamptz not null default now()
);

create index if not exists shopping_item_sources_item_idx
  on shopping_item_sources (shopping_item_id);

-- All reads/writes go through the server (service_role key); clients using
-- anon or authenticated keys have no access to this table.
alter table shopping_item_sources enable row level security;
