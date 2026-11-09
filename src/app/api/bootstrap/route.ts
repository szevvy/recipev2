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
    listMembershipsResp,
  ] = await Promise.all([
    supabase
      .from("shopping_items")
      .select(
        "*, ingredients(id, name, group_name), shopping_item_sources(id, kind, quantity, meal_plan_id, meal_plan(date, recipes(id, name)))",
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
    supabase
      .from("ingredient_list_memberships")
      .select("ingredient_id, list_name"),
  ]);

  const firstErr =
    shoppingResp.error ??
    ingredientsResp.error ??
    recipesResp.error ??
    mealsResp.error ??
    categoryMetaResp.error ??
    latestPurchasesResp.error ??
    listMembershipsResp.error;
  if (firstErr) {
    return NextResponse.json({ ok: false, error: firstErr.message }, { status: 500 });
  }

  // Attach list memberships to each ingredient so the client never needs a
  // separate lookup. Each ingredient.lists is a de-duped, alpha-sorted array.
  const listsByIngredientId = new Map<string, string[]>();
  for (const row of listMembershipsResp.data ?? []) {
    const list = listsByIngredientId.get(row.ingredient_id) ?? [];
    list.push(row.list_name);
    listsByIngredientId.set(row.ingredient_id, list);
  }
  const ingredients = (ingredientsResp.data ?? []).map((i) => ({
    ...i,
    lists: (listsByIngredientId.get(i.id) ?? []).slice().sort((a, b) =>
      a.localeCompare(b),
    ),
  }));

  return NextResponse.json({
    ok: true,
    data: {
      settings,
      weekStart: weekStartIso,
      shoppingItems: shoppingResp.data ?? [],
      ingredients,
      recipes: recipesResp.data ?? [],
      meals: mealsResp.data ?? [],
      categoryMeta: categoryMetaResp.data ?? [],
      latestPurchases: latestPurchasesResp.data ?? [],
    },
  });
}
