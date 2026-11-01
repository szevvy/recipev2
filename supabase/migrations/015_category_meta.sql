-- Per-category customization: color + sort order.
-- Category names come from distinct ingredients.group_name values (unchanged
-- paradigm — categories exist only when some ingredient uses them). This table
-- just carries metadata about them.
-- color: a token name from the palette in src/lib/category-palette.ts (not a hex)
--        so a theme refresh updates every category at once.
-- sort_order: lower = earlier in the shopping list (produce first, freezer last).
-- Run in Supabase SQL editor.

create table if not exists category_meta (
  name text primary key,
  color text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table category_meta enable row level security;
