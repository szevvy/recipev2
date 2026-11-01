-- The merge logic groups contributions by (ingredient_id, normalized unit).
-- Example: 2 clove garlic + 1 garlic → two merged rows for the same ingredient.
-- Previously the sync keyed by ingredient_id alone, so one merged entry
-- clobbered the other and left orphans with no sources.
--
-- This adds a unit_key column so each merged bucket maps to a distinct row.
-- Also cleans up the orphan rows that bad past syncs left behind:
--   source=meal AND state in (not_checked, to_buy) AND no sources
--   AND another meal row exists for the same ingredient.
-- Rows the user has explicitly set to have/bought are untouched.
-- Run in Supabase SQL editor.

alter table shopping_items add column if not exists unit_key text;

delete from shopping_items a
where a.source = 'meal'
  and a.state in ('not_checked', 'to_buy')
  and not exists (
    select 1 from shopping_item_sources sis where sis.shopping_item_id = a.id
  )
  and exists (
    select 1 from shopping_items b
    where b.ingredient_id = a.ingredient_id
      and b.source = a.source
      and b.id != a.id
  );
