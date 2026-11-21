"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { syncShoppingList } from "@/lib/shopping-sync";
import { formatQuantity, parseQuantity } from "@/lib/quantity";
import type { ShoppingItemState } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Result of a manual add. When `merged` is true the client should drop its
// optimistic row (identified by the UUID it generated and passed in as rowId)
// and update `shoppingItemId`'s quantity + state in its cache.
export type AddManualItemResult =
  | {
      ok: true;
      merged: boolean;
      shoppingItemId: string;
      quantity: string | null;
      state: ShoppingItemState;
    }
  | { ok: false; error: string };

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
  if (
    !["not_checked", "to_buy", "have", "bought", "later", "need_to_make"].includes(
      state,
    )
  ) {
    return { ok: false, error: "Invalid state" };
  }
  const supabase = supabaseAdmin();

  const { data: existing } = await supabase
    .from("shopping_items")
    .select("id, state")
    .eq("source", "staple")
    .eq("ingredient_id", ingredientId)
    .maybeSingle();

  const previousState = existing?.state ?? null;
  const previousId = existing?.id ?? null;

  if (state === "not_checked") {
    if (existing) {
      // Sweep any recipe children we spawned before deleting the parent.
      if (previousState === "need_to_make" && previousId) {
        const sweepErr = await sweepRecipeChildren(supabase, previousId);
        if (sweepErr) return { ok: false, error: sweepErr };
      }
      const { error } = await supabase.from("shopping_items").delete().eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    }
  } else if (existing) {
    const { error } = await supabase
      .from("shopping_items")
      .update({ state })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    // Handle recipe expansion / sweep on state transitions.
    if (previousState !== "need_to_make" && state === "need_to_make") {
      const expandErr = await expandLinkedRecipe(supabase, ingredientId, existing.id);
      if (expandErr) return { ok: false, error: expandErr };
    } else if (previousState === "need_to_make" && state !== "need_to_make") {
      const sweepErr = await sweepRecipeChildren(supabase, existing.id);
      if (sweepErr) return { ok: false, error: sweepErr };
    }
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
    if (state === "need_to_make") {
      const expandErr = await expandLinkedRecipe(supabase, ingredientId, inserted.id);
      if (expandErr) return { ok: false, error: expandErr };
    }
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
  if (
    !["not_checked", "to_buy", "have", "bought", "later", "need_to_make"].includes(
      state,
    )
  ) {
    return { ok: false, error: "Invalid state" };
  }
  const supabase = supabaseAdmin();

  // Read the current row so we can detect transitions into/out of need_to_make
  // and apply the matching recipe expansion / sweep.
  const { data: current, error: readErr } = await supabase
    .from("shopping_items")
    .select("id, ingredient_id, state")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!current) return { ok: false, error: "Not found" };

  const wasNeedToMake = current.state === "need_to_make";
  const nowNeedToMake = state === "need_to_make";

  const { error } = await supabase
    .from("shopping_items")
    .update({ state })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (!wasNeedToMake && nowNeedToMake) {
    // Transitioning in: look up the ingredient's linked recipe and insert its
    // ingredients as child shopping_items (with a 'recipe' source row back to
    // the parent). Merges by (ingredient_id, unit_key) so we don't duplicate.
    if (current.ingredient_id) {
      const expandErr = await expandLinkedRecipe(supabase, current.ingredient_id, id);
      if (expandErr) return { ok: false, error: expandErr };
    }
  } else if (wasNeedToMake && !nowNeedToMake) {
    // Transitioning out: remove our recipe-source rows and clean up any
    // children that only existed because of this parent.
    const sweepErr = await sweepRecipeChildren(supabase, id);
    if (sweepErr) return { ok: false, error: sweepErr };
  }

  revalidatePath("/shopping");
  return { ok: true };
}

