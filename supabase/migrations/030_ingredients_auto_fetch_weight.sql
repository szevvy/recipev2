-- Per-ingredient opt-in for pulling Woolworths' UnitWeightInGrams on each
-- price refresh, writing to ingredient_retailer_weights(woolworths).
-- Replaces the manual per-retailer weight widget for anything that
-- ticks this flag. Default off — users opt in per ingredient.
--
-- Run in Supabase SQL editor.

alter table ingredients
  add column if not exists auto_fetch_weight boolean not null default false;
