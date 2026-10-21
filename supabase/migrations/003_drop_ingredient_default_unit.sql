-- Phase 3 revision: units are per-recipe, not per-ingredient.
-- Run this in the Supabase SQL editor.

alter table ingredients drop column if exists default_unit;
