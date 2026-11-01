import "server-only";
import { supabaseAdmin } from "./supabase";
import {
  formatQuantity,
  mergeShoppingItems,
  parseQuantity,
  scaleQuantity,
  type MergeInput,
} from "./quantity";
import type { ShoppingItemState } from "./types";

// Sync rules (4-state model):
//  * Rows the user has moved to 'have' or 'bought' are NEVER touched by sync.
//  * Rows with state='not_checked' or 'to_buy' and source='meal' are refreshed
//    from the current (unshopped) meal plan: quantity gets re-merged.
//  * Meals with shopped_at IS NOT NULL are skipped (already shopped-for).
//  * No orphan deletion — forgotten items stay until the user removes them.
//  * Each meal shopping_items row gets fresh shopping_item_sources rows so the
//    expand UI can show which recipes contributed what.
export async function syncShoppingList(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Pull unshopped meals from today onwards.
  const { data: mealsRaw, error: mealsErr } = await supabase
    .from("meal_plan")
    .select(
      "id, date, servings, shopped_at, recipes(id, default_servings, recipe_ingredients(ingredient_id, quantity))",
    )
    .gte("date", today)
    .is("shopped_at", null);
  if (mealsErr) return { ok: false, error: mealsErr.message };

  const meals = (mealsRaw ?? []) as unknown as Array<{
    id: string;
    date: string;
    servings: number | null;
    shopped_at: string | null;
    recipes: {
      id: string;
      default_servings: number;
      recipe_ingredients: { ingredient_id: string; quantity: string | null }[];
    } | null;
  }>;

  // Build merge inputs (for display quantity) + per-ingredient contribution list
  // (for the sources table).
  type Contribution = { meal_plan_id: string; quantity: string | null };
  const contributionsByIngredient = new Map<string, Contribution[]>();

  const mergeInputs: MergeInput[] = [];
  for (const meal of meals) {
    if (!meal.recipes) continue;
    const servings = meal.servings ?? meal.recipes.default_servings;
    const factor = servings / meal.recipes.default_servings;
    for (const ri of meal.recipes.recipe_ingredients) {
      mergeInputs.push({
        ingredient_id: ri.ingredient_id,
        quantity: ri.quantity,
        servings_factor: factor,
      });

      const parsed = parseQuantity(ri.quantity);
      const scaled = scaleQuantity(parsed, factor);
      const scaledText =
        scaled.qty != null
          ? formatQuantity(scaled.qty, scaled.unit) || null
          : scaled.raw || null;

      const list = contributionsByIngredient.get(ri.ingredient_id) ?? [];
      list.push({ meal_plan_id: meal.id, quantity: scaledText });
      contributionsByIngredient.set(ri.ingredient_id, list);
    }
  }
  const mergedMeal = mergeShoppingItems(mergeInputs);

  // 2. Load existing undecided/to_buy meal rows (refresh candidates).
  const { data: existingMealRows, error: existingErr } = await supabase
    .from("shopping_items")
    .select("id, ingredient_id, quantity, state")
    .eq("source", "meal")
    .in("state", ["not_checked", "to_buy"]);
  if (existingErr) return { ok: false, error: existingErr.message };

  const existingByIngredient = new Map<
    string,
    { id: string; quantity: string | null; state: ShoppingItemState }
  >();
  for (const row of existingMealRows ?? []) {
    existingByIngredient.set(row.ingredient_id, {
      id: row.id,
      quantity: row.quantity,
      state: row.state,
    });
  }

  // 3. Skip ingredients the user has already decided (have/bought) on any row.
  const { data: anyStatefulRows } = await supabase
    .from("shopping_items")
    .select("ingredient_id, state")
    .in("state", ["have", "bought"]);
  const statefulIngredients = new Set(
    (anyStatefulRows ?? []).map((r) => r.ingredient_id),
  );

  // 4. Resolve each merged ingredient to a shopping_items row id (upsert).
  //    Then refresh its meal-kind sources from the contributions list.
  for (const m of mergedMeal) {
    if (statefulIngredients.has(m.ingredient_id)) continue;

    const existing = existingByIngredient.get(m.ingredient_id);
    let shoppingItemId: string | null = null;

    if (existing) {
      shoppingItemId = existing.id;
      if (existing.quantity !== m.quantity) {
        const { error } = await supabase
          .from("shopping_items")
          .update({ quantity: m.quantity })
          .eq("id", existing.id);
        if (error) return { ok: false, error: error.message };
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("shopping_items")
        .insert({
          ingredient_id: m.ingredient_id,
          quantity: m.quantity,
          source: "meal",
          state: "not_checked",
        })
        .select("id")
        .single();
      if (error || !inserted) return { ok: false, error: error?.message ?? "insert failed" };
      shoppingItemId = inserted.id;
    }

    // Refresh meal-kind sources for this row.
    const contributions = contributionsByIngredient.get(m.ingredient_id) ?? [];
    const { error: delErr } = await supabase
      .from("shopping_item_sources")
      .delete()
      .eq("shopping_item_id", shoppingItemId)
      .eq("kind", "meal");
    if (delErr) return { ok: false, error: delErr.message };

    if (contributions.length > 0) {
      const rows = contributions.map((c) => ({
        shopping_item_id: shoppingItemId!,
        kind: "meal" as const,
        meal_plan_id: c.meal_plan_id,
        quantity: c.quantity,
      }));
      const { error: insErr } = await supabase.from("shopping_item_sources").insert(rows);
      if (insErr) return { ok: false, error: insErr.message };
    }
  }

  return { ok: true };
}
