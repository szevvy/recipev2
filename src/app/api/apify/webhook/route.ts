import { NextResponse } from "next/server";
import { processApifyDataset } from "@/lib/price-refresh";

// Apify POSTs here once a run finishes. We fetch the dataset, parse,
// and upsert into ingredient_prices. No sync limit pressure — this
// function only runs after the actor is done, and the parse+upsert
// over ~22 rows is well under a second.
export const maxDuration = 60;

type ApifyResource = {
  id?: string;
  defaultDatasetId?: string;
  status?: string;
};

type WebhookPayload = {
  eventType?: string;
  resource?: ApifyResource;
  // Back-compat with the previous drilled-placeholder template.
  runId?: string;
  datasetId?: string;
  status?: string;
};

export async function POST(request: Request) {
  const expected = process.env.APIFY_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "APIFY_WEBHOOK_SECRET env var not set" },
      { status: 500 },
    );
  }
  const token = new URL(request.url).searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const runId = payload.resource?.id ?? payload.runId ?? "?";
  const datasetId =
    payload.resource?.defaultDatasetId ?? payload.datasetId ?? null;
  const status = payload.resource?.status ?? payload.status ?? null;
  console.log(
    `[apify webhook] eventType=${payload.eventType ?? "?"} runId=${runId} status=${status} datasetId=${datasetId ?? "null"}`,
  );

  // Apify fires both SUCCEEDED and FAILED. Only process datasets for
  // successful runs; log-and-200 the failures so Apify doesn't retry
  // them (nothing we can do from here anyway).
  if (status && status !== "SUCCEEDED") {
    console.warn(
      `[apify webhook] skipping run ${runId} with status ${status}`,
    );
    return NextResponse.json({ ok: true, skipped: true, status });
  }

  if (!datasetId) {
    return NextResponse.json(
      { ok: false, error: "Missing datasetId" },
      { status: 400 },
    );
  }

  const result = await processApifyDataset(datasetId);
  if (!result.ok) {
    console.error(`[apify webhook] processing failed: ${result.error}`);
    return NextResponse.json(result, { status: 500 });
  }
  console.log(
    `[apify webhook] processed run ${runId}: updated=${result.totals.updated} oos=${result.totals.outOfStock}`,
  );
  return NextResponse.json(result);
}
