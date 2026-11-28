import { NextResponse } from "next/server";
import { kickoffPriceRefresh } from "@/lib/price-refresh";

// Just fires the Apify run and registers a webhook — doesn't wait for
// the dataset. Should complete in well under a second regardless of
// how many SKUs are in play.
export const maxDuration = 30;

function buildWebhookUrl(request: Request): { ok: true; url: string } | { ok: false; error: string } {
  const secret = process.env.APIFY_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, error: "APIFY_WEBHOOK_SECRET env var not set" };
  }
  const origin = new URL(request.url).origin;
  return {
    ok: true,
    url: `${origin}/api/apify/webhook?token=${encodeURIComponent(secret)}`,
  };
}

async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
  }
  const webhook = buildWebhookUrl(request);
  if (!webhook.ok) {
    return NextResponse.json(webhook, { status: 500 });
  }
  const result = await kickoffPriceRefresh(webhook.url);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result, { status: 202 });
}

// Vercel cron invokes GET; manual / tests can also POST the same way.
export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
