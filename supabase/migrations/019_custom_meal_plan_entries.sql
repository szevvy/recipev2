-- Allow a meal_plan row to be a one-off custom entry: no row in `recipes`,
-- just a free-form title + its own inline ingredient list (library picks or
-- free-text one-offs). Custom ingredients participate in shopping sync like
-- recipe ingredients.
-- Run in Supabase SQL editor.

alter table meal_plan alter column recipe_id drop not null;
alter table meal_plan add column if not exists custom_name text;

create table if not exists meal_plan_custom_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references meal_plan(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  -- Free-text entries store `name` with ingredient_id null.
  name text,
  quantity text,
  sort_order int not null default 0,
  check (ingredient_id is not null or name is not null)
);

create index if not exists meal_plan_custom_ingredients_meal_idx
  on meal_plan_custom_ingredients (meal_plan_id);

alter table meal_plan_custom_ingredients enable row level security;
