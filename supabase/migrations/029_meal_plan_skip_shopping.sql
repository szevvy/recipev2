-- Per-meal "don't put this on the shopping list" flag. Useful when
-- you're eating out that night, already have everything, or just
-- don't want sync to add the ingredients for some other reason.
-- Different from shopped_at (which means "we already bought these
-- for this meal"); skip_shopping means "never add these at all".
--
-- Run in Supabase SQL editor.

alter table meal_plan
  add column if not exists skip_shopping boolean not null default false;
