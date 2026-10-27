-- Phase 5 upgrade: shopping items get a 3-state enum
--   to_buy  — on the active list, need to buy this trip
--   have    — already in the pantry, hidden from the active list
--   bought  — purchased this trip (gets deleted on Finish shopping)
--
-- Also: meal_plan.shopped_at tracks which meals have been included in a
-- finished shopping trip, so re-sync doesn't repopulate their ingredients.
-- The old ingredients.staple_state is left in place (unused) in case we
-- ever want to roll back; the new state lives on shopping_items.
-- Run in Supabase SQL editor.

-- 1. Add state column
alter table shopping_items
  add column if not exists state text
    check (state in ('to_buy', 'have', 'bought'))
    default 'to_buy';

-- 2. Backfill from the old `bought` boolean (if it still exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'shopping_items' and column_name = 'bought'
  ) then
    update shopping_items
    set state = case when bought then 'bought' else 'to_buy' end;
  end if;
end $$;

alter table shopping_items alter column state set not null;
alter table shopping_items drop column if exists bought;
alter table shopping_items drop column if exists bought_at;

-- 3. Track shopped-for meals
alter table meal_plan add column if not exists shopped_at timestamptz;

-- 4. Seed shopping_items from existing staples:
--    - staple_state = 'need'          -> state = 'to_buy'
--    - staple_state = 'have'          -> state = 'have'
--    - staple_state = 'not_checked'   -> state = 'have' (default: assume you have your staples)
--    Only inserts if the ingredient isn't already in the list.
insert into shopping_items (ingredient_id, source, state)
select
  i.id,
  'staple',
  case i.staple_state
    when 'need' then 'to_buy'
    when 'have' then 'have'
    else 'have'
  end
from ingredients i
where i.is_staple = true
  and not exists (
    select 1 from shopping_items si
    where si.ingredient_id = i.id
      and si.source in ('staple', 'meal')
  );
