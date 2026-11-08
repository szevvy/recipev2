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
    // Switching away from a custom meal: clear the custom fields and
    // its own free-text shopping items (library ones go through sync).
    await clearCustomSideEffects(supabase, existing.id);
    const { error } = await supabase
      .from("meal_plan")
      .update({
        recipe_id: recipeId,
        custom_name: null,
        servings: servings ?? null,
        shopped_at: null,
      })
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

export type CustomMealIngredientInput = {
  // One of ingredient_id OR name is required.
  ingredient_id: string | null;
  name: string | null;
  quantity: string | null;
};

// Create or update a custom one-off meal for a date. Custom meals have no
// recipes row; library-backed custom ingredients flow through syncShoppingList,
// free-text ones are inserted directly as shopping_items here.
export async function setCustomMealAction(
  date: string,
  name: string,
  ingredients: CustomMealIngredientInput[],
): Promise<ActionResult> {
  if (!isValidISODate(date)) return { ok: false, error: "Invalid date" };
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Give it a name" };

  const clean = ingredients
    .map((ing) => {
      const n = ing.name?.trim() ?? "";
      const q = ing.quantity?.trim() ?? "";
      return {
        ingredient_id: ing.ingredient_id ?? null,
        name: ing.ingredient_id ? null : n || null,
        quantity: q || null,
      };
    })
    .filter((ing) => ing.ingredient_id || ing.name);

  const supabase = supabaseAdmin();
  const { data: existing } = await supabase
    .from("meal_plan")
    .select("id")
    .eq("date", date)
    .is("slot", null)
    .maybeSingle();

  let mealId: string;
  if (existing) {
    // Blow away any prior free-text shopping items tied to this meal; they
    // get rebuilt below.
    await clearCustomSideEffects(supabase, existing.id);
    const { error } = await supabase
      .from("meal_plan")
      .update({
        recipe_id: null,
        custom_name: trimmedName,
        servings: null,
        shopped_at: null,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    mealId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("meal_plan")
      .insert({
        date,
        recipe_id: null,
        custom_name: trimmedName,
        servings: null,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return { ok: false, error: error?.message ?? "insert failed" };
    }
    mealId = inserted.id;
  }

  // Replace the meal's custom ingredient list.
  const { error: delErr } = await supabase
    .from("meal_plan_custom_ingredients")
    .delete()
    .eq("meal_plan_id", mealId);
  if (delErr) return { ok: false, error: delErr.message };

  if (clean.length > 0) {
    const rows = clean.map((ing, idx) => ({
      meal_plan_id: mealId,
      ingredient_id: ing.ingredient_id,
      name: ing.name,
      quantity: ing.quantity,
      sort_order: idx,
    }));
    const { error: insErr } = await supabase
      .from("meal_plan_custom_ingredients")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  // Library-backed ingredients enter the shopping list via sync.
  const sync = await syncShoppingList();
  if (!sync.ok) return sync;

  // Free-text ingredients don't participate in sync; create their own
  // shopping_items here, linked via source rows so a later meal delete
  // cascades them away.
  const freeText = clean.filter((ing) => !ing.ingredient_id && ing.name);
  if (freeText.length > 0) {
    const itemRows = freeText.map((ing) => ({
      ingredient_id: null,
      name: ing.name,
      quantity: ing.quantity,
      source: "meal" as const,
      state: "not_checked" as const,
    }));
    const { data: insertedItems, error: itemErr } = await supabase
      .from("shopping_items")
      .insert(itemRows)
      .select("id");
    if (itemErr || !insertedItems) {
      return { ok: false, error: itemErr?.message ?? "insert failed" };
    }
    const sourceRows = insertedItems.map((row, idx) => ({
      shopping_item_id: row.id,
      kind: "meal" as const,
      meal_plan_id: mealId,
      quantity: freeText[idx].quantity,
    }));
    const { error: srcErr } = await supabase
      .from("shopping_item_sources")
      .insert(sourceRows);
    if (srcErr) return { ok: false, error: srcErr.message };
  }

  revalidatePath("/shopping");
  return { ok: true };
}

// When transitioning a meal row away from (or re-saving) a custom entry,
// drop its free-text shopping_items. Library-backed items are left for
// syncShoppingList + cleanupOrphanMealItems to handle.
async function clearCustomSideEffects(supabase: Supa, mealPlanId: string): Promise<void> {
  const { data: sources } = await supabase
    .from("shopping_item_sources")
    .select("shopping_item_id, shopping_items(id, ingredient_id)")
    .eq("meal_plan_id", mealPlanId);
  if (!sources) return;
  const toDelete = (sources as unknown as Array<{
    shopping_item_id: string;
    shopping_items: { id: string; ingredient_id: string | null } | null;
  }>)
    .filter((s) => s.shopping_items && s.shopping_items.ingredient_id === null)
    .map((s) => s.shopping_item_id);
  if (toDelete.length === 0) return;
  await supabase.from("shopping_items").delete().in("id", toDelete);
}

export async function clearMealAction(
  date: string,
  removeIngredients?: boolean,
): Promise<ActionResult> {
  if (!isValidISODate(date)) return { ok: false, error: "Invalid date" };
  const supabase = supabaseAdmin();

  // Free-text shopping items are owned by the custom meal — always drop them
  // before deleting the meal_plan row, regardless of removeIngredients (which
  // only governs library-backed items going through sync).
  const { data: existing } = await supabase
    .from("meal_plan")
    .select("id")
    .eq("date", date)
    .is("slot", null)
    .maybeSingle();
  if (existing) await clearCustomSideEffects(supabase, existing.id);

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
