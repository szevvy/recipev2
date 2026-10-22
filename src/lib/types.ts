export type StapleState = "not_checked" | "need" | "have";

export type Ingredient = {
  id: string;
  name: string;
  group_name: string | null;
  is_staple: boolean;
  staple_state: StapleState;
  created_at: string;
  updated_at: string;
};

export type Recipe = {
  id: string;
  name: string;
  instructions: string | null;
  source_url: string | null;
  default_servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: string | null;
  note: string | null;
  sort_order: number;
};

export type MealPlanEntry = {
  id: string;
  date: string;
  recipe_id: string;
  servings: number | null;
  slot: string | null;
  created_at: string;
};

export type MealPlanWithRecipe = MealPlanEntry & {
  recipes: Pick<Recipe, "id" | "name" | "default_servings" | "image_url"> | null;
};

export type RecipeWithIngredients = Recipe & {
  recipe_ingredients: (RecipeIngredient & { ingredients: Pick<Ingredient, "id" | "name"> })[];
};

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type AppSettings = {
  id: number;
  week_starts_on: WeekStart;
  updated_at: string;
};
