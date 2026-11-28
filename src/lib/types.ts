export type StapleState = "not_checked" | "need" | "have";

// Which price the chips show for an ingredient. Default is set per
// group on category_meta; each ingredient can override.
//  - "pack"   : pack price only ("$4.75")
//  - "per_kg" : unit price only ("$37/kg")
//  - "both"   : pack + unit price side-by-side (current behaviour)
export type PriceDisplay = "pack" | "per_kg" | "both";

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
  // Optional shelf life in days. 1 = must be used the day of purchase,
  // 2 = that day or the next, etc. The shopping list uses this to suggest
  // delayed buy windows when the ingredient would spoil before its meal.
  shelf_life_days: number | null;
  // Client-side augment from ingredient_retailer_codes: per-retailer SKU
  // list (one ingredient may track several variants at a retailer, e.g.
  // salmon skin-on + skin-off). Empty array when the user hasn't linked
  // that retailer yet.
  retailer_codes: { coles: string[]; woolworths: string[]; aldi: string[] };
  // Per-retailer unit weight in grams. Used to derive $/kg when the
  // retailer only publishes each-pricing. Null means no weight set for
  // that retailer; actor data still wins when the actor publishes
  // $/kg directly.
  retailer_weights: {
    coles: number | null;
    woolworths: number | null;
    aldi: number | null;
  };
  // Null → inherit from category_meta[group_name].price_display.
  price_display_override: PriceDisplay | null;
  // When true, each price refresh also calls Woolies's product-detail
  // API for this ingredient's Woolies stock codes and writes the
  // returned UnitWeightInGrams into ingredient_retailer_weights. Lets
  // us derive $/kg for per-each produce without manual weight entry.
  auto_fetch_weight: boolean;
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
  // When true, syncShoppingList excludes this meal's ingredients.
  // Different from shopped_at (already bought). Default false.
  skip_shopping: boolean;
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
    | Pick<
        Ingredient,
        "id" | "name" | "group_name" | "linked_recipe_id" | "shelf_life_days"
      >
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
  // Default chip display for ingredients in this group. Falls back to
  // "both" when no row exists (ingredients.price_display_override can
  // still override on a case-by-case basis — e.g. rice bags).
  price_display: PriceDisplay;
  updated_at: string;
};

export type RecipeWithIngredients = Recipe & {
  recipe_ingredients: (RecipeIngredient & { ingredients: Pick<Ingredient, "id" | "name"> })[];
};

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type AppSettings = {
  id: number;
  week_starts_on: WeekStart;
  // Four-digit Australian postcode passed to the price-scraping actor so
  // returned prices reflect the user's nearest store. Null until set.
  postcode: string | null;
  updated_at: string;
};

export type Retailer = "coles" | "woolworths" | "aldi";

export type IngredientRetailerCode = {
  ingredient_id: string;
  retailer: Retailer;
  stock_code: string;
  created_at: string;
};

export type IngredientPrice = {
  ingredient_id: string;
  retailer: Retailer;
  stock_code: string;
  // Pack price in cents (what shows on the price tag).
  price_cents: number | null;
  regular_price_cents: number | null;
  on_sale: boolean;
  in_stock: boolean;
  // Unit price in cents, keyed against unit_of_measure (e.g. 4800 +
  // "1kg" = $48/kg). Lets us compare apples-to-apples across pack
  // sizes and retailers.
  unit_price_cents: number | null;
  unit_of_measure: string | null;
  unit_price_text: string | null;
  product_title: string | null;
  product_url: string | null;
  image_url: string | null;
  promo_text: string | null;
  fetched_at: string;
};
