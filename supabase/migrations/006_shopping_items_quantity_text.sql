-- Phase 5: shopping_items uses free-text quantity.
-- The parser lives in src/lib/quantity.ts and runs during sync.
-- Run in Supabase SQL editor.

alter table shopping_items add column if not exists quantity text;
alter table shopping_items drop column if exists qty;
alter table shopping_items drop column if exists unit;
