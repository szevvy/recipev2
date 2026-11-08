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

// Set state for a staple ingredient via its *ingredient_id* (not a shopping_items id).
// Creates the row on first pick, deletes it when the user picks ? back. The
// client can pass a pre-generated UUID so the row the client pins in cache
// matches the row created on the server — no post-insert swap needed.
export async function setStapleStateAction(
  ingredientId: string,
  state: ShoppingItemState,
  rowId?: string,
): Promise<ActionResult> {
  if (!["not_checked", "to_buy", "have", "bought"].includes(state)) {
    return { ok: false, error: "Invalid state" };
  }
  const supabase = supabaseAdmin();

  const { data: existing } = await supabase
    .from("shopping_items")
    .select("id")
    .eq("source", "staple")
    .eq("ingredient_id", ingredientId)
    .maybeSingle();

  if (state === "not_checked") {
    if (existing) {
      const { error } = await supabase.from("shopping_items").delete().eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    }
  } else if (existing) {
    const { error } = await supabase
      .from("shopping_items")
      .update({ state })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: inserted, error } = await supabase
      .from("shopping_items")
      .insert({
        id: rowId,
        ingredient_id: ingredientId,
        source: "staple",
        state,
      })
      .select("id")
      .single();
    if (error || !inserted) return { ok: false, error: error?.message ?? "insert failed" };
    const { error: srcErr } = await supabase.from("shopping_item_sources").insert({
      shopping_item_id: inserted.id,
      kind: "staple",
    });
    if (srcErr) return { ok: false, error: srcErr.message };
  }

  revalidatePath("/shopping");
  return { ok: true };
}

export async function setItemNotesAction(
  id: string,
  notes: string,
): Promise<ActionResult> {
  const trimmed = notes.trim();
  const { error } = await supabaseAdmin()
    .from("shopping_items")
    .update({ notes: trimmed || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shopping");
  return { ok: true };
}

export async function setItemStateAction(
  id: string,
  state: ShoppingItemState,
): Promise<ActionResult> {
  if (!["not_checked", "to_buy", "have", "bought"].includes(state)) {
    return { ok: false, error: "Invalid state" };
  }
  const { error } = await supabaseAdmin()
    .from("shopping_items")
    .update({ state })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  // Same row shows in main list + staples + already-have sections; revalidate so
  // changes in one are reflected everywhere without a hard refresh.
  revalidatePath("/shopping");
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
  rowId?: string,
): Promise<ActionResult> {
  if (!ingredientId) return { ok: false, error: "Pick an ingredient" };
  const trimmed = quantity.trim();
  const supabase = supabaseAdmin();
  const { data: inserted, error } = await supabase
    .from("shopping_items")
    .insert({
      id: rowId,
      ingredient_id: ingredientId,
      quantity: trimmed || null,
      source: "manual",
      state: "to_buy",
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "insert failed" };
  const { error: srcErr } = await supabase.from("shopping_item_sources").insert({
    shopping_item_id: inserted.id,
    kind: "manual",
    quantity: trimmed || null,
  });
  if (srcErr) return { ok: false, error: srcErr.message };
  revalidatePath("/shopping");
  return { ok: true };
}

// Add a one-off item that isn't an ingredient (blown light bulb, batteries).
// Lands in the shopping list with no ingredient_id, grouped under "Other".
export async function addOneOffItemAction(
  name: string,
  quantity: string,
  rowId?: string,
): Promise<ActionResult> {
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Give it a name" };
  const trimmedQty = quantity.trim();
  const supabase = supabaseAdmin();
  const { data: inserted, error } = await supabase
    .from("shopping_items")
    .insert({
      id: rowId,
      name: trimmedName,
      quantity: trimmedQty || null,
      source: "manual",
      state: "to_buy",
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "insert failed" };
  const { error: srcErr } = await supabase.from("shopping_item_sources").insert({
    shopping_item_id: inserted.id,
    kind: "manual",
    quantity: trimmedQty || null,
  });
  if (srcErr) return { ok: false, error: srcErr.message };
  revalidatePath("/shopping");
  return { ok: true };
}

// Finish shopping:
//   1. Record every bought item in purchase_history (one row per bought item).
//   2. Flip bought -> have on meal/manual rows so they persist as pantry stock
//      (linked back to their contributing meals via shopping_item_sources).
//      Delete bought staple rows — staples have their own reset step below.
//   3. Reset remaining staple rows to 'not_checked' so next trip starts fresh.
//   4. Stamp current (unshopped) meal_plan entries so sync won't re-add items
//      for them; the pantry row (state='have') is what ties the meal to its
//      ingredients afterwards.
export async function finishShoppingAction(): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const { data: boughtRows, error: fetchErr } = await supabase
    .from("shopping_items")
    .select("ingredient_id, quantity")
    .eq("state", "bought");
  if (fetchErr) return { ok: false, error: fetchErr.message };

  // Only record purchase history for ingredient-backed items — one-off rows
  // (name only, no ingredient) are not tracked over time.
  const historyRows = (boughtRows ?? [])
    .filter((r): r is { ingredient_id: string; quantity: string | null } =>
      r.ingredient_id != null,
    )
    .map((r) => ({
      ingredient_id: r.ingredient_id,
      quantity: r.quantity,
      purchased_at: nowIso,
    }));
  if (historyRows.length > 0) {
    const { error: histErr } = await supabase.from("purchase_history").insert(historyRows);
    if (histErr) return { ok: false, error: histErr.message };
  }

  // bought meal/manual rows -> have (pantry). Staple bought rows are dropped
  // here and re-created fresh on next pre-shop review.
  const { error: stapleBoughtDelErr } = await supabase
    .from("shopping_items")
    .delete()
    .eq("state", "bought")
    .eq("source", "staple");
  if (stapleBoughtDelErr) return { ok: false, error: stapleBoughtDelErr.message };

  const { error: pantryErr } = await supabase
    .from("shopping_items")
    .update({ state: "have" })
    .eq("state", "bought");
  if (pantryErr) return { ok: false, error: pantryErr.message };

  // Staples: reset any non-not_checked (incl. have) back to not_checked so
  // next week's review starts fresh.
  const { error: resetErr } = await supabase
    .from("shopping_items")
    .update({ state: "not_checked" })
    .eq("source", "staple")
    .neq("state", "not_checked");
  if (resetErr) return { ok: false, error: resetErr.message };

  const { error: stampErr } = await supabase
    .from("meal_plan")
    .update({ shopped_at: nowIso })
    .is("shopped_at", null)
    .gte("date", today);
  if (stampErr) return { ok: false, error: stampErr.message };

  revalidatePath("/shopping");
  return { ok: true };
}
