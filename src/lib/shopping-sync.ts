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
//
// Performance: the whole sync is a fixed small number of round-trips regardless
// of how many ingredients or meals you have (bulk inserts/deletes, Promise.all
// for independent fetches).
export async function syncShoppingList(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // Run the three independent reads in parallel.
  const [mealsResp, existingMealResp, statefulResp] = await Promise.all([
    supabase
      .from("meal_plan")
      .select(
        "id, date, servings, shopped_at, recipes(id, default_servings, recipe_ingredients(ingredient_id, quantity))",
      )
      .gte("date", today)
      .is("shopped_at", null),
    supabase
      .from("shopping_items")
      .select("id, ingredient_id, quantity, state")
      .eq("source", "meal")
      .in("state", ["not_checked", "to_buy"]),
    supabase
      .from("shopping_items")
      .select("ingredient_id, state")
      .in("state", ["have", "bought"]),
  ]);

  if (mealsResp.error) return { ok: false, error: mealsResp.error.message };
  if (existingMealResp.error) return { ok: false, error: existingMealResp.error.message };
  if (statefulResp.error) return { ok: false, error: statefulResp.error.message };

  const meals = (mealsResp.data ?? []) as unknown as Array<{
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

  // Build merge inputs + per-ingredient contribution list in one pass.
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

  const existingByIngredient = new Map<
    string,
    { id: string; quantity: string | null; state: ShoppingItemState }
  >();
  for (const row of existingMealResp.data ?? []) {
    existingByIngredient.set(row.ingredient_id, {
      id: row.id,
      quantity: row.quantity,
      state: row.state,
    });
  }
  const statefulIngredients = new Set(
    (statefulResp.data ?? []).map((r) => r.ingredient_id),
  );

  // Partition into inserts vs updates. Items the user has already decided on
  // (have/bought) are skipped entirely.
  const toInsert: Array<{
    ingredient_id: string;
    quantity: string | null;
    source: "meal";
    state: "not_checked";
  }> = [];
  const toUpdate: Array<{ id: string; quantity: string | null }> = [];
  const touchedExistingIds: string[] = [];

  for (const m of mergedMeal) {
    if (statefulIngredients.has(m.ingredient_id)) continue;
    const existing = existingByIngredient.get(m.ingredient_id);
    if (existing) {
      touchedExistingIds.push(existing.id);
      if (existing.quantity !== m.quantity) {
        toUpdate.push({ id: existing.id, quantity: m.quantity });
      }
    } else {
      toInsert.push({
        ingredient_id: m.ingredient_id,
        quantity: m.quantity,
        source: "meal",
        state: "not_checked",
      });
    }
  }

  // Bulk insert new rows (one query, returns ids) + parallel quantity updates.
  const insertPromise =
    toInsert.length > 0
      ? supabase.from("shopping_items").insert(toInsert).select("id, ingredient_id")
      : Promise.resolve({ data: [] as { id: string; ingredient_id: string }[], error: null });

  const updatePromises = toUpdate.map((u) =>
    supabase.from("shopping_items").update({ quantity: u.quantity }).eq("id", u.id),
  );

  const [insertResult, ...updateResults] = await Promise.all([insertPromise, ...updatePromises]);

  if (insertResult.error) return { ok: false, error: insertResult.error.message };
  for (const r of updateResults) {
    if (r.error) return { ok: false, error: r.error.message };
  }

  const newIdByIngredient = new Map<string, string>();
  for (const row of insertResult.data ?? []) {
    newIdByIngredient.set(row.ingredient_id, row.id);
  }

  // Resolve ingredient_id -> shopping_item_id for every synced item.
  const idByIngredient = new Map<string, string>();
  for (const m of mergedMeal) {
    if (statefulIngredients.has(m.ingredient_id)) continue;
    const newId = newIdByIngredient.get(m.ingredient_id);
    if (newId) {
      idByIngredient.set(m.ingredient_id, newId);
    } else {
      const existing = existingByIngredient.get(m.ingredient_id);
      if (existing) idByIngredient.set(m.ingredient_id, existing.id);
    }
  }

  const allTouchedIds = [
    ...touchedExistingIds,
    ...Array.from(newIdByIngredient.values()),
  ];

  // Bulk refresh meal sources: one delete + one insert.
  const sourceRows: Array<{
    shopping_item_id: string;
    kind: "meal";
    meal_plan_id: string;
    quantity: string | null;
  }> = [];
  for (const [ingredientId, contribs] of contributionsByIngredient) {
    const itemId = idByIngredient.get(ingredientId);
    if (!itemId) continue;
    for (const c of contribs) {
      sourceRows.push({
        shopping_item_id: itemId,
        kind: "meal",
        meal_plan_id: c.meal_plan_id,
        quantity: c.quantity,
      });
    }
  }

  const sourceDeletePromise =
    allTouchedIds.length > 0
      ? supabase
          .from("shopping_item_sources")
          .delete()
          .in("shopping_item_id", allTouchedIds)
          .eq("kind", "meal")
      : Promise.resolve({ error: null });

  // Delete first, then insert — if we race them, the delete might wipe the inserts.
  const delResult = await sourceDeletePromise;
  if (delResult.error) return { ok: false, error: delResult.error.message };

  if (sourceRows.length > 0) {
    const { error: insErr } = await supabase.from("shopping_item_sources").insert(sourceRows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  return { ok: true };
}
