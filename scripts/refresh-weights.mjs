#!/usr/bin/env node
/**
 * Standalone Woolworths unit-weight fetcher — "home box" edition.
 *
 * Runs on a residential IP (Vercel's datacenter range is blocked by
 * Woolies anti-bot). Talks to the deployed app via /api/weights/*
 * endpoints — doesn't need Supabase creds.
 *
 * Flow:
 *   1. GET /api/weights/pending from Vercel — returns the list of
 *      (ingredient_id, stock_code) pairs to look up.
 *   2. Prime a Woolies session (walk redirects collecting cookies).
 *   3. GET /apis/ui/product/detail/<code> for each code, pluck
 *      Product.UnitWeightInGrams.
 *   4. POST the collected weights to /api/weights/submit on Vercel,
 *      which upserts into ingredient_retailer_weights.
 *
 * Usage:
 *   node scripts/refresh-weights.mjs
 *
 * Required env:
 *   VERCEL_API_URL         base URL, e.g. https://homerecipebook.vercel.app
 *   WEIGHTS_API_TOKEN      shared secret, matches Vercel's env var
 *
 * No dependencies — Node 20+ built-ins only.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const VERCEL_API_URL = process.env.VERCEL_API_URL;
const WEIGHTS_API_TOKEN = process.env.WEIGHTS_API_TOKEN;

function env() {
  if (!VERCEL_API_URL || !WEIGHTS_API_TOKEN) {
    throw new Error(
      "VERCEL_API_URL and WEIGHTS_API_TOKEN must be set in the environment",
    );
  }
}

async function fetchPending() {
  const res = await fetch(`${VERCEL_API_URL}/api/weights/pending`, {
    headers: {
      Authorization: `Bearer ${WEIGHTS_API_TOKEN}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(
      `GET /api/weights/pending ${res.status}: ${await res.text()}`,
    );
  }
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "pending returned ok=false");
  return json.pending ?? [];
}

async function submitWeights(weights) {
  const res = await fetch(`${VERCEL_API_URL}/api/weights/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WEIGHTS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ weights }),
  });
  if (!res.ok) {
    throw new Error(
      `POST /api/weights/submit ${res.status}: ${await res.text()}`,
    );
  }
  return res.json();
}

async function primeSession() {
  const jar = new Map();
  let url = "https://www.woolworths.com.au/";
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(jar.size > 0
          ? {
              Cookie: Array.from(jar.entries())
                .map(([k, v]) => `${k}=${v}`)
                .join("; "),
            }
          : {}),
      },
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const first = c.split(";")[0];
      const eq = first?.indexOf("=") ?? -1;
      if (!first || eq <= 0) continue;
      jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      url = new URL(loc, url).toString();
      continue;
    }
    if (!res.ok) {
      throw new Error(`primeSession got ${res.status} at ${url}`);
    }
    break;
  }
  if (jar.size === 0) throw new Error("primeSession: no cookies captured");
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function fetchWeight(stockCode, cookie) {
  const res = await fetch(
    `https://www.woolworths.com.au/apis/ui/product/detail/${encodeURIComponent(stockCode)}`,
    {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        Cookie: cookie,
        Referer: "https://www.woolworths.com.au/",
      },
    },
  );
  if (!res.ok) return { ok: false, status: res.status };
  const json = await res.json();
  const grams = json?.Product?.UnitWeightInGrams;
  if (grams && grams > 0) return { ok: true, grams: Math.round(grams) };
  return { ok: true, grams: null };
}

export async function refreshWeights() {
  env();
  const started = Date.now();

  const pending = await fetchPending();
  if (!pending.length) {
    return {
      ok: true,
      pending: 0,
      fetched: 0,
      upserted: 0,
      durationMs: Date.now() - started,
    };
  }

  const codeToIngredient = new Map();
  for (const row of pending) {
    if (row.stock_code && !codeToIngredient.has(row.stock_code)) {
      codeToIngredient.set(row.stock_code, row.ingredient_id);
    }
  }
  const uniqueCodes = Array.from(codeToIngredient.keys());

  const cookie = await primeSession();
  console.log(
    `[weights] primed session (${cookie.split(";").length} cookies); fetching ${uniqueCodes.length} codes`,
  );

  const perIngredient = new Map();
  for (const code of uniqueCodes) {
    try {
      const result = await fetchWeight(code, cookie);
      if (!result.ok) {
        console.warn(`[weights] ${code}: ${result.status}`);
      } else if (result.grams == null) {
        console.log(`[weights] ${code}: no UnitWeightInGrams`);
      } else {
        const ingredient_id = codeToIngredient.get(code);
        if (ingredient_id && !perIngredient.has(ingredient_id)) {
          perIngredient.set(ingredient_id, result.grams);
        }
        console.log(`[weights] ${code}: ${result.grams}g`);
      }
    } catch (e) {
      console.warn(`[weights] ${code}: ${e?.message ?? e}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const weights = Array.from(perIngredient.entries()).map(
    ([ingredient_id, unit_weight_g]) => ({ ingredient_id, unit_weight_g }),
  );
  let upserted = 0;
  if (weights.length) {
    const result = await submitWeights(weights);
    upserted = result?.upserted ?? 0;
  }

  return {
    ok: true,
    pending: pending.length,
    codes_checked: uniqueCodes.length,
    fetched: weights.length,
    upserted,
    durationMs: Date.now() - started,
  };
}

// Run as CLI when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  refreshWeights()
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(err?.stack ?? err);
      process.exit(1);
    });
}
