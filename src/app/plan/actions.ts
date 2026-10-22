"use server";

import { supabaseAdmin } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function setMealAction(
  date: string,
  recipeId: string,
  servings?: number | null,
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
      .update({ recipe_id: recipeId, servings: servings ?? null })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("meal_plan")
      .insert({ date, recipe_id: recipeId, servings: servings ?? null });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function clearMealAction(date: string): Promise<ActionResult> {
  if (!isValidISODate(date)) return { ok: false, error: "Invalid date" };
  const { error } = await supabaseAdmin()
    .from("meal_plan")
    .delete()
    .eq("date", date)
    .is("slot", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateServingsAction(
  date: string,
  servings: number | null,
): Promise<ActionResult> {
  if (!isValidISODate(date)) return { ok: false, error: "Invalid date" };
  const { error } = await supabaseAdmin()
    .from("meal_plan")
    .update({ servings })
    .eq("date", date)
    .is("slot", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
