"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  formatQuantity,
  mergeShoppingItems,
  parseQuantity,
  scaleQuantity,
  type MergeInput,
} from "@/lib/quantity";

export type RebuildResult =
  | { ok: true; added: number }
  | { ok: false; error: string };

// One-off recovery: regenerate state='have' shopping_items for every
// already-shopped meal in the recent window. Mirrors the sync merge logic
// (same (ingredient_id, unit_key) buckets with scaled quantities) but
// inserts as pantry stock, then wires shopping_item_sources back up so the
// plan tab can resolve each meal's ingredients.
//
// Only inserts rows where no shopping_item already exists for that bucket
// — won't overwrite a row the user is already acting on.
export async function rebuildPantryFromShoppedMealsAction(): Promise<RebuildResult> {
  const supabase = supabaseAdmin();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const { data: mealsRaw, error: mealsErr } = await supabase
    .from("meal_plan")
    .select(
      "id, servings, " +
        "recipes(id, default_servings, recipe_ingredients(ingredient_id, quantity)), " +
        "meal_plan_custom_ingredients(ingredient_id, name, quantity)",
    )
    .not("shopped_at", "is", null)
    .gte("date", cutoffIso);
  if (mealsErr) return { ok: false, error: mealsErr.message };

  const meals = (mealsRaw ?? []) as unknown as Array<{
    id: string;
    servings: number | null;
    recipes: {
      id: string;
      default_servings: number;
      recipe_ingredients: { ingredient_id: string; quantity: string | null }[];
    } | null;
    meal_plan_custom_ingredients: {
      ingredient_id: string | null;
      name: string | null;
      quantity: string | null;
    }[];
  }>;

  type Contribution = { meal_plan_id: string; quantity: string | null };
  const contributionsByBucket = new Map<string, Contribution[]>();
  const mergeInputs: MergeInput[] = [];
  function addLibrary(
    mealId: string,
    ingredientId: string,
    quantity: string | null,
    factor: number,
  ) {
    mergeInputs.push({
      ingredient_id: ingredientId,
      quantity,
      servings_factor: factor,
    });
    const parsed = parseQuantity(quantity);
    const scaled = scaleQuantity(parsed, factor);
    const scaledText =
      scaled.qty != null
        ? formatQuantity(scaled.qty, scaled.unit) || null
        : scaled.raw || null;
    const key = `${ingredientId}|${scaled.unit ?? ""}`;
    const list = contributionsByBucket.get(key) ?? [];
    list.push({ meal_plan_id: mealId, quantity: scaledText });
    contributionsByBucket.set(key, list);
  }

  // Free-text ingredients from custom meals: each (meal, name) is one row.
  const freeTextRows: Array<{
    meal_plan_id: string;
    name: string;
    quantity: string | null;
  }> = [];

  for (const meal of meals) {
    if (meal.recipes) {
      const servings = meal.servings ?? meal.recipes.default_servings;
      const factor =
        meal.recipes.default_servings > 0
          ? servings / meal.recipes.default_servings
          : 1;
      for (const ri of meal.recipes.recipe_ingredients) {
        addLibrary(meal.id, ri.ingredient_id, ri.quantity, factor);
      }
    } else {
      for (const ci of meal.meal_plan_custom_ingredients ?? []) {
        if (ci.ingredient_id) {
          addLibrary(meal.id, ci.ingredient_id, ci.quantity, 1);
        } else if (ci.name) {
          freeTextRows.push({
            meal_plan_id: meal.id,
            name: ci.name,
            quantity: ci.quantity,
          });
        }
      }
    }
  }

  const merged = mergeShoppingItems(mergeInputs);

  // Any shopping_items row keyed on (ingredient_id, unit_key) blocks us from
  // inserting a duplicate.
  const { data: existing, error: exErr } = await supabase
    .from("shopping_items")
    .select("id, ingredient_id, unit_key, name, source");
  if (exErr) return { ok: false, error: exErr.message };

  const existingLibKeys = new Set<string>();
  const existingFreeTextItemIds: string[] = [];
  for (const i of existing ?? []) {
    if (i.ingredient_id) {
      existingLibKeys.add(`${i.ingredient_id}|${i.unit_key ?? ""}`);
    } else if (i.source === "meal") {
      existingFreeTextItemIds.push(i.id);
    }
  }

  // For free-text, "already present" means there's a shopping_item with
  // ingredient_id=null linked via a source to this meal_plan_id with this name.
  const existingFreeTextKeys = new Set<string>();
  if (existingFreeTextItemIds.length > 0) {
    const { data: ftSources } = await supabase
      .from("shopping_item_sources")
      .select("shopping_item_id, meal_plan_id")
      .in("shopping_item_id", existingFreeTextItemIds);
    const itemById = new Map<string, { name: string | null }>();
    for (const i of existing ?? []) {
      if (!i.ingredient_id && i.source === "meal") {
        itemById.set(i.id, { name: i.name });
      }
    }
    for (const s of ftSources ?? []) {
      const it = itemById.get(s.shopping_item_id);
      if (!it || !it.name || !s.meal_plan_id) continue;
      existingFreeTextKeys.add(
        `${s.meal_plan_id}|${it.name.trim().toLowerCase()}`,
      );
    }
  }

  // Library inserts.
  const libToInsert = merged
    .filter((m) => !existingLibKeys.has(`${m.ingredient_id}|${m.unit_key ?? ""}`))
    .map((m) => ({
      ingredient_id: m.ingredient_id,
      name: null,
      quantity: m.quantity,
      unit_key: m.unit_key,
      source: "meal" as const,
      state: "have" as const,
    }));

  let added = 0;
  const bucketToInsertedId = new Map<string, string>();
  if (libToInsert.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from("shopping_items")
      .insert(libToInsert)
      .select("id, ingredient_id, unit_key");
    if (insErr) return { ok: false, error: insErr.message };
    added += inserted?.length ?? 0;
    for (const row of inserted ?? []) {
      if (row.ingredient_id) {
        bucketToInsertedId.set(
          `${row.ingredient_id}|${row.unit_key ?? ""}`,
          row.id,
        );
      }
    }

    const libSources: Array<{
      shopping_item_id: string;
      kind: "meal";
      meal_plan_id: string;
      quantity: string | null;
    }> = [];
    for (const [bucket, contribs] of contributionsByBucket) {
      const itemId = bucketToInsertedId.get(bucket);
      if (!itemId) continue;
      for (const c of contribs) {
        libSources.push({
          shopping_item_id: itemId,
          kind: "meal",
          meal_plan_id: c.meal_plan_id,
          quantity: c.quantity,
        });
      }
    }
    if (libSources.length > 0) {
      const { error: srcErr } = await supabase
        .from("shopping_item_sources")
        .insert(libSources);
      if (srcErr) return { ok: false, error: srcErr.message };
    }
  }

  // Free-text inserts: one row per unique (meal_plan_id, name) that's not
  // already linked.
  const ftToInsert = freeTextRows.filter((ft) => {
    const key = `${ft.meal_plan_id}|${ft.name.trim().toLowerCase()}`;
    return !existingFreeTextKeys.has(key);
  });
  if (ftToInsert.length > 0) {
    const { data: insertedFt, error: ftErr } = await supabase
      .from("shopping_items")
      .insert(
        ftToInsert.map((ft) => ({
          ingredient_id: null,
          name: ft.name,
          quantity: ft.quantity,
          source: "meal" as const,
          state: "have" as const,
        })),
      )
      .select("id");
    if (ftErr) return { ok: false, error: ftErr.message };
    added += insertedFt?.length ?? 0;

    const ftSources = (insertedFt ?? []).map((row, idx) => ({
      shopping_item_id: row.id,
      kind: "meal" as const,
      meal_plan_id: ftToInsert[idx].meal_plan_id,
      quantity: ftToInsert[idx].quantity,
    }));
    if (ftSources.length > 0) {
      const { error: srcErr } = await supabase
        .from("shopping_item_sources")
        .insert(ftSources);
      if (srcErr) return { ok: false, error: srcErr.message };
    }
  }

  revalidatePath("/shopping");
  revalidatePath("/plan");
  return { ok: true, added };
}