// Pull the ingredient's linked recipe (if any) + its recipe_ingredients,
// then insert/merge a shopping_items row per ingredient at state='not_checked'
// with a shopping_item_sources(kind='recipe', source_ref=parentId) link.
async function expandLinkedRecipe(
  supabase: ReturnType<typeof supabaseAdmin>,
  ingredientId: string,
  parentShoppingItemId: string,
): Promise<string | null> {
  const { data: ing, error: ingErr } = await supabase
    .from("ingredients")
    .select("linked_recipe_id")
    .eq("id", ingredientId)
    .maybeSingle();
  if (ingErr) return ingErr.message;
  if (!ing?.linked_recipe_id) return null;

  const { data: recipe, error: recErr } = await supabase
    .from("recipes")
    .select(
      "default_servings, recipe_ingredients(ingredient_id, quantity)",
    )
    .eq("id", ing.linked_recipe_id)
    .maybeSingle();
  if (recErr) return recErr.message;
  if (!recipe) return null;

  type Row = {
    ingredient_id: string;
    quantity: string | null;
  };
  const rows = (recipe as unknown as {
    default_servings: number;
    recipe_ingredients: Row[];
  }).recipe_ingredients;
  if (!rows || rows.length === 0) return null;

  for (const ri of rows) {
    const parsed = parseQuantity(ri.quantity);
    const unitKey = parsed.unit ?? null;
    // Look for an existing row for this ingredient+unit we can merge into.
    const { data: candidates } = await supabase
      .from("shopping_items")
      .select("id, quantity, state")
      .eq("ingredient_id", ri.ingredient_id);
    const match = (candidates ?? []).find((r) => {
      const existing = parseQuantity(r.quantity);
      return existing.unit === parsed.unit;
    });

    let childId: string;
    if (match) {
      const existing = parseQuantity(match.quantity);
      if (parsed.qty != null && existing.qty != null) {
        const summed = existing.qty + parsed.qty;
        const merged = formatQuantity(summed, parsed.unit) || match.quantity;
        const { error: updErr } = await supabase
          .from("shopping_items")
          .update({ quantity: merged, unit_key: unitKey })
          .eq("id", match.id);
        if (updErr) return updErr.message;
      }
      childId = match.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("shopping_items")
        .insert({
          ingredient_id: ri.ingredient_id,
          quantity: ri.quantity,
          unit_key: unitKey,
          source: "recipe",
          state: "not_checked",
        })
        .select("id")
        .single();
      if (insErr || !inserted) return insErr?.message ?? "insert failed";
      childId = inserted.id;
    }

    const { error: srcErr } = await supabase
      .from("shopping_item_sources")
      .insert({
        shopping_item_id: childId,
        kind: "recipe",
        source_ref: parentShoppingItemId,
        quantity: ri.quantity,
      });
    if (srcErr) return srcErr.message;
  }

  return null;
}

// Drop every shopping_item_sources row pointing back at this parent, then
// delete any child shopping_items that no longer have ANY sources (and have
// source='recipe' so we don't touch rows created some other way) AND are in
// a state the user hasn't committed to yet.
async function sweepRecipeChildren(
  supabase: ReturnType<typeof supabaseAdmin>,
  parentShoppingItemId: string,
): Promise<string | null> {
  const { data: ourSources, error: readErr } = await supabase
    .from("shopping_item_sources")
    .select("shopping_item_id")
    .eq("kind", "recipe")
    .eq("source_ref", parentShoppingItemId);
  if (readErr) return readErr.message;
  const childIds = (ourSources ?? []).map((r) => r.shopping_item_id);

  const { error: delSrcErr } = await supabase
    .from("shopping_item_sources")
    .delete()
    .eq("kind", "recipe")
    .eq("source_ref", parentShoppingItemId);
  if (delSrcErr) return delSrcErr.message;

  if (childIds.length === 0) return null;

  // Figure out which (if any) of the children now have zero sources — those
  // are the ones the user would never see again, safe to delete.
  const { data: remainingSources } = await supabase
    .from("shopping_item_sources")
    .select("shopping_item_id")
    .in("shopping_item_id", childIds);
  const stillHasSource = new Set(
    (remainingSources ?? []).map((r) => r.shopping_item_id),
  );
  const orphans = childIds.filter((id) => !stillHasSource.has(id));
  if (orphans.length === 0) return null;

  const { error: delErr } = await supabase
    .from("shopping_items")
    .delete()
    .eq("source", "recipe")
    .in("state", ["not_checked", "to_buy"])
    .in("id", orphans);
  return delErr?.message ?? null;
}

