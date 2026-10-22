-- Phase 3 revision: recipe_ingredients.quantity goes back to a single text field.
-- The shopping-list code will parse it later when summing identical ingredients.
-- Run in Supabase SQL editor.

alter table recipe_ingredients add column if not exists quantity text;

update recipe_ingredients
set quantity = case
  when unit is null or btrim(unit) = '' then trim(trailing '.0' from qty::text)
  else trim(trailing '.0' from qty::text) || ' ' || unit
end
where quantity is null;

alter table recipe_ingredients drop column if exists qty;
alter table recipe_ingredients drop column if exists unit;

-- Prevent the same ingredient appearing twice in one recipe.
create unique index if not exists recipe_ingredients_recipe_ingredient_uq
  on recipe_ingredients (recipe_id, ingredient_id);
