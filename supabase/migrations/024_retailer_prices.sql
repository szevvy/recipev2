-- Per-ingredient retailer stock codes + the latest price snapshot pulled
-- from Apify's vant47 australian-supermarket-prices-scraper actor.
--
-- - ingredient_retailer_codes: which Coles/Woolies/ALDI SKU corresponds
--   to this ingredient. One row per (ingredient, retailer) so each
--   ingredient can have at most one code per retailer.
-- - ingredient_prices: the most recent price snapshot per
--   (ingredient, retailer). Older snapshots are overwritten; a separate
--   history table can land later if we want trend charts.
-- - app_settings.postcode: single household postcode passed to the
--   scraper so prices reflect your actual nearest store.
--
-- Run in Supabase SQL editor.

alter table app_settings
  add column if not exists postcode text;

create table if not exists ingredient_retailer_codes (
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  retailer text not null check (retailer in ('coles', 'woolworths', 'aldi')),
  stock_code text not null,
  created_at timestamptz not null default now(),
  primary key (ingredient_id, retailer)
);

create index if not exists ingredient_retailer_codes_retailer_idx
  on ingredient_retailer_codes (retailer, stock_code);

alter table ingredient_retailer_codes enable row level security;

create table if not exists ingredient_prices (
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  retailer text not null check (retailer in ('coles', 'woolworths', 'aldi')),
  -- All prices stored as integer cents. NULL means the retailer returned
  -- the row but without a usable price (rare, usually promos w/o member).
  price_cents integer,
  regular_price_cents integer,
  on_sale boolean not null default false,
  -- false when the scraper returned a NOTE (out of stock) or the product
  -- id wasn't found in the retailer's response at all.
  in_stock boolean not null default true,
  unit_price_text text,
  product_title text,
  product_url text,
  image_url text,
  promo_text text,
  fetched_at timestamptz not null default now(),
  primary key (ingredient_id, retailer)
);

create index if not exists ingredient_prices_fetched_at_idx
  on ingredient_prices (fetched_at);

alter table ingredient_prices enable row level security;
