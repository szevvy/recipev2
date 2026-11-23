-- Price display preference: whether a chip shows pack price ($5.00),
-- per-kg price ($3.65/kg), or both. Default per group (set on
-- category_meta), overridable per ingredient.
--
-- - Fruit/veg/deli groups → typically per_kg so you can compare
--   across pack sizes.
-- - Pantry stuff (box of biscuits, carton of eggs) → typically pack
--   because the price IS the price and the pack size is fixed.
-- - Rice-like exceptions (same ingredient, different bag weights) →
--   override the single ingredient to "both" so you can compare.
--
-- Run in Supabase SQL editor.

alter table category_meta
  add column if not exists price_display text not null default 'both'
    check (price_display in ('pack', 'per_kg', 'both'));

alter table ingredients
  add column if not exists price_display_override text
    check (price_display_override in ('pack', 'per_kg', 'both'));
