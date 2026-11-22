"use server";

import { revalidatePath } from "next/cache";
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
    const retailerRows = (["coles", "woolworths", "aldi"] as const)
      .map((retailer) => ({
        retailer,
        stock_code: input.retailer_codes[retailer],
      }))
      .filter((r): r is { retailer: "coles" | "woolworths" | "aldi"; stock_code: string } =>
        !!r.stock_code,
      )
      .map((r) => ({
        ingredient_id: inserted.id,
        retailer: r.retailer,
        stock_code: r.stock_code,
      }));
    if (retailerRows.length > 0) {
      const { error: codesErr } = await supabase
        .from("ingredient_retailer_codes")
        .insert(retailerRows);
      if (codesErr) return { ok: false, error: codesErr.message };
    }
    revalidatePath("/ingredients");
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

    // Reconcile retailer codes: upsert any non-blank code, delete any
    // retailer whose code the user cleared. Also drop the matching
    // ingredient_prices row when the code is removed so stale data
    // doesn't linger.
    for (const retailer of ["coles", "woolworths", "aldi"] as const) {
      const code = input.retailer_codes[retailer];
      if (code) {
        const { error: upsertErr } = await supabase
          .from("ingredient_retailer_codes")
          .upsert(
            { ingredient_id: id, retailer, stock_code: code },
            { onConflict: "ingredient_id,retailer" },
          );
        if (upsertErr) return { ok: false, error: upsertErr.message };
      } else {
        const { error: delCodeErr } = await supabase
          .from("ingredient_retailer_codes")
          .delete()
          .eq("ingredient_id", id)
          .eq("retailer", retailer);
        if (delCodeErr) return { ok: false, error: delCodeErr.message };
        const { error: delPriceErr } = await supabase
          .from("ingredient_prices")
          .delete()
          .eq("ingredient_id", id)
          .eq("retailer", retailer);
        if (delPriceErr) return { ok: false, error: delPriceErr.message };
      }
    }
    revalidatePath("/ingredients");
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
  revalidatePath("/ingredients");
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

// Persist the per-retailer stock code for one ingredient. Blank/empty
// stock_code means delete the row (user cleared it). The price-refresh
// cron reads this table to know which SKUs to look up.
export async function setIngredientRetailerCodeAction(
  ingredientId: string,
  retailer: "coles" | "woolworths" | "aldi",
  stockCode: string,
): Promise<ActionResult> {
  const trimmed = stockCode.trim();
  const supabase = supabaseAdmin();
  if (!trimmed) {
    const { error } = await supabase
      .from("ingredient_retailer_codes")
      .delete()
      .eq("ingredient_id", ingredientId)
      .eq("retailer", retailer);
    if (error) return { ok: false, error: error.message };
    // Also drop any stale price snapshot for this (ingredient, retailer).
    await supabase
      .from("ingredient_prices")
      .delete()
      .eq("ingredient_id", ingredientId)
      .eq("retailer", retailer);
    return { ok: true };
  }
  // Upsert on PK (ingredient_id, retailer).
  const { error } = await supabase
    .from("ingredient_retailer_codes")
    .upsert(
      { ingredient_id: ingredientId, retailer, stock_code: trimmed },
      { onConflict: "ingredient_id,retailer" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
