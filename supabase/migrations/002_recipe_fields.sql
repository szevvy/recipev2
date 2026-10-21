-- Phase 3: add prep/cook time and image URL to recipes.
-- Run this in the Supabase SQL editor on existing projects.

alter table recipes
  add column if not exists prep_minutes int check (prep_minutes is null or prep_minutes >= 0),
  add column if not exists cook_minutes int check (cook_minutes is null or cook_minutes >= 0),
  add column if not exists image_url text;
