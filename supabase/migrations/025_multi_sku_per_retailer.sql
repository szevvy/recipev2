-- Allow multiple product IDs per (ingredient, retailer) so one ingredient
-- can track price for several variants of the same thing — e.g. salmon
-- skin-on and salmon skin-off at Coles should both feed the same "Salmon"
-- ingredient, and the lowest price wins.
--
-- - ingredient_retailer_codes: widen PK from (ingredient_id, retailer) to
--   include stock_code.
-- - ingredient_prices: add stock_code column (backfilled from the matching
--   retailer_code row while there's still at most one per retailer), then
--   widen its PK the same way.
-- Run in Supabase SQL editor.

alter table ingredient_retailer_codes
  drop constraint if exists ingredient_retailer_codes_pkey;
alter table ingredient_retailer_codes
  add primary key (ingredient_id, retailer, stock_code);

alter table ingredient_prices
  add column if not exists stock_code text;

-- Backfill existing rows: there's still a 1:1 between prices and codes at
-- this point, so we can look up the stock_code directly.
update ingredient_prices p
  set stock_code = c.stock_code
  from ingredient_retailer_codes c
  where c.ingredient_id = p.ingredient_id
    and c.retailer = p.retailer
    and p.stock_code is null;

-- Drop any orphan price rows whose code vanished — they'd fail the NOT
-- NULL coming up and are stale data anyway.
delete from ingredient_prices where stock_code is null;

alter table ingredient_prices
  alter column stock_code set not null;
alter table ingredient_prices
  drop constraint if exists ingredient_prices_pkey;
alter table ingredient_prices
  add primary key (ingredient_id, retailer, stock_code);
