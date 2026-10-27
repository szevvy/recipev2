"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { syncShoppingList } from "@/lib/shopping-sync";
import type { StapleState } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function syncShoppingListAction(): Promise<ActionResult> {
  const result = await syncShoppingList();
  if (!result.ok) return result;
  revalidatePath("/shopping");
  return { ok: true };
}

export async function toggleBoughtAction(id: string, bought: boolean): Promise<ActionResult> {
  const { error } = await supabaseAdmin()
    .from("shopping_items")
    .update({ bought, bought_at: bought ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeShoppingItemAction(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin().from("shopping_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addManualItemAction(
  ingredientId: string,
  quantity: string,
): Promise<ActionResult> {
  if (!ingredientId) return { ok: false, error: "Pick an ingredient" };
  const trimmed = quantity.trim();
  const { error } = await supabaseAdmin()
    .from("shopping_items")
    .insert({
      ingredient_id: ingredientId,
      quantity: trimmed || null,
      source: "manual",
    });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shopping");
  return { ok: true };
}

export async function setStapleStateAction(
  ingredientId: string,
  state: StapleState,
): Promise<ActionResult> {
  if (!["not_checked", "need", "have"].includes(state)) {
    return { ok: false, error: "Invalid state" };
  }
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("ingredients")
    .update({ staple_state: state })
    .eq("id", ingredientId);
  if (error) return { ok: false, error: error.message };

  if (state === "need") {
    // Add to shopping list if not already present as an unbought staple row.
    const { data: existing } = await supabase
      .from("shopping_items")
      .select("id")
      .eq("ingredient_id", ingredientId)
      .eq("source", "staple")
      .eq("bought", false)
      .maybeSingle();
    if (!existing) {
      const { error: insErr } = await supabase.from("shopping_items").insert({
        ingredient_id: ingredientId,
        quantity: null,
        source: "staple",
      });
      if (insErr) return { ok: false, error: insErr.message };
    }
  } else {
    // Remove any unbought staple row for this ingredient.
    const { error: delErr } = await supabase
      .from("shopping_items")
      .delete()
      .eq("ingredient_id", ingredientId)
      .eq("source", "staple")
      .eq("bought", false);
    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath("/shopping");
  return { ok: true };
}

// Finish shopping: delete bought items + reset all staples to not_checked.
export async function finishShoppingAction(): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const { error: delErr } = await supabase.from("shopping_items").delete().eq("bought", true);
  if (delErr) return { ok: false, error: delErr.message };
  const { error: resetErr } = await supabase
    .from("ingredients")
    .update({ staple_state: "not_checked" })
    .eq("is_staple", true);
  if (resetErr) return { ok: false, error: resetErr.message };
  revalidatePath("/shopping");
  return { ok: true };
}
