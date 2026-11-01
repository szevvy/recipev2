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
//  * Each merged (ingredient_id, unit) bucket maps to one shopping_items row,
//    keyed by (ingredient_id, source='meal', unit_key).
//  * Orphan rows (unmatched to the new merged list AND no sources) get deleted.
//  * Each meal row's shopping_item_sources are rebuilt per sync.
//
// Performance: fixed small number of parallel/bulk queries regardless of count.
export async function syncShoppingList(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

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
      .select("id, ingredient_id, quantity, state, unit_key")
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

  // Build merge inputs + per (ingredient_id, unit_key) contribution list.
  type Contribution = { meal_plan_id: string; quantity: string | null };
  const contributionsByBucket = new Map<string, Contribution[]>();
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
      const bucketKey = `${ri.ingredient_id}|${scaled.unit ?? ""}`;
      const list = contributionsByBucket.get(bucketKey) ?? [];
      list.push({ meal_plan_id: meal.id, quantity: scaledText });
      contributionsByBucket.set(bucketKey, list);
    }
  }
  const mergedMeal = mergeShoppingItems(mergeInputs);

  const existingByBucket = new Map<
    string,
    { id: string; quantity: string | null; state: ShoppingItemState; unit_key: string | null }
  >();
  for (const row of existingMealResp.data ?? []) {
    const key = `${row.ingredient_id}|${row.unit_key ?? ""}`;
    existingByBucket.set(key, {
      id: row.id,
      quantity: row.quantity,
      state: row.state,
      unit_key: row.unit_key,
    });
  }
  const statefulIngredients = new Set(
    (statefulResp.data ?? []).map((r) => r.ingredient_id),
  );

  // Partition into inserts vs updates. Also track which existing ids got matched
  // so we can detect orphans at the end.
  const toInsert: Array<{
    ingredient_id: string;
    quantity: string | null;
    unit_key: string | null;
    source: "meal";
    state: "not_checked";
  }> = [];
  const toUpdate: Array<{ id: string; quantity: string | null; unit_key: string | null }> = [];
  const matchedExistingIds = new Set<string>();

  for (const m of mergedMeal) {
    if (statefulIngredients.has(m.ingredient_id)) continue;
    const bucketKey = `${m.ingredient_id}|${m.unit_key ?? ""}`;
    const existing = existingByBucket.get(bucketKey);
    if (existing) {
      matchedExistingIds.add(existing.id);
      if (existing.quantity !== m.quantity || existing.unit_key !== m.unit_key) {
        toUpdate.push({ id: existing.id, quantity: m.quantity, unit_key: m.unit_key });
      }
    } else {
      toInsert.push({
        ingredient_id: m.ingredient_id,
        quantity: m.quantity,
        unit_key: m.unit_key,
        source: "meal",
        state: "not_checked",
      });
    }
  }

  // Detect orphan existing rows (meal, in to_buy/not_checked, unmatched by any
  // merged bucket). We only delete the ones with no sources, to protect any
  // row that might represent a now-removed meal the user hasn't dealt with yet.
  const unmatched = (existingMealResp.data ?? []).filter(
    (row) => !matchedExistingIds.has(row.id),
  );
  let orphanToDelete: string[] = [];
  if (unmatched.length > 0) {
    const unmatchedIds = unmatched.map((r) => r.id);
    const { data: withSources } = await supabase
      .from("shopping_item_sources")
      .select("shopping_item_id")
      .in("shopping_item_id", unmatchedIds);
    const hasSources = new Set((withSources ?? []).map((s) => s.shopping_item_id));
    orphanToDelete = unmatchedIds.filter((id) => !hasSources.has(id));
  }

  // Fire off the mutations.
  const insertPromise =
    toInsert.length > 0
      ? supabase
          .from("shopping_items")
          .insert(toInsert)
          .select("id, ingredient_id, unit_key")
      : Promise.resolve({ data: [] as Array<{ id: string; ingredient_id: string; unit_key: string | null }>, error: null });

  const updatePromises = toUpdate.map((u) =>
    supabase
      .from("shopping_items")
      .update({ quantity: u.quantity, unit_key: u.unit_key })
      .eq("id", u.id),
  );

  const orphanDeletePromise =
    orphanToDelete.length > 0
      ? supabase.from("shopping_items").delete().in("id", orphanToDelete)
      : Promise.resolve({ error: null });

  const [insertResult, orphanResult, ...updateResults] = await Promise.all([
    insertPromise,
    orphanDeletePromise,
    ...updatePromises,
  ]);

  if (insertResult.error) return { ok: false, error: insertResult.error.message };
  if (orphanResult.error) return { ok: false, error: orphanResult.error.message };
  for (const r of updateResults) {
    if (r.error) return { ok: false, error: r.error.message };
  }

  // Build (ingredient_id, unit_key) -> shopping_item_id for every synced bucket.
  const idByBucket = new Map<string, string>();
  for (const row of insertResult.data ?? []) {
    idByBucket.set(`${row.ingredient_id}|${row.unit_key ?? ""}`, row.id);
  }
  for (const m of mergedMeal) {
    if (statefulIngredients.has(m.ingredient_id)) continue;
    const key = `${m.ingredient_id}|${m.unit_key ?? ""}`;
    if (idByBucket.has(key)) continue;
    const existing = existingByBucket.get(key);
    if (existing) idByBucket.set(key, existing.id);
  }

  const allTouchedIds = Array.from(idByBucket.values());

  // Rebuild meal-kind sources in bulk.
  const sourceRows: Array<{
    shopping_item_id: string;
    kind: "meal";
    meal_plan_id: string;
    quantity: string | null;
  }> = [];
  for (const [bucketKey, contribs] of contributionsByBucket) {
    const itemId = idByBucket.get(bucketKey);
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

  if (allTouchedIds.length > 0) {
    const { error } = await supabase
      .from("shopping_item_sources")
      .delete()
      .in("shopping_item_id", allTouchedIds)
      .eq("kind", "meal");
    if (error) return { ok: false, error: error.message };
  }

  if (sourceRows.length > 0) {
    const { error } = await supabase.from("shopping_item_sources").insert(sourceRows);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
