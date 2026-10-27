-- Phase 5 fix: track which planned meals have already been shopped for,
-- so finishing shopping doesn't repopulate them on the next page load.
-- A meal with shopped_at IS NOT NULL is skipped by syncShoppingList.
-- Setting/changing the meal's recipe clears shopped_at so the new
-- ingredients appear on the next shopping trip.
-- Run in Supabase SQL editor.

alter table meal_plan add column if not exists shopped_at timestamptz;
