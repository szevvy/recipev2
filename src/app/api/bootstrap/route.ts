import { NextResponse } from "next/server";
import { addDays, format, startOfWeek } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { syncShoppingList } from "@/lib/shopping-sync";

// Single JSON payload that covers everything the SPA shows on first paint:
// shopping list state, current week's meal plan, recipes, ingredients,
// categories, and household settings.
export async function GET() {
  // Keep the shopping list fresh with meal plan changes before we return it.
  const sync = await syncShoppingList();
  if (!sync.ok) {
    return NextResponse.json({ ok: false, error: sync.error }, { status: 500 });
  }

  const supabase = supabaseAdmin();
  const settings = await getSettings();
  const weekStart = startOfWeek(new Date(), {
    weekStartsOn: settings.week_starts_on as 0 | 1,
  });
  const weekStartIso = format(weekStart, "yyyy-MM-dd");
  const weekEndIso = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const [
    shoppingResp,
    ingredientsResp,
    recipesResp,
    mealsResp,
    categoryMetaResp,
    latestPurchasesResp,
  ] = await Promise.all([
    supabase
      .from("shopping_items")
      .select(
        "*, ingredients(id, name, group_name, is_staple), shopping_item_sources(id, kind, quantity, meal_plan_id, meal_plan(date, recipes(id, name)))",
      )
      .order("created_at"),
    supabase.from("ingredients").select("*").order("name"),
    supabase
      .from("recipes")
      .select(
        "id, name, image_url, default_servings, prep_minutes, cook_minutes, recipe_ingredients(id)",
      )
      .order("name"),
    supabase
      .from("meal_plan")
      .select(
        "*, " +
          "recipes(id, name, default_servings, image_url, " +
          "recipe_ingredients(id, ingredient_id, quantity, sort_order, ingredients(id, name, group_name))), " +
          "meal_plan_custom_ingredients(id, meal_plan_id, ingredient_id, name, quantity, sort_order, ingredients(id, name, group_name))",
      )
      .gte("date", weekStartIso)
      .lte("date", weekEndIso)
      .is("slot", null),
    supabase.from("category_meta").select("*"),
    supabase.from("latest_purchases").select("ingredient_id, purchased_at"),
  ]);

  const firstErr =
    shoppingResp.error ??
    ingredientsResp.error ??
    recipesResp.error ??
    mealsResp.error ??
    categoryMetaResp.error ??
    latestPurchasesResp.error;
  if (firstErr) {
    return NextResponse.json({ ok: false, error: firstErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      settings,
      weekStart: weekStartIso,
      shoppingItems: shoppingResp.data ?? [],
      ingredients: ingredientsResp.data ?? [],
      recipes: recipesResp.data ?? [],
      meals: mealsResp.data ?? [],
      categoryMeta: categoryMetaResp.data ?? [],
      latestPurchases: latestPurchasesResp.data ?? [],
    },
  });
}
