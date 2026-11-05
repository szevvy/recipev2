-- Expose the most-recent purchase_at per ingredient as a view, so the
-- staples list can show "last bought X days ago" without pulling the
-- whole purchase history client-side.
-- Run in Supabase SQL editor.

create or replace view latest_purchases as
select distinct on (ingredient_id)
  ingredient_id,
  purchased_at
from purchase_history
order by ingredient_id, purchased_at desc;
