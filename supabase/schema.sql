-- Recipe / Meal Planner / Shopping List schema.
-- Run this once in the Supabase SQL editor for a fresh project.

create extension if not exists pgcrypto;

-- Ingredients. Groups are derived from the distinct `group_name` values.
-- Units are specified per recipe row, not here.
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  group_name text,
  is_staple boolean not null default false,
  staple_state text not null default 'not_checked'
    check (staple_state in ('not_checked', 'need', 'have')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ingredients_group_idx on ingredients (group_name);
create index ingredients_is_staple_idx on ingredients (is_staple) where is_staple;

-- Recipes.
create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instructions text,
  source_url text,
  default_servings numeric not null default 4 check (default_servings > 0),
  prep_minutes int check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes int check (cook_minutes is null or cook_minutes >= 0),
  image_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Join table of recipe -> ingredient. `quantity` is free text ("500g", "1 1/2 cups",
-- "2 cloves") and gets parsed at shopping-list-generation time.
create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  quantity text,
  note text,
  sort_order int not null default 0,
  unique (recipe_id, ingredient_id)
);
create index recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_idx on recipe_ingredients (ingredient_id);

-- Meal plan: one row per planned meal.
-- shopped_at: non-null once this meal has been included in a finished
-- shopping trip. Set back to null when the recipe or servings changes.
create table meal_plan (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  recipe_id uuid not null references recipes(id) on delete cascade,
  servings numeric check (servings is null or servings > 0),
  slot text,
  shopped_at timestamptz,
  created_at timestamptz not null default now()
);
create index meal_plan_date_idx on meal_plan (date);

-- Shopping items: persistent 4-state working list.
--   state=not_checked  ? — fresh, needs a decision (default for meal/staple sync)
--   state=to_buy       🛒 — on the active list, need to buy this trip
--   state=have         🏠 — already at home, hidden from the active list
--   state=bought       ✓ — purchased this trip (deleted on Finish shopping)
-- Source is 'meal' | 'staple' | 'manual'. On sync, rows with any user-set state
-- are preserved. `quantity` is free text; parser in src/lib/quantity.ts.
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  quantity text,
  source text not null check (source in ('meal', 'staple', 'manual')),
  source_ref uuid,
  state text not null default 'not_checked'
    check (state in ('not_checked', 'to_buy', 'have', 'bought')),
  created_at timestamptz not null default now()
);
create index shopping_items_ingredient_idx on shopping_items (ingredient_id);
create index shopping_items_state_idx on shopping_items (state);

-- updated_at triggers for the two mutable tables.
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger ingredients_set_updated_at before update on ingredients
  for each row execute function set_updated_at();
create trigger recipes_set_updated_at before update on recipes
  for each row execute function set_updated_at();

-- Household-wide settings. Single-row table.
-- week_starts_on: 0 = Sunday, 1 = Monday (ISO default).
create table app_settings (
  id int primary key default 1 check (id = 1),
  week_starts_on int not null default 1 check (week_starts_on between 0 and 6),
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict do nothing;

-- Lock down direct client access. All reads/writes go through the server
-- (service_role key) after the shared-password cookie check in middleware.
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table meal_plan enable row level security;
alter table shopping_items enable row level security;
alter table app_settings enable row level security;
