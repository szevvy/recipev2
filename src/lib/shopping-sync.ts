import "server-only";
import { supabaseAdmin } from "./supabase";
import { mergeShoppingItems, type MergeInput } from "./quantity";

// Rebuilds source='meal' and source='staple' shopping_items from current state.
// Preserves bought rows and manual items.
export async function syncShoppingList(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: mealsRaw, error: mealsErr } = await supabase
    .from("meal_plan")
    .select(
      "id, date, servings, recipes(id, default_servings, recipe_ingredients(ingredient_id, quantity))",
    )
    .gte("date", today);
  if (mealsErr) return { ok: false, error: mealsErr.message };

  const meals = (mealsRaw ?? []) as unknown as Array<{
    id: string;
    date: string;
    servings: number | null;
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

  const { data: staples, error: staplesErr } = await supabase
    .from("ingredients")
    .select("id, staple_state")
    .eq("is_staple", true)
    .eq("staple_state", "need");
  if (staplesErr) return { ok: false, error: staplesErr.message };

  const { error: delErr } = await supabase
    .from("shopping_items")
    .delete()
    .in("source", ["meal", "staple"])
    .eq("bought", false);
  if (delErr) return { ok: false, error: delErr.message };

  const inserts: Array<{
    ingredient_id: string;
    quantity: string | null;
    source: "meal" | "staple";
  }> = [];
  for (const m of mergedMeal) {
    inserts.push({ ingredient_id: m.ingredient_id, quantity: m.quantity, source: "meal" });
  }
  for (const s of staples ?? []) {
    inserts.push({ ingredient_id: s.id, quantity: null, source: "staple" });
  }

  if (inserts.length > 0) {
    const { error: insErr } = await supabase.from("shopping_items").insert(inserts);
    if (insErr) return { ok: false, error: insErr.message };
  }

  return { ok: true };
}
