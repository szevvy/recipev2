import { NextRequest, NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week");
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json(
      { ok: false, error: "Invalid week parameter" },
      { status: 400 },
    );
  }

  const [y, m, d] = week.split("-").map(Number);
  const weekStart = new Date(y, m - 1, d);
  const weekEndIso = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data, error } = await supabaseAdmin()
    .from("meal_plan")
    .select(
      "*, recipes(id, name, default_servings, image_url), " +
        "meal_plan_custom_ingredients(id, meal_plan_id, ingredient_id, name, quantity, sort_order, ingredients(id, name, group_name))",
    )
    .gte("date", week)
    .lte("date", weekEndIso)
    .is("slot", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, meals: data ?? [] });
}
