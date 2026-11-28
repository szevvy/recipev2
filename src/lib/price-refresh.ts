import "server-only";
import { supabaseAdmin } from "./supabase";
import { getSettings } from "./settings";
import type { Retailer } from "./types";

// vant47/australian-supermarket-prices-scraper actor on Apify.
// We used to hit run-sync-get-dataset-items (one HTTP call that starts
// the actor + blocks for the result), but that was bumping into Vercel
// Hobby's 60s function limit. Now we POST to /runs (async) with a
// webhook pointing at /api/apify/webhook, return immediately, and the
// webhook handler does the DB work when the dataset is ready.
const APIFY_ACTOR = "vant47~australian-supermarket-prices-scraper";

export type RefreshTotals = {
  // Number of (ingredient, retailer) codes we asked Apify about.
  requested: number;
  // Rows the actor returned with recordType === "PRODUCT".
  products: number;
  // Rows with recordType === "NOTE" (usually "out of stock" or similar).
  notes: number;
  // ingredient_prices rows we wrote.
  updated: number;
  // Rows marked in_stock=false (either NOTE or missing from the response).
  outOfStock: number;
};

export type KickoffResult =
  | { ok: true; runId: string; requested: number }
  | { ok: false; error: string };

export type ProcessResult =
  | { ok: true; totals: RefreshTotals; durationMs: number }
  | { ok: false; error: string };

type DatasetRow = {
  // In practice the actor only sets recordType for NOTE rows — regular
  // product rows omit the field, so we treat `undefined` as PRODUCT.
  recordType?: "PRODUCT" | "NOTE" | string | null;
  retailer?: string | null;
  productId?: string | null;
  title?: string | null;
  brand?: string | null;
  size?: string | null;
  price?: number | null;
  regularPrice?: number | null;
  onSale?: boolean | null;
  promoText?: string | null;
  unitPrice?: number | null;
  unitOfMeasure?: string | null;
  inStock?: boolean | null;
  url?: string | null;
  imageUrl?: string | null;
  scrapedAt?: string | null;
  verdict?: string | null;
};

function toCents(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

// The actor's `onSale` flag fires on shelf promotions that aren't real
// price cuts (e.g. 98c Pink Lady apples, regularPrice=null, promoText=null
// — just a merchandising highlight). Only count it as "on sale" when
// there's an actual regular→special delta OR a non-empty promoText.
function isTrulyOnSale(row: {
  price?: number | null;
  regularPrice?: number | null;
  promoText?: string | null;
}): boolean {
  const price = row.price;
  const regular = row.regularPrice;
  if (price != null && regular != null && regular > price) return true;
  const promo = row.promoText?.trim();
  if (promo) return true;
  return false;
}

function normaliseRetailer(raw: string | null | undefined): Retailer | null {
  if (!raw) return null;
  // The actor returns the retailer with trailing qualifiers sometimes —
  // "Woolworths Australia", "Coles Supermarkets" etc. — so match on a
  // substring rather than an exact token.
  const lower = raw.toLowerCase();
  if (lower.includes("coles")) return "coles";
  if (lower.includes("woolworths") || lower.includes("woolies")) return "woolworths";
  if (lower.includes("aldi")) return "aldi";
  return null;
}

// The actor sometimes omits `productId` from the row and only gives us a
// URL. Extract the ID from the usual Coles/Woolies/ALDI product URL shapes.
function productIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Coles: https://www.coles.com.au/product/<id>
  // Woolies: https://www.woolworths.com.au/shop/productdetails/<id>
  // ALDI: various, usually ends with a numeric slug
  const m = url.match(/\/(?:product|productdetails)\/(\d+)/);
  if (m) return m[1];
  // Fallback — last numeric path segment.
  const segments = url.split("?")[0].split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (/^\d+$/.test(seg)) return seg;
  }
  return null;
}

