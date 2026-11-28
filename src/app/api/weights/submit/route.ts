import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Receives weights fetched by the home-box scraper and upserts into
// ingredient_retailer_weights(retailer='woolworths'). Shared-token
// auth; nothing here touches user auth / cookies.
export const maxDuration = 30;

type IncomingRow = {
  ingredient_id?: string;
  unit_weight_g?: number;
};

type Body = {
  weights?: IncomingRow[];
};

export async function POST(request: Request) {
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();
  const upserts: Array<{
    ingredient_id: string;
    retailer: "woolworths";
    unit_weight_g: number;
    updated_at: string;
  }> = [];
  for (const row of body.weights ?? []) {
    if (
      typeof row.ingredient_id === "string" &&
      typeof row.unit_weight_g === "number" &&
      row.unit_weight_g > 0
    ) {
      upserts.push({
        ingredient_id: row.ingredient_id,
        retailer: "woolworths",
        unit_weight_g: Math.round(row.unit_weight_g),
        updated_at: nowIso,
      });
    }
  }
  if (upserts.length === 0) {
    return NextResponse.json({ ok: true, upserted: 0 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("ingredient_retailer_weights")
    .upsert(upserts, { onConflict: "ingredient_id,retailer" });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, upserted: upserts.length });
}
