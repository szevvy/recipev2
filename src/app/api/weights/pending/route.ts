import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Called by the home-box weight scraper (scripts/refresh-weights.mjs).
// Returns the (ingredient_id, stock_code) pairs the box should fetch
// from Woolies — i.e. every opt-in ingredient's Woolies stock codes.
export const maxDuration = 30;

async function authorize(request: Request): Promise<NextResponse | null> {
  const secret = process.env.WEIGHTS_API_TOKEN;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "WEIGHTS_API_TOKEN env var not set" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  const unauth = await authorize(request);
  if (unauth) return unauth;

  const supabase = supabaseAdmin();
  const { data: optedIn, error: optedErr } = await supabase
    .from("ingredients")
    .select("id")
    .eq("auto_fetch_weight", true);
  if (optedErr) {
    return NextResponse.json(
      { ok: false, error: optedErr.message },
      { status: 500 },
    );
  }
  if (!optedIn || optedIn.length === 0) {
    return NextResponse.json({ ok: true, pending: [] });
  }

  const ingredientIds = optedIn.map((r) => r.id);
  const { data: codes, error: codesErr } = await supabase
    .from("ingredient_retailer_codes")
    .select("ingredient_id, stock_code")
    .eq("retailer", "woolworths")
    .in("ingredient_id", ingredientIds);
  if (codesErr) {
    return NextResponse.json(
      { ok: false, error: codesErr.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, pending: codes ?? [] });
}
