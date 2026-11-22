import { NextResponse } from "next/server";
import { refreshPrices } from "@/lib/price-refresh";

// Allow up to 60s — the Apify sync call can take 30-60s depending on
// how many SKUs we're asking about. Hobby-tier Vercel caps this at 60s.
export const maxDuration = 60;

// Vercel invokes cron GETs with the CRON_SECRET header automatically
// (when set in env + vercel.json). We also accept it as a bearer so the
// endpoint can be hit manually for debugging.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret}`;
    if (auth !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  const result = await refreshPrices();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
