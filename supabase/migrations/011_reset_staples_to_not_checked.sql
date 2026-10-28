-- Migration 008 seeded staples as 'have' (sensible-sounding assumption at the time:
-- you have your staples). Turns out that's wrong — the user wants to review each
-- staple deliberately each trip. Reset them to 'not_checked' so the picker starts at ?.
-- Users who had legitimately set some staples to 'have' can re-click 🏠.
-- Run in Supabase SQL editor.

update shopping_items
set state = 'not_checked'
where source = 'staple'
  and state = 'have';
