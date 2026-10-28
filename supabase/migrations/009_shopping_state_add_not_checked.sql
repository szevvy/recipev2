-- Phase 5 revision: add 'not_checked' as a 4th state.
-- Items from meal/staple sync now default to not_checked (?) so the user
-- consciously decides each one; manual adds still default to to_buy (🛒).
-- Run in Supabase SQL editor.

alter table shopping_items drop constraint if exists shopping_items_state_check;
alter table shopping_items
  add constraint shopping_items_state_check
  check (state in ('not_checked', 'to_buy', 'have', 'bought'));

-- Any existing 'have' row that was seeded from staples (not deliberately chosen)
-- stays 'have' - user explicitly picked it or the migration script did.
-- We don't retroactively reset anything.
