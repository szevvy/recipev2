export type StapleState = "not_checked" | "need" | "have";

export type Ingredient = {
  id: string;
  name: string;
  group_name: string | null;
  // Populated by the bootstrap API from ingredient_list_memberships. Not a
  // DB column on ingredients. "Staples" is the default list; users can add
  // arbitrary lists ("Dessert", "Camping") by just typing a name.
  lists: string[];
  // Optional pointer to a recipe the user can make instead of buying — e.g.
  // the "Bolognaise sauce" ingredient points to the bolognaise recipe. When
  // the user picks "Need to make" for a shopping row backed by this
  // ingredient, the recipe's ingredients get inserted as child shopping_items.
  linked_recipe_id: string | null;
  staple_state: StapleState;
  created_at: string;
  updated_at: string;
};

export type IngredientListMembership = {
  ingredient_id: string;
  list_name: string;
  created_at: string;
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

export type ShoppingItemSource = "meal" | "staple" | "manual" | "recipe";
// "later" = reviewed and deferred — stays visible on the shopping list but
// greyed out (no strikethrough). Distinct from "have" (in pantry) and
// "bought" (grabbed this trip).
// "need_to_make" = the ingredient points to a linked recipe and the user
// is going to cook it instead of buying — the recipe's ingredients are
// inserted as child shopping_items; the parent hides from the main list
// and shows in Already Have (labelled "To make").
export type ShoppingItemState =
  | "not_checked"
  | "to_buy"
  | "have"
  | "bought"
  | "later"
  | "need_to_make";

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

export type ShoppingItemSourceKind = "meal" | "staple" | "manual" | "recipe";

export type ShoppingItemSourceRow = {
  id: string;
  shopping_item_id: string;
  kind: ShoppingItemSourceKind;
  meal_plan_id: string | null;
  // When kind='recipe', this points at the parent shopping_items.id whose
  // need_to_make state spawned this row.
  source_ref: string | null;
  quantity: string | null;
  created_at: string;
};

export type ShoppingItemSourceDetail = ShoppingItemSourceRow & {
  meal_plan: {
    date: string;
    custom_name: string | null;
    recipes: Pick<Recipe, "id" | "name"> | null;
  } | null;
};

export type ShoppingItemWithIngredient = ShoppingItem & {
  ingredients:
    | Pick<Ingredient, "id" | "name" | "group_name" | "linked_recipe_id">
    | null;
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
