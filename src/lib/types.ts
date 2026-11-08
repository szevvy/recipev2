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
  recipe_id: string | null;
  custom_name: string | null;
  servings: number | null;
  slot: string | null;
  shopped_at: string | null;
  created_at: string;
};

export type MealPlanCustomIngredient = {
  id: string;
  meal_plan_id: string;
  ingredient_id: string | null;
  name: string | null;
  quantity: string | null;
  sort_order: number;
};

export type MealPlanCustomIngredientWithLink = MealPlanCustomIngredient & {
  ingredients: Pick<Ingredient, "id" | "name" | "group_name"> | null;
};

export type RecipeIngredientWithLink = {
  id: string;
  ingredient_id: string;
  quantity: string | null;
  sort_order: number;
  ingredients: Pick<Ingredient, "id" | "name" | "group_name"> | null;
};

export type MealPlanRecipeView = Pick<
  Recipe,
  "id" | "name" | "default_servings" | "image_url"
> & {
  recipe_ingredients: RecipeIngredientWithLink[];
};

export type MealPlanWithRecipe = MealPlanEntry & {
  recipes: MealPlanRecipeView | null;
  meal_plan_custom_ingredients: MealPlanCustomIngredientWithLink[];
};

export type ShoppingItemSource = "meal" | "staple" | "manual";
export type ShoppingItemState = "not_checked" | "to_buy" | "have" | "bought";

export type ShoppingItem = {
  id: string;
  ingredient_id: string | null;
  name: string | null;
  quantity: string | null;
  source: ShoppingItemSource;
  source_ref: string | null;
  state: ShoppingItemState;
  notes: string | null;
  unit_key: string | null;
  created_at: string;
};

export type ShoppingItemSourceKind = "meal" | "staple" | "manual";

export type ShoppingItemSourceRow = {
  id: string;
  shopping_item_id: string;
  kind: ShoppingItemSourceKind;
  meal_plan_id: string | null;
  quantity: string | null;
  created_at: string;
};

export type ShoppingItemSourceDetail = ShoppingItemSourceRow & {
  meal_plan: {
    date: string;
    recipes: Pick<Recipe, "id" | "name"> | null;
  } | null;
};

export type ShoppingItemWithIngredient = ShoppingItem & {
  ingredients: Pick<Ingredient, "id" | "name" | "group_name"> | null;
  shopping_item_sources: ShoppingItemSourceDetail[];
};

export type PurchaseHistoryRow = {
  id: string;
  ingredient_id: string;
  quantity: string | null;
  purchased_at: string;
};

export type CategoryMetaRow = {
  name: string;
  color: string | null;
  sort_order: number;
  updated_at: string;
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
