-- One-shot cleanup after introducing the 'not_checked' state.
-- Items created before migration 009 landed got the old default of 'to_buy'
-- (basket icon). Reset meal + staple rows that are still at that default
-- so they appear as '?' and the user can review them.
-- Manual items are untouched (user explicitly chose basket).
-- have/bought rows are also untouched (user's deliberate state).
-- Run in Supabase SQL editor.

update shopping_items
set state = 'not_checked'
where source in ('meal', 'staple')
  and state = 'to_buy';
