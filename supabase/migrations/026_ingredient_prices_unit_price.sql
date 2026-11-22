-- Store the unit price ($/kg, $/L, $/each...) as structured data so the
-- shopping list can compare like-for-like across variants and retailers.
-- Pack price alone is misleading when pack sizes differ.
-- Run in Supabase SQL editor.

alter table ingredient_prices
  add column if not exists unit_price_cents integer,
  add column if not exists unit_of_measure text;
