-- Track every purchase so we can learn how often we buy things
-- (and later predict when we're about to run out).
-- Written on Finish shopping — one row per ingredient per trip,
-- preserving the raw bought quantity. Never overwritten.
-- Run in Supabase SQL editor.

create table if not exists purchase_history (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  quantity text,
  purchased_at timestamptz not null default now()
);

create index if not exists purchase_history_ingredient_idx
  on purchase_history (ingredient_id, purchased_at desc);

alter table purchase_history enable row level security;
