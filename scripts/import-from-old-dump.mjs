#!/usr/bin/env node
// One-shot import from the legacy MySQL dump.
// Reads ingredients, recipes, recipe_ingredients from meals.sql,
// upserts into Supabase (service_role), and flags the known staples list.

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DUMP_PATH = process.env.DUMP_PATH ?? "//192.168.1.80/public/meals.sql";

// Ingredient IDs that were in the old "Staples List" (shopping_list.id = 4).
const STAPLE_OLD_IDS = new Set([
  53, 54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 87, 107, 140, 148,
]);

function loadEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").replace(/\\\$/g, "$");
  }
  return env;
}

// ---- MySQL VALUES tuple parser ------------------------------------------
function parseValues(text) {
  const out = [];
  let i = 0;
  const n = text.length;

  function skipWS() {
    while (i < n && /\s/.test(text[i])) i++;
  }

  while (i < n) {
    skipWS();
    if (i < n && text[i] === ",") { i++; continue; }
    if (i >= n) break;
    if (text[i] !== "(") {
      throw new Error(`Expected '(' at ${i}, got ${JSON.stringify(text[i])}`);
    }
    i++;

    const row = [];
    while (true) {
      skipWS();
      if (i >= n) throw new Error("Unexpected end inside tuple");

      let value;
      if (text[i] === "'") {
        i++;
        let s = "";
        while (i < n) {
          const c = text[i];
          if (c === "\\") {
            if (i + 1 >= n) throw new Error("Trailing backslash");
            const next = text[i + 1];
            switch (next) {
              case "n": s += "\n"; break;
              case "r": s += "\r"; break;
              case "t": s += "\t"; break;
              case "0": s += "\0"; break;
              case "'": s += "'"; break;
              case '"': s += '"'; break;
              case "\\": s += "\\"; break;
              case "Z": s += "\x1a"; break;
              case "b": s += "\b"; break;
              default: s += next;
            }
            i += 2;
          } else if (c === "'") {
            i++;
            break;
          } else {
            s += c;
            i++;
          }
        }
        value = s;
      } else if (text.substring(i, i + 4) === "NULL") {
        value = null;
        i += 4;
      } else {
        let num = "";
        while (i < n && /[-\d.eE+]/.test(text[i])) {
          num += text[i];
          i++;
        }
        value = num === "" ? null : Number(num);
      }
      row.push(value);

      skipWS();
      if (i >= n) throw new Error("Unexpected end of tuple");
      if (text[i] === ",") { i++; continue; }
      if (text[i] === ")") { i++; break; }
      throw new Error(`Expected ',' or ')' at ${i}, got ${JSON.stringify(text[i])}`);
    }
    out.push(row);
  }
  return out;
}

function extractInsert(dump, tableName) {
  const prefix = `INSERT INTO \`${tableName}\` VALUES `;
  for (const line of dump.split(/\r?\n/)) {
    if (line.startsWith(prefix)) {
      const body = line.substring(prefix.length).replace(/;$/, "");
      return parseValues(body);
    }
  }
  return [];
}

// ---- Import -------------------------------------------------------------
const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsertIngredient(name, groupName, isStaple) {
  const insert = { name, group_name: groupName, is_staple: isStaple };
  const { data, error } = await supabase
    .from("ingredients")
    .insert(insert)
    .select("id")
    .single();

  if (!error) return data.id;

  if (error.code === "23505") {
    const { data: existing, error: lookupErr } = await supabase
      .from("ingredients")
      .select("id")
      .ilike("name", name)
      .maybeSingle();
    if (lookupErr || !existing) {
      throw new Error(`Could not resolve existing ingredient "${name}": ${lookupErr?.message ?? "not found"}`);
    }
    const { error: updErr } = await supabase
      .from("ingredients")
      .update({ group_name: groupName, is_staple: isStaple })
      .eq("id", existing.id);
    if (updErr) throw new Error(`Update failed for "${name}": ${updErr.message}`);
    return existing.id;
  }
  throw new Error(`Insert failed for "${name}": ${error.message}`);
}

async function upsertRecipe(fields) {
  const { data: existing, error: lookupErr } = await supabase
    .from("recipes")
    .select("id")
    .ilike("name", fields.name)
    .maybeSingle();
  if (lookupErr) throw new Error(`Lookup failed for recipe "${fields.name}": ${lookupErr.message}`);

  if (existing) {
    const { error: updErr } = await supabase
      .from("recipes")
      .update(fields)
      .eq("id", existing.id);
    if (updErr) throw new Error(`Update failed for recipe "${fields.name}": ${updErr.message}`);
    return { id: existing.id, created: false };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("recipes")
    .insert(fields)
    .select("id")
    .single();
  if (insErr) throw new Error(`Insert failed for recipe "${fields.name}": ${insErr.message}`);
  return { id: inserted.id, created: true };
}

async function replaceRecipeIngredients(recipeId, rows) {
  const { error: delErr } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);
  if (delErr) throw new Error(`Delete recipe_ingredients failed: ${delErr.message}`);
  if (rows.length === 0) return;
  const { error: insErr } = await supabase.from("recipe_ingredients").insert(rows);
  if (insErr) throw new Error(`Insert recipe_ingredients failed: ${insErr.message}`);
}