export async function removeShoppingItemAction(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin().from("shopping_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Wipe the entire Already-have drawer. Used when the user wants to start
// fresh (used up the pantry, or the list is stale). Also clears any
// 'need_to_make' parents sitting in the drawer, and sweeps any orphaned
// recipe-source children left behind by the cascade.
export async function clearHaveItemsAction(): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .in("state", ["have", "need_to_make"]);
  if (error) return { ok: false, error: error.message };

  // Orphan sweep: any source='recipe' row with no live sources left is a
  // child of a parent we just deleted.
  const { data: recipeChildren, error: readErr } = await supabase
    .from("shopping_items")
    .select("id")
    .eq("source", "recipe")
    .in("state", ["not_checked", "to_buy"]);
  if (readErr) return { ok: false, error: readErr.message };
  const ids = (recipeChildren ?? []).map((r) => r.id);
  if (ids.length > 0) {
    const { data: liveSources } = await supabase
      .from("shopping_item_sources")
      .select("shopping_item_id")
      .in("shopping_item_id", ids);
    const stillLive = new Set(
      (liveSources ?? []).map((s) => s.shopping_item_id),
    );
    const orphans = ids.filter((id) => !stillLive.has(id));
    if (orphans.length > 0) {
      const { error: delErr } = await supabase
        .from("shopping_items")
        .delete()
        .in("id", orphans);
      if (delErr) return { ok: false, error: delErr.message };
    }
  }

  revalidatePath("/shopping");
  return { ok: true };
}

export async function addManualItemAction(
  ingredientId: string,
  quantity: string,
  rowId?: string,
): Promise<AddManualItemResult> {
  if (!ingredientId) return { ok: false, error: "Pick an ingredient" };
  const trimmed = quantity.trim();
  const supabase = supabaseAdmin();
  const parsed = parseQuantity(trimmed || null);

  // If the input is parseable (has a numeric qty), try to merge into an
  // existing shopping_items row with the same ingredient + unit — regardless
  // of its source (meal / staple / manual). Prevents duplicates like
  // "1 zucchini" (from a meal) + "1 zucchini" (manual add) sitting side by side.
  if (parsed.qty != null) {
    const { data: candidates, error: fetchErr } = await supabase
      .from("shopping_items")
      .select("id, quantity, state")
      .eq("ingredient_id", ingredientId);
    if (fetchErr) return { ok: false, error: fetchErr.message };
    const match = (candidates ?? []).find((r) => {
      const existingParsed = parseQuantity(r.quantity);
      return existingParsed.qty != null && existingParsed.unit === parsed.unit;
    });
    if (match) {
      const existingParsed = parseQuantity(match.quantity);
      const summed = (existingParsed.qty ?? 0) + parsed.qty;
      const mergedQuantity =
        formatQuantity(summed, parsed.unit) || match.quantity;
      // Bump have/bought back to to_buy — user has explicitly asked to buy more.
      const nextState: ShoppingItemState =
        match.state === "have" || match.state === "bought"
          ? "to_buy"
          : match.state;
      const { error: updErr } = await supabase
        .from("shopping_items")
        .update({
          quantity: mergedQuantity,
          state: nextState,
          unit_key: parsed.unit,
        })
        .eq("id", match.id);
      if (updErr) return { ok: false, error: updErr.message };
      const { error: srcErr } = await supabase.from("shopping_item_sources").insert({
        shopping_item_id: match.id,
        kind: "manual",
        quantity: trimmed || null,
      });
      if (srcErr) return { ok: false, error: srcErr.message };
      revalidatePath("/shopping");
      return {
        ok: true,
        merged: true,
        shoppingItemId: match.id,
        quantity: mergedQuantity,
        state: nextState,
      };
    }
  }

  const { data: inserted, error } = await supabase
    .from("shopping_items")
    .insert({
      id: rowId,
      ingredient_id: ingredientId,
      quantity: trimmed || null,
      source: "manual",
      state: "to_buy",
      unit_key: parsed.unit ?? null,
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
  return {
    ok: true,
    merged: false,
    shoppingItemId: inserted.id,
    quantity: trimmed || null,
    state: "to_buy",
  };
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

  // Non-staple bought rows become pantry (state=have). Staples are handled
  // en-masse below.
  const { error: pantryErr } = await supabase
    .from("shopping_items")
    .update({ state: "have" })
    .eq("state", "bought")
    .neq("source", "staple");
  if (pantryErr) return { ok: false, error: pantryErr.message };

  // Deferred ('later') items revert to to_buy — "later" has arrived, next
  // trip should treat them as needed again unless the user flips them away.
  // Skip staples: they're about to be wiped en masse anyway.
  const { error: laterErr } = await supabase
    .from("shopping_items")
    .update({ state: "to_buy" })
    .eq("state", "later")
    .neq("source", "staple");
  if (laterErr) return { ok: false, error: laterErr.message };

  // Staples: wipe every source=staple row regardless of state. The Staples
  // list on the plan page is the source of truth (ingredient_list_memberships);
  // after finish-shopping, nothing should surface on the shopping list for
  // review — you'll pick back up from the plan next trip.
  const { error: stapleDelErr } = await supabase
    .from("shopping_items")
    .delete()
    .eq("source", "staple");
  if (stapleDelErr) return { ok: false, error: stapleDelErr.message };

  const { error: stampErr } = await supabase
    .from("meal_plan")
    .update({ shopped_at: nowIso })
    .is("shopped_at", null)
    .gte("date", today);
  if (stampErr) return { ok: false, error: stampErr.message };

  revalidatePath("/shopping");
  return { ok: true };
}
