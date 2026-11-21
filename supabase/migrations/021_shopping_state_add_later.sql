-- Add 'later' to the shopping_items.state enum. Semantics: I've reviewed
-- this item and decided I'm not buying it on this trip. Visually muted on
-- the shopping list (no strikethrough, that's reserved for 'bought').
-- Persists across Finish shopping for meal/manual rows; staple rows get
-- reset to 'not_checked' by the existing staple-reset step.
-- Run in Supabase SQL editor.

alter table shopping_items drop constraint if exists shopping_items_state_check;
alter table shopping_items
  add constraint shopping_items_state_check
  check (state in ('not_checked', 'to_buy', 'have', 'bought', 'later'));