type CodeRef = {
  ingredient_id: string;
  retailer: Retailer;
  stock_code: string;
};

async function loadCodes(): Promise<
  | { ok: true; codes: CodeRef[] }
  | { ok: false; error: string }
> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("ingredient_retailer_codes")
    .select("ingredient_id, retailer, stock_code");
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    codes: (data ?? []).map((row) => ({
      ingredient_id: row.ingredient_id,
      retailer: row.retailer as Retailer,
      stock_code: row.stock_code,
    })),
  };
}

// Start an Apify run and register a webhook back to our own
// /api/apify/webhook endpoint for when it finishes. Returns the run ID
// immediately (no waiting), so this function stays well under any
// Vercel timeout.
export async function kickoffPriceRefresh(
  webhookUrl: string,
): Promise<KickoffResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { ok: false, error: "APIFY_TOKEN env var not set" };

  const settings = await getSettings();
  const postcode = settings.postcode;
  if (!postcode) return { ok: false, error: "Set a postcode in Settings first" };

  const codesResult = await loadCodes();
  if (!codesResult.ok) return codesResult;
  if (codesResult.codes.length === 0) {
    return { ok: false, error: "No retailer stock codes saved yet" };
  }

  const retailerSet = new Set<Retailer>();
  const productIds: string[] = [];
  for (const row of codesResult.codes) {
    retailerSet.add(row.retailer);
    productIds.push(`${row.retailer}:${row.stock_code}`);
  }

  const input = {
    retailers: Array.from(retailerSet),
    productIds,
    postalCodes: [postcode],
    maxItemsPerRetailer: Math.max(50, productIds.length),
    maxItems: Math.max(100, productIds.length * 2),
    includeDetails: false,
  };

  // Apify wants ad-hoc webhooks as a base64-encoded JSON array passed
  // as the `webhooks` query parameter on the run endpoint. Fire on
  // SUCCEEDED and FAILED so we can log failures too.
  //
  // Payload template uses whole-object substitution for `resource` —
  // that's the pattern from Apify's own docs and avoids any ambiguity
  // about property drilling in their templating engine. The webhook
  // handler extracts the fields it needs from the resource object.
  const webhookConfig = [
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
      requestUrl: webhookUrl,
      payloadTemplate:
        '{"eventType":"{{eventType}}","resource":{{resource}}}',
    },
  ];
  const webhooksB64 = Buffer.from(JSON.stringify(webhookConfig)).toString(
    "base64",
  );

  const url =
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs` +
    `?token=${encodeURIComponent(token)}` +
    `&webhooks=${encodeURIComponent(webhooksB64)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Apify returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const payload = (await res.json()) as { data?: { id?: string } };
    const runId = payload.data?.id;
    if (!runId) {
      return { ok: false, error: "Apify response missing run id" };
    }
    return { ok: true, runId, requested: codesResult.codes.length };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Apify call failed",
    };
  }
}

