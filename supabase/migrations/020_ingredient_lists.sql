-- Generalize the single "is_staple" boolean on ingredients into a
-- many-to-many membership. "Staples" is now just one list of many —
-- users can create ad-hoc lists ("Dessert", "Camping") the same way
-- shopping categories work: type a new name on a row and it exists.
-- Run in Supabase SQL editor.

create table if not exists ingredient_list_memberships (
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  list_name text not null,
  created_at timestamptz not null default now(),
  primary key (ingredient_id, list_name)
);

create index if not exists ingredient_list_memberships_list_idx
  on ingredient_list_memberships (list_name);

alter table ingredient_list_memberships enable row level security;

-- Backfill: every is_staple=true ingredient becomes a member of "Staples".
insert into ingredient_list_memberships (ingredient_id, list_name)
select id, 'Staples'
from ingredients
where is_staple = true
on conflict do nothing;

-- Drop the now-redundant column.
alter table ingredients drop column if exists is_staple;