async function main() {
  console.log(`Reading ${DUMP_PATH} ...`);
  const dump = fs.readFileSync(DUMP_PATH, "utf8");

  const oldIngredients = extractInsert(dump, "ingredients");
  const oldRecipes = extractInsert(dump, "recipes");
  const oldRecipeIngredients = extractInsert(dump, "recipe_ingredients");
  console.log(
    `Parsed: ${oldIngredients.length} ingredients, ${oldRecipes.length} recipes, ${oldRecipeIngredients.length} recipe-ingredient rows`,
  );

  // Ingredients ---------------------------------------------------------
  console.log("\nImporting ingredients...");
  const ingredientIdMap = new Map();
  let stapleCount = 0;
  for (const row of oldIngredients) {
    const [oldId, name, category /* unit */, /* nutritionalInfo */, /* createdAt */] = row;
    const groupName = category && category.trim() ? category.trim() : null;
    const isStaple = STAPLE_OLD_IDS.has(oldId);
    if (isStaple) stapleCount++;
    try {
      const newId = await upsertIngredient(name, groupName, isStaple);
      ingredientIdMap.set(oldId, newId);
    } catch (err) {
      console.error(`  ! ${name}: ${err.message}`);
    }
  }
  console.log(`  ingredients: ${ingredientIdMap.size}/${oldIngredients.length} (${stapleCount} flagged as staple)`);

  // Recipes ------------------------------------------------------------
  console.log("\nImporting recipes...");
  const recipeIdMap = new Map();
  let createdRecipes = 0;
  let updatedRecipes = 0;
  for (const row of oldRecipes) {
    const [
      oldId,
      name,
      /* description */,
      instructions,
      prepTime,
      cookTime,
      servings,
      /* difficulty */,
      /* tags */,
      imageUrl,
      /* createdBy */,
      /* createdAt */,
      /* updatedAt */,
    ] = row;
    const fields = {
      name,
      instructions: instructions && instructions.trim() ? instructions : null,
      prep_minutes: prepTime && prepTime > 0 ? prepTime : null,
      cook_minutes: cookTime && cookTime > 0 ? cookTime : null,
      default_servings: servings && servings > 0 ? servings : 4,
      image_url: imageUrl && imageUrl.trim() ? imageUrl : null,
    };
    try {
      const { id, created } = await upsertRecipe(fields);
      recipeIdMap.set(oldId, id);
      if (created) createdRecipes++;
      else updatedRecipes++;
    } catch (err) {
      console.error(`  ! ${name}: ${err.message}`);
    }
  }
  console.log(`  recipes: ${createdRecipes} created, ${updatedRecipes} updated`);

  // Recipe ingredients -------------------------------------------------
  console.log("\nImporting recipe ingredients...");
  const grouped = new Map();
  let skipped = 0;
  for (const row of oldRecipeIngredients) {
    const [/* id */, recipeId, ingredientId, quantity, notes, displayOrder] = row;
    const newRecipeId = recipeIdMap.get(recipeId);
    const newIngredientId = ingredientIdMap.get(ingredientId);
    if (!newRecipeId || !newIngredientId) {
      skipped++;
      continue;
    }
    const bucket = grouped.get(newRecipeId) ?? [];
    bucket.push({
      recipe_id: newRecipeId,
      ingredient_id: newIngredientId,
      quantity: quantity && quantity.trim() ? quantity.trim() : null,
      note: notes && notes.trim() ? notes : null,
      sort_order: Number.isFinite(displayOrder) ? displayOrder : 0,
    });
    grouped.set(newRecipeId, bucket);
  }

  // Dedupe by ingredient within each recipe (schema has unique(recipe_id, ingredient_id))
  for (const [recipeId, rows] of grouped) {
    const seen = new Map();
    for (const r of rows) {
      if (!seen.has(r.ingredient_id)) seen.set(r.ingredient_id, r);
    }
    grouped.set(recipeId, Array.from(seen.values()));
  }

  let insertedPairs = 0;
  for (const [recipeId, rows] of grouped) {
    try {
      await replaceRecipeIngredients(recipeId, rows);
      insertedPairs += rows.length;
    } catch (err) {
      console.error(`  ! recipe ${recipeId}: ${err.message}`);
    }
  }
  console.log(`  recipe_ingredients: ${insertedPairs} rows written across ${grouped.size} recipes (${skipped} dropped — unmapped references)`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
