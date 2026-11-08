import type {
  MealPlanWithRecipe,
  ShoppingItemWithIngredient,
} from "@/lib/types";
import {
  formatQuantity,
  parseQuantity,
  scaleQuantity,
} from "@/lib/quantity";

// What the plan view shows for a single meal ingredient. One of these exists
// per recipe_ingredient (for recipe meals) or per meal_plan_custom_ingredients
// row (for custom meals), regardless of shopping-list state — so the user
// always sees the complete ingredient list for a meal, even for things
// already marked "have".
export type MealIngredientView = {
  key: string;
  ingredient_id: string | null;
  name: string;
  quantity: string | null;
  // The merged shopping_items row this ingredient contributes to, if any.
  // Present → row has a real state picker + bought check that mutates the
  // shared row. Absent → nothing in the shopping list is tracking it.
  shoppingItem: ShoppingItemWithIngredient | null;
};

function scaleText(quantity: string | null, factor: number): string | null {
  if (quantity == null) return null;
  if (factor === 1) return quantity;
  const parsed = parseQuantity(quantity);
  const scaled = scaleQuantity(parsed, factor);
  if (scaled.qty != null) return formatQuantity(scaled.qty, scaled.unit) || null;
  return scaled.raw || null;
}

export function buildMealIngredients(
  meal: MealPlanWithRecipe,
  shoppingItems: ShoppingItemWithIngredient[],
): MealIngredientView[] {
  // Build quick lookup maps for finding each ingredient's shopping_items row.
  // Library ingredients → look up by ingredient_id.
  // Free-text custom ingredients → look up by (meal_plan_id source + ingredient_id === null + name match).
  const itemsByIngredientId = new Map<string, ShoppingItemWithIngredient[]>();
  const freeTextItems: ShoppingItemWithIngredient[] = [];
  for (const item of shoppingItems) {
    if (item.ingredient_id) {
      const list = itemsByIngredientId.get(item.ingredient_id) ?? [];
      list.push(item);
      itemsByIngredientId.set(item.ingredient_id, list);
      continue;
    }
    freeTextItems.push(item);
  }

  function findLibraryItem(
    ingredientId: string,
  ): ShoppingItemWithIngredient | null {
    const bucket = itemsByIngredientId.get(ingredientId);
    if (!bucket || bucket.length === 0) return null;
    // Prefer one that has a live source for this meal (the common case —
    // sync wires it up). Falls back to any item for this ingredient, so
    // globally-"have" items still show their state.
    const withSource = bucket.find((i) =>
      i.shopping_item_sources.some((s) => s.meal_plan_id === meal.id),
    );
    return withSource ?? bucket[0];
  }

  function findFreeTextItem(name: string): ShoppingItemWithIngredient | null {
    const nameLower = name.trim().toLowerCase();
    return (
      freeTextItems.find(
        (i) =>
          (i.name ?? "").trim().toLowerCase() === nameLower &&
          i.shopping_item_sources.some((s) => s.meal_plan_id === meal.id),
      ) ?? null
    );
  }

  if (meal.recipes) {
    const servings = meal.servings ?? meal.recipes.default_servings;
    const factor =
      meal.recipes.default_servings > 0
        ? servings / meal.recipes.default_servings
        : 1;
    const rows = [...meal.recipes.recipe_ingredients].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return rows.map((ri) => ({
      key: ri.id,
      ingredient_id: ri.ingredient_id,
      name: ri.ingredients?.name ?? "(unknown)",
      quantity: scaleText(ri.quantity, factor),
      shoppingItem: findLibraryItem(ri.ingredient_id),
    }));
  }

  // Custom meal — library-backed rows look up a shared shopping_item, free-text
  // rows match by (meal + name).
  const custom = [...(meal.meal_plan_custom_ingredients ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return custom.map((ci) => {
    if (ci.ingredient_id) {
      return {
        key: ci.id,
        ingredient_id: ci.ingredient_id,
        name: ci.ingredients?.name ?? "(unknown)",
        quantity: ci.quantity,
        shoppingItem: findLibraryItem(ci.ingredient_id),
      };
    }
    return {
      key: ci.id,
      ingredient_id: null,
      name: ci.name ?? "(unnamed)",
      quantity: ci.quantity,
      shoppingItem: findFreeTextItem(ci.name ?? ""),
    };
  });
}