// Fetch a finished run's dataset items, parse them, and upsert into
// ingredient_prices. Called from the Apify webhook handler.
export async function processApifyDataset(
  datasetId: string,
): Promise<ProcessResult> {
  const started = Date.now();
  const token = process.env.APIFY_TOKEN;
  if (!token) return { ok: false, error: "APIFY_TOKEN env var not set" };

  const codesResult = await loadCodes();
  if (!codesResult.ok) return codesResult;

  const ingredientLookup = new Map<string, CodeRef>();
  for (const row of codesResult.codes) {
    ingredientLookup.set(`${row.retailer}:${row.stock_code}`, row);
  }

  const datasetUrl =
    `https://api.apify.com/v2/datasets/${datasetId}/items` +
    `?token=${encodeURIComponent(token)}&clean=true`;
  let rows: DatasetRow[] = [];
  try {
    const res = await fetch(datasetUrl, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Apify dataset fetch ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    rows = (await res.json()) as DatasetRow[];
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Dataset fetch failed",
    };
  }

  // Index results by (retailer, productId). See earlier notes on actor
  // quirks: recordType omitted for products, retailer may be title-cased
  // with trailing words, productId sometimes missing (derive from URL).
  const resultByKey = new Map<string, DatasetRow>();
  let products = 0;
  let notes = 0;
  for (const row of rows) {
    const retailer = normaliseRetailer(row.retailer);
    if (!retailer) continue;
    const productId =
      (row.productId && String(row.productId).trim()) ||
      productIdFromUrl(row.url);
    if (!productId) continue;
    const key = `${retailer}:${productId}`;
    const isNote = row.recordType === "NOTE";
    if (isNote) {
      notes++;
      if (!resultByKey.has(key)) resultByKey.set(key, row);
      continue;
    }
    products++;
    resultByKey.set(key, row);
  }

  const upserts: {
    ingredient_id: string;
    retailer: Retailer;
    stock_code: string;
    price_cents: number | null;
    regular_price_cents: number | null;
    on_sale: boolean;
    in_stock: boolean;
    unit_price_cents: number | null;
    unit_of_measure: string | null;
    unit_price_text: string | null;
    product_title: string | null;
    product_url: string | null;
    image_url: string | null;
    promo_text: string | null;
    fetched_at: string;
  }[] = [];
  const nowIso = new Date().toISOString();
  let outOfStock = 0;
  for (const [key, ref] of ingredientLookup) {
    const match = resultByKey.get(key) ?? null;
    const isProduct = !!match && match.recordType !== "NOTE";
    const inStock = isProduct && (match?.inStock ?? true) !== false;
    if (!inStock) outOfStock++;
    const unitPriceCents =
      isProduct && match?.unitPrice != null
        ? toCents(match.unitPrice as number)
        : null;
    const rawUnitOfMeasure =
      isProduct && match?.unitOfMeasure ? String(match.unitOfMeasure) : null;
    const unitOfMeasure = rawUnitOfMeasure
      ? rawUnitOfMeasure.replace(/^1(?!\d)\s*/i, "").trim().toLowerCase()
      : null;
    upserts.push({
      ingredient_id: ref.ingredient_id,
      retailer: ref.retailer,
      stock_code: ref.stock_code,
      price_cents: isProduct ? toCents(match?.price ?? null) : null,
      regular_price_cents: isProduct ? toCents(match?.regularPrice ?? null) : null,
      on_sale: !!(isProduct && match && isTrulyOnSale(match)),
      in_stock: inStock,
      unit_price_cents: unitPriceCents,
      unit_of_measure: unitOfMeasure,
      unit_price_text:
        unitPriceCents != null && unitOfMeasure
          ? `$${(unitPriceCents / 100).toFixed(2)}/${unitOfMeasure}`
          : null,
      product_title: isProduct ? match?.title ?? null : null,
      product_url: isProduct ? match?.url ?? null : null,
      image_url: isProduct ? match?.imageUrl ?? null : null,
      promo_text: isProduct ? match?.promoText ?? null : null,
      fetched_at: nowIso,
    });
  }

  let updated = 0;
  const supabase = supabaseAdmin();
  if (upserts.length > 0) {
    const { error: upsertErr } = await supabase
      .from("ingredient_prices")
      .upsert(upserts, { onConflict: "ingredient_id,retailer,stock_code" });
    if (upsertErr) return { ok: false, error: upsertErr.message };
    updated = upserts.length;
  }

  // Note: Woolworths UnitWeightInGrams auto-fetch is not done here.
  // Woolies blocks Vercel's datacenter IPs (403). The weight refresh
  // runs on a local Linux box via scripts/refresh-weights.mjs — see
  // scripts/README.md.

  return {
    ok: true,
    totals: {
      requested: codesResult.codes.length,
      products,
      notes,
      updated,
      outOfStock,
    },
    durationMs: Date.now() - started,
  };
}

