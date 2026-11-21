-- Optional per-ingredient shelf life (in days). 1 = use the day you buy it,
-- 2 = that day or the next, etc. The shopping list uses this + the meal
-- dates contributing to each row to suggest "buy Thu-Fri" style windows
-- when the ingredient would otherwise spoil before the meal is cooked.
-- Run in Supabase SQL editor.

alter table ingredients
  add column if not exists shelf_life_days integer
    check (shelf_life_days is null or shelf_life_days > 0);
