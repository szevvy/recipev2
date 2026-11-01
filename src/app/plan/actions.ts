"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { syncShoppingList } from "@/lib/shopping-sync";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string };

type Supa = SupabaseClient<Database>;

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// After a meal is deleted or its recipe changes, some source='meal' shopping
// items may no longer have any live meal contributing to them. This clears
// those orphans (only ones the user hasn't touched: not_checked / to_buy).
async function cleanupOrphanMealItems(supabase: Supa): Promise<string | null> {
  const { data: liveSources, error: liveErr } = await supabase
    .from("shopping_item_sources")
    .select("shopping_item_id")
    .not("meal_plan_id", "is", null);
  if (liveErr) return liveErr.message;
  const liveIds = new Set((liveSources ?? []).map((s) => s.shopping_item_id));

  const { data: mealItems, error: itemsErr } = await supabase
    .from("shopping_items")
    .select("id")
    .eq("source", "meal")
    .in("state", ["not_checked", "to_buy"]);
  if (itemsErr) return itemsErr.message;

  const toDelete = (mealItems ?? [])
    .filter((i) => !liveIds.has(i.id))
    .map((i) => i.id);

  if (toDelete.length === 0) return null;
  const { error: delErr } = await supabase
    .from("shopping_items")
    .delete()
    .in("id", toDelete);
  return delErr ? delErr.message : null;
}

export async function setMealAction(
  date: string,
  recipeId: string,
  servings?: number | null,
  removeOldIngredients?: boolean,
): Promise<ActionResult> {
  if (!isValidISODate(date)) return { ok: false, error: "Invalid date" };
  if (!recipeId) return { ok: false, error: "Pick a recipe" };

  const supabase = supabaseAdmin();
  const { data: existing } = await supabase
    .from("meal_plan")
    .select("id")
    .eq("date", date)
    .is("slot", null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("meal_plan")
      .update({ recipe_id: recipeId, servings: servings ?? null, shopped_at: null })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("meal_plan")
      .insert({ date, recipe_id: recipeId, servings: servings ?? null });
    if (error) return { ok: false, error: error.message };
  }

  if (removeOldIngredients) {
    // Rebuild sources from the new recipe, then sweep orphans.
    const sync = await syncShoppingList();
    if (!sync.ok) return sync;
    const cleanupErr = await cleanupOrphanMealItems(supabase);
    if (cleanupErr) return { ok: false, error: cleanupErr };
    revalidatePath("/shopping");
  }

  return { ok: true };
}

export async function clearMealAction(
  date: string,
  removeIngredients?: boolean,
): Promise<ActionResult> {
  if (!isValidISODate(date)) return { ok: false, error: "Invalid date" };
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("meal_plan")
    .delete()
    .eq("date", date)
    .is("slot", null);
  if (error) return { ok: false, error: error.message };

  if (removeIngredients) {
    const cleanupErr = await cleanupOrphanMealItems(supabase);
    if (cleanupErr) return { ok: false, error: cleanupErr };
    revalidatePath("/shopping");
  }

  return { ok: true };
}

export async function updateServingsAction(
  date: string,
  servings: number | null,
): Promise<ActionResult> {
  if (!isValidISODate(date)) return { ok: false, error: "Invalid date" };
  const { error } = await supabaseAdmin()
    .from("meal_plan")
    .update({ servings, shopped_at: null })
    .eq("date", date)
    .is("slot", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
