import "server-only";
import { supabaseAdmin } from "./supabase";
import { mergeShoppingItems, type MergeInput } from "./quantity";
import type { ShoppingItemState } from "./types";

// Sync rules (3-state model):
//  * Rows the user has moved to 'have' or 'bought' are NEVER touched by sync.
//  * Rows with state='to_buy' and source='meal' are refreshed from the current
//    (unshopped) meal plan: quantity gets re-merged.
//  * Meals with shopped_at IS NOT NULL are skipped (already shopped-for).
//  * Any is_staple=true ingredient without a row at all gets one with
//    state='have' (default assumption: you have your staples; mark 'to_buy'
//    when you run low).
//  * Manual rows (source='manual') are untouched.
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
    }
  }
  const mergedMeal = mergeShoppingItems(mergeInputs);
  const neededIngredientIds = new Set(mergedMeal.map((m) => m.ingredient_id));

  // 2. Load existing to_buy meal rows (candidates for refresh/removal).
  const { data: existingMealRows, error: existingErr } = await supabase
    .from("shopping_items")
    .select("id, ingredient_id, quantity, state")
    .eq("source", "meal")
    .eq("state", "to_buy");
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

  // 3. For each merged meal ingredient:
  //    - If an existing to_buy meal row exists -> update quantity
  //    - If NO row exists for this ingredient at all -> insert new to_buy
  //    - If a row exists with state=have or state=bought (any source) -> skip
  //      (user already decided). We'll detect that with a bulk check below.
  const { data: anyStatefulRows } = await supabase
    .from("shopping_items")
    .select("ingredient_id, state")
    .in("state", ["have", "bought"]);
  const statefulIngredients = new Set(
    (anyStatefulRows ?? []).map((r) => r.ingredient_id),
  );

  const updates: Array<{ id: string; quantity: string | null }> = [];
  const inserts: Array<{
    ingredient_id: string;
    quantity: string | null;
    source: "meal";
    state: "to_buy";
  }> = [];
  for (const m of mergedMeal) {
    if (statefulIngredients.has(m.ingredient_id)) continue;
    const existing = existingByIngredient.get(m.ingredient_id);
    if (existing) {
      if (existing.quantity !== m.quantity) {
        updates.push({ id: existing.id, quantity: m.quantity });
      }
    } else {
      inserts.push({
        ingredient_id: m.ingredient_id,
        quantity: m.quantity,
        source: "meal",
        state: "to_buy",
      });
    }
  }

  // 4. Delete orphaned to_buy meal rows (ingredient no longer in any unshopped meal).
  const orphanIds: string[] = [];
  for (const [ingredientId, row] of existingByIngredient) {
    if (!neededIngredientIds.has(ingredientId)) orphanIds.push(row.id);
  }

  // 5. Ensure a row exists for every staple (default state='have').
  const { data: staples, error: staplesErr } = await supabase
    .from("ingredients")
    .select("id")
    .eq("is_staple", true);
  if (staplesErr) return { ok: false, error: staplesErr.message };

  const { data: allRows } = await supabase.from("shopping_items").select("ingredient_id");
  const anyRowFor = new Set((allRows ?? []).map((r) => r.ingredient_id));

  const stapleInserts: Array<{
    ingredient_id: string;
    source: "staple";
    state: "have";
  }> = [];
  for (const s of staples ?? []) {
    if (!anyRowFor.has(s.id)) {
      stapleInserts.push({ ingredient_id: s.id, source: "staple", state: "have" });
    }
  }

  // Fire off the mutations.
  if (orphanIds.length > 0) {
    const { error } = await supabase.from("shopping_items").delete().in("id", orphanIds);
    if (error) return { ok: false, error: error.message };
  }
  for (const u of updates) {
    const { error } = await supabase
      .from("shopping_items")
      .update({ quantity: u.quantity })
      .eq("id", u.id);
    if (error) return { ok: false, error: error.message };
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("shopping_items").insert(inserts);
    if (error) return { ok: false, error: error.message };
  }
  if (stapleInserts.length > 0) {
    const { error } = await supabase.from("shopping_items").insert(stapleInserts);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
