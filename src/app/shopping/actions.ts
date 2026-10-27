"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { syncShoppingList } from "@/lib/shopping-sync";
import type { ShoppingItemState } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function syncShoppingListAction(): Promise<ActionResult> {
  const result = await syncShoppingList();
  if (!result.ok) return result;
  revalidatePath("/shopping");
  return { ok: true };
}

export async function setItemStateAction(
  id: string,
  state: ShoppingItemState,
): Promise<ActionResult> {
  if (!["to_buy", "have", "bought"].includes(state)) {
    return { ok: false, error: "Invalid state" };
  }
  const { error } = await supabaseAdmin()
    .from("shopping_items")
    .update({ state })
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
  const { error } = await supabaseAdmin().from("shopping_items").insert({
    ingredient_id: ingredientId,
    quantity: trimmed || null,
    source: "manual",
    state: "to_buy",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shopping");
  return { ok: true };
}

// Finish shopping:
//   - Delete rows with state='bought' (purchased, consumed by meal)
//   - Stamp all current (unshopped) meal_plan entries so sync won't re-add their items
//   - Leaves state='have' and state='to_buy' alone
export async function finishShoppingAction(): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const { error: delErr } = await supabase
    .from("shopping_items")
    .delete()
    .eq("state", "bought");
  if (delErr) return { ok: false, error: delErr.message };

  const { error: stampErr } = await supabase
    .from("meal_plan")
    .update({ shopped_at: nowIso })
    .is("shopped_at", null)
    .gte("date", today);
  if (stampErr) return { ok: false, error: stampErr.message };

  revalidatePath("/shopping");
  return { ok: true };
}
