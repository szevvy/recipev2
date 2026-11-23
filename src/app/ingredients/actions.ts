"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { parseIngredientForm } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => i.message).join(", ");
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

export async function createIngredientAction(fd: FormData): Promise<ActionResult> {
  try {
    const input = parseIngredientForm(fd);
    const rawId = fd.get("id");
    const rowId = typeof rawId === "string" && rawId.length > 0 ? rawId : undefined;
    const supabase = supabaseAdmin();
    const { data: inserted, error } = await supabase
      .from("ingredients")
      .insert({
        id: rowId,
        name: input.name,
        group_name: input.group_name,
        linked_recipe_id: input.linked_recipe_id ?? null,
        shelf_life_days: input.shelf_life_days ?? null,
        price_display_override: input.price_display_override,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      if (error?.code === "23505") {
        return { ok: false, error: `"${input.name}" already exists.` };
      }
      return { ok: false, error: error?.message ?? "insert failed" };
    }
    if (input.lists.length > 0) {
      const rows = input.lists.map((list_name) => ({
        ingredient_id: inserted.id,
        list_name,
      }));
      const { error: memErr } = await supabase
        .from("ingredient_list_memberships")
        .insert(rows);
      if (memErr) return { ok: false, error: memErr.message };
    }
    const retailerRows: Array<{
      ingredient_id: string;
      retailer: "coles" | "woolworths" | "aldi";
      stock_code: string;
    }> = [];
    for (const retailer of ["coles", "woolworths", "aldi"] as const) {
      for (const stock_code of input.retailer_codes[retailer]) {
        retailerRows.push({ ingredient_id: inserted.id, retailer, stock_code });
      }
    }
    if (retailerRows.length > 0) {
      const { error: codesErr } = await supabase
        .from("ingredient_retailer_codes")
        .insert(retailerRows);
      if (codesErr) return { ok: false, error: codesErr.message };
    }
    const weightRows: Array<{
      ingredient_id: string;
      retailer: "coles" | "woolworths" | "aldi";
      unit_weight_g: number;
    }> = [];
    for (const retailer of ["coles", "woolworths", "aldi"] as const) {
      const w = input.retailer_weights[retailer];
      if (w != null) {
        weightRows.push({ ingredient_id: inserted.id, retailer, unit_weight_g: w });
      }
    }
    if (weightRows.length > 0) {
      const { error: wErr } = await supabase
        .from("ingredient_retailer_weights")
        .insert(weightRows);
      if (wErr) return { ok: false, error: wErr.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function updateIngredientAction(id: string, fd: FormData): Promise<ActionResult> {
  try {
    const input = parseIngredientForm(fd);
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("ingredients")
      .update({
        name: input.name,
        group_name: input.group_name,
        linked_recipe_id: input.linked_recipe_id ?? null,
        shelf_life_days: input.shelf_life_days ?? null,
        price_display_override: input.price_display_override,
      })
      .eq("id", id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: `"${input.name}" already exists.` };
      return { ok: false, error: error.message };
    }
    // Reconcile list memberships: delete any not in the new set, insert any new.
    const { data: currentRows, error: readErr } = await supabase
      .from("ingredient_list_memberships")
      .select("list_name")
      .eq("ingredient_id", id);
    if (readErr) return { ok: false, error: readErr.message };
    const current = new Set((currentRows ?? []).map((r) => r.list_name));
    const target = new Set(input.lists);
    const toAdd = [...target].filter((l) => !current.has(l));
    const toRemove = [...current].filter((l) => !target.has(l));
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from("ingredient_list_memberships")
        .delete()
        .eq("ingredient_id", id)
        .in("list_name", toRemove);
      if (delErr) return { ok: false, error: delErr.message };
    }
    if (toAdd.length > 0) {
      const { error: insErr } = await supabase
        .from("ingredient_list_memberships")
        .insert(toAdd.map((list_name) => ({ ingredient_id: id, list_name })));
      if (insErr) return { ok: false, error: insErr.message };
    }

    // Reconcile retailer codes per retailer. The target is the parsed
    // comma-separated list for that retailer; anything stored but no
    // longer in the target set is deleted, anything new is inserted.
    // We also drop matching ingredient_prices rows for removed codes so
    // stale snapshots don't linger.
    const { data: currentCodes, error: readCodesErr } = await supabase
      .from("ingredient_retailer_codes")
      .select("retailer, stock_code")
      .eq("ingredient_id", id);
    if (readCodesErr) return { ok: false, error: readCodesErr.message };
    const currentByRetailer = new Map<string, Set<string>>();
    for (const row of currentCodes ?? []) {
      const set = currentByRetailer.get(row.retailer) ?? new Set<string>();
      set.add(row.stock_code);
      currentByRetailer.set(row.retailer, set);
    }
    for (const retailer of ["coles", "woolworths", "aldi"] as const) {
      const target = new Set(input.retailer_codes[retailer]);
      const current = currentByRetailer.get(retailer) ?? new Set<string>();
      const toAdd = [...target].filter((c) => !current.has(c));
      const toRemove = [...current].filter((c) => !target.has(c));
      if (toAdd.length > 0) {
        const { error: insErr } = await supabase
          .from("ingredient_retailer_codes")
          .insert(toAdd.map((stock_code) => ({ ingredient_id: id, retailer, stock_code })));
        if (insErr) return { ok: false, error: insErr.message };
      }
      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from("ingredient_retailer_codes")
          .delete()
          .eq("ingredient_id", id)
          .eq("retailer", retailer)
          .in("stock_code", toRemove);
        if (delErr) return { ok: false, error: delErr.message };
        const { error: delPriceErr } = await supabase
          .from("ingredient_prices")
          .delete()
          .eq("ingredient_id", id)
          .eq("retailer", retailer)
          .in("stock_code", toRemove);
        if (delPriceErr) return { ok: false, error: delPriceErr.message };
      }
    }

    // Reconcile retailer weights. Blank → delete the row; non-null → upsert.
    for (const retailer of ["coles", "woolworths", "aldi"] as const) {
      const weight = input.retailer_weights[retailer];
      if (weight == null) {
        const { error: delErr } = await supabase
          .from("ingredient_retailer_weights")
          .delete()
          .eq("ingredient_id", id)
          .eq("retailer", retailer);
        if (delErr) return { ok: false, error: delErr.message };
      } else {
        const { error: upErr } = await supabase
          .from("ingredient_retailer_weights")
          .upsert(
            {
              ingredient_id: id,
              retailer,
              unit_weight_g: weight,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "ingredient_id,retailer" },
          );
        if (upErr) return { ok: false, error: upErr.message };
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function deleteIngredientAction(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin().from("ingredients").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "This ingredient is used by one or more recipes." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// Add an ingredient to a list. Creates the list implicitly — it's just a
// membership row with that name. Idempotent via PK (ingredient_id, list_name).
export async function addIngredientToListAction(
  ingredientId: string,
  listName: string,
): Promise<ActionResult> {
  const trimmed = listName.trim();
  if (!trimmed) return { ok: false, error: "List name required" };
  if (trimmed.length > 60) return { ok: false, error: "List name too long" };
  const { error } = await supabaseAdmin()
    .from("ingredient_list_memberships")
    .insert({ ingredient_id: ingredientId, list_name: trimmed });
  if (error) {
    // 23505 = already a member, treat as success.
    if (error.code === "23505") return { ok: true };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeIngredientFromListAction(
  ingredientId: string,
  listName: string,
): Promise<ActionResult> {
  const { error } = await supabaseAdmin()
    .from("ingredient_list_memberships")
    .delete()
    .eq("ingredient_id", ingredientId)
    .eq("list_name", listName);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

