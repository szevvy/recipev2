-- Per-(ingredient, retailer) unit weight in grams. Lets us derive $/kg
-- from an each price when the retailer only publishes "each" pricing
-- (e.g. Woolworths Pink Lady apples at $0.86 each, no $/kg listed) so
-- cross-retailer chips compare like-for-like.
--
-- Stored per retailer (not per stock_code) because the weight is a
-- physical property of the item and doesn't change between SKUs of the
-- same thing at that retailer — the user sets it once per retailer.
--
-- Run in Supabase SQL editor.

create table if not exists ingredient_retailer_weights (
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  retailer text not null check (retailer in ('coles', 'woolworths', 'aldi')),
  unit_weight_g integer not null check (unit_weight_g > 0),
  updated_at timestamptz not null default now(),
  primary key (ingredient_id, retailer)
);

alter table ingredient_retailer_weights enable row level security;
