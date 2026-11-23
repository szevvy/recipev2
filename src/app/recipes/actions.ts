"use server";

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

    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function deleteRecipeAction(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin().from("recipes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Duplicate a recipe (rows + ingredient links) under a new name. The
// copy keeps every field from the source, just rebinds the ingredient
// rows to the new recipe id.
export async function copyRecipeAction(
  id: string,
  rawName: string,
): Promise<ActionResult<{ id: string }>> {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Give the copy a name" };
  if (name.length > 100) return { ok: false, error: "Name too long" };

  const supabase = supabaseAdmin();
  const { data: source, error: srcErr } = await supabase
    .from("recipes")
    .select(
      "name, instructions, source_url, default_servings, prep_minutes, cook_minutes, image_url, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (srcErr) return { ok: false, error: srcErr.message };
  if (!source) return { ok: false, error: "Source recipe not found" };

  const { data: ings, error: ingsErr } = await supabase
    .from("recipe_ingredients")
    .select("ingredient_id, quantity, note, sort_order")
    .eq("recipe_id", id);
  if (ingsErr) return { ok: false, error: ingsErr.message };

  const { data: copy, error: insErr } = await supabase
    .from("recipes")
    .insert({
      name,
      instructions: source.instructions,
      source_url: source.source_url,
      default_servings: source.default_servings,
      prep_minutes: source.prep_minutes,
      cook_minutes: source.cook_minutes,
      image_url: source.image_url,
      notes: source.notes,
    })
    .select("id")
    .single();
  if (insErr || !copy) {
    if (insErr?.code === "23505") {
      return { ok: false, error: `"${name}" already exists.` };
    }
    return { ok: false, error: insErr?.message ?? "Copy failed" };
  }

  if (ings && ings.length > 0) {
    const rows = ings.map((ing) => ({
      recipe_id: copy.id,
      ingredient_id: ing.ingredient_id,
      quantity: ing.quantity,
      note: ing.note,
      sort_order: ing.sort_order,
    }));
    const { error: linkErr } = await supabase
      .from("recipe_ingredients")
      .insert(rows);
    if (linkErr) {
      // Roll back the new recipe if ingredient copy failed.
      await supabase.from("recipes").delete().eq("id", copy.id);
      return { ok: false, error: linkErr.message };
    }
  }

  return { ok: true, id: copy.id };
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

  return { ok: true, ingredient: data as unknown as Ingredient };
}
