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

  // Build lookup: "retailer:stock_code" -> { ingredient_id, retailer,
  // stock_code }. The actor accepts a mixed productIds list with
  // retailer:id prefixes so one call covers every retailer, and the
  // ingredient_prices PK is now (ingredient_id, retailer, stock_code) so
  // we track every variant separately.
  type CodeRef = {
    ingredient_id: string;
    retailer: Retailer;
    stock_code: string;
  };
  const ingredientLookup = new Map<string, CodeRef>();
  const retailerSet = new Set<Retailer>();
  const productIds: string[] = [];
  for (const row of codeRows) {
    const retailer = row.retailer as Retailer;
    const key = `${retailer}:${row.stock_code}`;
    ingredientLookup.set(key, {
      ingredient_id: row.ingredient_id,
      retailer,
      stock_code: row.stock_code,
    });
    retailerSet.add(retailer);
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
  // The actor:
  //  - returns NOTE rows for out-of-stock items with recordType="NOTE";
  //  - returns regular product rows WITHOUT a recordType field at all
  //    (so we default to PRODUCT when it's missing);
  //  - returns retailer in title case ("Coles" / "Woolworths") — we
  //    lowercase to match our "coles:..." / "woolworths:..." keys;
  //  - sometimes omits productId — we fall back to parsing the URL.
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

  // Upsert prices + count out-of-stocks. One row per (ingredient, retailer,
  // stock_code) so we capture every variant.
  let updated = 0;
  let outOfStock = 0;
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
  for (const [key, ref] of ingredientLookup) {
    const match = resultByKey.get(key) ?? null;
    // Treat anything other than a NOTE as a product row (actor omits
    // recordType for regular results).
    const isProduct = !!match && match.recordType !== "NOTE";
    const inStock =
      isProduct && (match?.inStock ?? true) !== false;
    if (!inStock) outOfStock++;
    const unitPriceCents =
      isProduct && match?.unitPrice != null
        ? toCents(match.unitPrice as number)
        : null;
    // actor emits "1kg" / "100g" / "1L" etc. — strip a bare leading "1"
    // ("1kg" → "kg") so the display + comparator can group by "kg"
    // vs "100g" cleanly. The negative lookahead keeps "100g" intact —
    // the old regex was gobbling the 1 off "100g", leaving "00g".
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

  if (upserts.length > 0) {
    const { error: upsertErr } = await supabase
      .from("ingredient_prices")
      .upsert(upserts, { onConflict: "ingredient_id,retailer,stock_code" });
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
