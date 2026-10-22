"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import {
  RecipeInputSchema,
  type RecipeInput,
  type RecipeIngredientInput,
} from "@/lib/validation";
import type { Ingredient } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type Supa = SupabaseClient<Database>;

function toError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

async function resolveIngredientIds(
  supabase: Supa,
  rows: RecipeIngredientInput[],
): Promise<string[]> {
  const providedIds = Array.from(
    new Set(rows.map((r) => r.ingredient_id).filter((x): x is string => !!x)),
  );
  const existingIds = new Set<string>();
  if (providedIds.length > 0) {
    const { data } = await supabase.from("ingredients").select("id").in("id", providedIds);
    for (const row of data ?? []) existingIds.add(row.id);
  }

  const nameCache = new Map<string, string>();
  const resolved: string[] = [];
  for (const row of rows) {
    if (row.ingredient_id && existingIds.has(row.ingredient_id)) {
      resolved.push(row.ingredient_id);
      continue;
    }
    const key = row.ingredient_name.toLowerCase();
    const cached = nameCache.get(key);
    if (cached) {
      resolved.push(cached);
      continue;
    }
    const { data: byName } = await supabase
      .from("ingredients")
      .select("id")
      .ilike("name", row.ingredient_name)
      .maybeSingle();
    if (byName) {
      nameCache.set(key, byName.id);
      resolved.push(byName.id);
      continue;
    }
    const { data: created, error } = await supabase
      .from("ingredients")
      .insert({ name: row.ingredient_name })
      .select("id")
      .single();
    if (!created || error) {
      if (error?.code === "23505") {
        const { data: afterConflict } = await supabase
          .from("ingredients")
          .select("id")
          .ilike("name", row.ingredient_name)
          .maybeSingle();
        if (afterConflict) {
          nameCache.set(key, afterConflict.id);
          resolved.push(afterConflict.id);
          continue;
        }
      }
      throw new Error(
        `Failed to re-create ingredient "${row.ingredient_name}": ${error?.message ?? "unknown"}`,
      );
    }
    nameCache.set(key, created.id);
    resolved.push(created.id);
  }
  return resolved;
}

export async function createRecipeAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const input = RecipeInputSchema.parse(raw);
    const supabase = supabaseAdmin();

    const resolvedIds = await resolveIngredientIds(supabase, input.ingredients);

    const { data: recipe, error: insErr } = await supabase
      .from("recipes")
      .insert({
        name: input.name,
        instructions: input.instructions,
        source_url: input.source_url,
        default_servings: input.default_servings,
        prep_minutes: input.prep_minutes,
        cook_minutes: input.cook_minutes,
        image_url: input.image_url,
        notes: input.notes,
      })
      .select("id")
      .single();
    if (insErr || !recipe) return { ok: false, error: insErr?.message ?? "Insert failed" };

    const rows = input.ingredients.map((ing, idx) => ({
      recipe_id: recipe.id,
      ingredient_id: resolvedIds[idx],
      quantity: ing.quantity,
      note: ing.note,
      sort_order: idx,
    }));
    if (rows.length > 0) {
      const { error: rowErr } = await supabase.from("recipe_ingredients").insert(rows);
      if (rowErr) {
        await supabase.from("recipes").delete().eq("id", recipe.id);
        return { ok: false, error: `Failed to save ingredients: ${rowErr.message}` };
      }
    }
    revalidatePath("/recipes");
    revalidatePath("/ingredients");
    return { ok: true, id: recipe.id };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function updateRecipeAction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  try {
    const input: RecipeInput = RecipeInputSchema.parse(raw);
    const supabase = supabaseAdmin();

    const resolvedIds = await resolveIngredientIds(supabase, input.ingredients);

    const { error: updErr } = await supabase
      .from("recipes")
      .update({
        name: input.name,
        instructions: input.instructions,
        source_url: input.source_url,
        default_servings: input.default_servings,
        prep_minutes: input.prep_minutes,
        cook_minutes: input.cook_minutes,
        image_url: input.image_url,
        notes: input.notes,
      })
      .eq("id", id);
    if (updErr) return { ok: false, error: updErr.message };

    const { data: existingRows } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", id);

    const { error: delErr } = await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("recipe_id", id);
    if (delErr) return { ok: false, error: delErr.message };

    const rows = input.ingredients.map((ing, idx) => ({
      recipe_id: id,
      ingredient_id: resolvedIds[idx],
      quantity: ing.quantity,
      note: ing.note,
      sort_order: idx,
    }));
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("recipe_ingredients").insert(rows);
      if (insErr) {
        if (existingRows && existingRows.length > 0) {
          await supabase.from("recipe_ingredients").insert(existingRows);
        }
        return { ok: false, error: insErr.message };
      }
    }

    revalidatePath("/recipes");
    revalidatePath("/ingredients");
    revalidatePath(`/recipes/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function deleteRecipeAction(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin().from("recipes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recipes");
  return { ok: true };
}

export async function quickCreateIngredientAction(
  name: string,
): Promise<ActionResult<{ ingredient: Ingredient }>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > 80) return { ok: false, error: "Name too long" };

  const { data, error } = await supabaseAdmin()
    .from("ingredients")
    .insert({ name: trimmed })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabaseAdmin()
        .from("ingredients")
        .select("*")
        .ilike("name", trimmed)
        .maybeSingle();
      if (existing) return { ok: true, ingredient: existing as unknown as Ingredient };
      return { ok: false, error: `"${trimmed}" already exists.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/ingredients");
  return { ok: true, ingredient: data as unknown as Ingredient };
}
