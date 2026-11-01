-- Allow one-off shopping items that aren't ingredients (blown light bulb,
-- batteries, etc). ingredient_id becomes nullable; a new name column holds
-- the display string for rows that don't link to an ingredient. A row must
-- have at least one of the two.
-- Run in Supabase SQL editor.

alter table shopping_items add column if not exists name text;

alter table shopping_items alter column ingredient_id drop not null;

alter table shopping_items drop constraint if exists shopping_items_name_or_ingredient;
alter table shopping_items
  add constraint shopping_items_name_or_ingredient
  check (ingredient_id is not null or name is not null);
