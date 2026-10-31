-- Staples no longer get auto-created as rows in shopping_items. The staples
-- section fetches ingredients directly and only creates/updates a row when
-- the user actively picks 🏠 or 🛒 (and deletes it when picking ? back).
-- Clear out the leftover not_checked staple rows from the old auto-add behavior.
-- Rows the user has intentionally set (have, to_buy, bought) are untouched.
-- Run in Supabase SQL editor.

delete from shopping_items
where source = 'staple'
  and state = 'not_checked';
