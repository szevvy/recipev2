import "server-only";
import { supabaseAdmin } from "./supabase";
import { getSettings } from "./settings";
import type { Retailer } from "./types";

// vant47/australian-supermarket-prices-scraper actor on Apify.
// Sync endpoint blocks until the run finishes and returns the dataset
// rows directly. Fine for tens of items; if we ever get to hundreds
// we'd switch to async + a webhook.
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

export type RefreshResult =
  | {
      ok: true;
      totals: RefreshTotals;
      durationMs: number;
      // Non-empty when one retailer's call failed but at least one other
      // succeeded — the Settings button + logs can surface these.
      warnings?: string[];
    }
  | { ok: false; error: string };

type DatasetRow = {
  recordType: "PRODUCT" | "NOTE";
  retailer: Retailer;
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

export async function refreshPrices(): Promise<RefreshResult> {
  const started = Date.now();
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { ok: false, error: "APIFY_TOKEN env var not set" };
  }

  const settings = await getSettings();
  const postcode = settings.postcode;
  if (!postcode) {
    return { ok: false, error: "Set a postcode in Settings first" };
  }

  const supabase = supabaseAdmin();
  const { data: codes, error: codesErr } = await supabase
    .from("ingredient_retailer_codes")
    .select("ingredient_id, retailer, stock_code");
  if (codesErr) return { ok: false, error: codesErr.message };

  const codeRows = codes ?? [];
  if (codeRows.length === 0) {
    return {
      ok: true,
      totals: { requested: 0, products: 0, notes: 0, updated: 0, outOfStock: 0 },
      durationMs: Date.now() - started,
    };
  }

  // Build lookup: "retailer:stock_code" -> ingredient_id. The actor accepts
  // a mixed productIds list with retailer:id prefixes so one call covers
  // every retailer.
  const ingredientLookup = new Map<string, string>();
  const retailerSet = new Set<Retailer>();
  const productIds: string[] = [];
  for (const row of codeRows) {
    const key = `${row.retailer}:${row.stock_code}`;
    ingredientLookup.set(key, row.ingredient_id);
    retailerSet.add(row.retailer as Retailer);
    productIds.push(key);
  }

  const body = {
    retailers: Array.from(retailerSet),
    productIds,
    postalCodes: [postcode],
    maxItemsPerRetailer: Math.max(50, productIds.length),
    maxItems: Math.max(100, productIds.length * 2),
    includeDetails: false,
  };

  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token,
  )}`;

  let rows: DatasetRow[] = [];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Apify returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    rows = (await res.json()) as DatasetRow[];
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Apify call failed",
    };
  }
  const errors: string[] = [];

  // Index results by (retailer, productId) so we can match back to codes.
  const resultByKey = new Map<string, DatasetRow>();
  let products = 0;
  let notes = 0;
  for (const row of rows) {
    if (row.recordType === "NOTE") {
      notes++;
      if (row.retailer && row.productId) {
        // Keep the NOTE around so we can mark it out of stock.
        const key = `${row.retailer}:${row.productId}`;
        if (!resultByKey.has(key)) resultByKey.set(key, row);
      }
      continue;
    }
    if (row.recordType !== "PRODUCT") continue;
    if (!row.retailer || !row.productId) continue;
    products++;
    resultByKey.set(`${row.retailer}:${row.productId}`, row);
  }

  // Upsert prices + count out-of-stocks.
  let updated = 0;
  let outOfStock = 0;
  const upserts: {
    ingredient_id: string;
    retailer: Retailer;
    price_cents: number | null;
    regular_price_cents: number | null;
    on_sale: boolean;
    in_stock: boolean;
    unit_price_text: string | null;
    product_title: string | null;
    product_url: string | null;
    image_url: string | null;
    promo_text: string | null;
    fetched_at: string;
  }[] = [];
  const nowIso = new Date().toISOString();
  for (const [key, ingredientId] of ingredientLookup) {
    const [retailer] = key.split(":") as [Retailer, string];
    const match = resultByKey.get(key) ?? null;
    const isProduct = match?.recordType === "PRODUCT";
    const inStock =
      isProduct && (match?.inStock ?? true) !== false;
    if (!inStock) outOfStock++;
    upserts.push({
      ingredient_id: ingredientId,
      retailer,
      price_cents: isProduct ? toCents(match?.price ?? null) : null,
      regular_price_cents: isProduct ? toCents(match?.regularPrice ?? null) : null,
      on_sale: !!(isProduct && match?.onSale),
      in_stock: inStock,
      unit_price_text:
        isProduct && match?.unitPrice != null
          ? `$${(match.unitPrice as number).toFixed(2)}/${match?.unitOfMeasure ?? ""}`.trim()
          : null,
      product_title: isProduct ? match?.title ?? null : null,
      product_url: isProduct ? match?.url ?? null : null,
      image_url: isProduct ? match?.imageUrl ?? null : null,
      promo_text: isProduct ? match?.promoText ?? null : null,
      fetched_at: nowIso,
    });
  }

  if (upserts.length > 0) {
    const { error: upsertErr } = await supabase
      .from("ingredient_prices")
      .upsert(upserts, { onConflict: "ingredient_id,retailer" });
    if (upsertErr) return { ok: false, error: upsertErr.message };
    updated = upserts.length;
  }

  return {
    ok: true,
    totals: {
      requested: codeRows.length,
      products,
      notes,
      updated,
      outOfStock,
    },
    durationMs: Date.now() - started,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  };
}
