-- Linked recipes on ingredients + "need to make" state for their shopping rows.
--
-- An ingredient can point to a recipe (bolognaise sauce -> bolognaise sauce
-- recipe). When the user picks "Need to make" for a linked ingredient on
-- the shopping list, the parent row flips to state='need_to_make' and the
-- recipe's ingredients are inserted as child shopping_items (source='recipe',
-- with a shopping_item_sources row of kind='recipe' pointing back at the
-- parent via source_ref so we can sweep them on undo).
-- Run in Supabase SQL editor.

alter table ingredients
  add column if not exists linked_recipe_id uuid
    references recipes(id) on delete set null;

alter table shopping_items drop constraint if exists shopping_items_state_check;
alter table shopping_items
  add constraint shopping_items_state_check
  check (state in ('not_checked', 'to_buy', 'have', 'bought', 'later', 'need_to_make'));

alter table shopping_items drop constraint if exists shopping_items_source_check;
alter table shopping_items
  add constraint shopping_items_source_check
  check (source in ('meal', 'staple', 'manual', 'recipe'));

alter table shopping_item_sources drop constraint if exists shopping_item_sources_kind_check;
alter table shopping_item_sources
  add constraint shopping_item_sources_kind_check
  check (kind in ('meal', 'staple', 'manual', 'recipe'));

-- Recipe-kind sources carry a pointer back at the parent shopping_items.id
-- (the row that's in need_to_make state). Cascades so sweeping the parent
-- cleans up the source rows automatically; children are tidied by the
-- server action when the parent transitions out of need_to_make.
alter table shopping_item_sources
  add column if not exists source_ref uuid
    references shopping_items(id) on delete cascade;

create index if not exists shopping_item_sources_source_ref_idx
  on shopping_item_sources (source_ref) where source_ref is not null;
