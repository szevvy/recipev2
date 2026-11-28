#!/usr/bin/env node
/**
 * Standalone Woolworths unit-weight fetcher.
 *
 * Reads every ingredient flagged auto_fetch_weight=true from Supabase,
 * primes a Woolworths session with the local IP's cookies (datacenter
 * IPs like Vercel's hit a 403 — this needs to run on a residential
 * connection), pulls UnitWeightInGrams per Woolies stock code, and
 * upserts the result to ingredient_retailer_weights.
 *
 * Usage:
 *   node scripts/refresh-weights.mjs
 *
 * Required env:
 *   SUPABASE_URL                   e.g. https://xyzabc.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY      full service_role key from Supabase
 *
 * No dependencies — just Node 20+ built-ins.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function env() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment",
    );
  }
}

async function supaGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function supaUpsert(path, rows, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${path}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(
      `Supabase upsert ${path}: ${res.status} ${await res.text()}`,
    );
  }
}

async function primeSession() {
  // Walk redirects manually so cookies from every hop land in our jar.
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

  const optedIn = await supaGet(
    "ingredients?auto_fetch_weight=eq.true&select=id",
  );
  if (!optedIn.length) {
    return {
      ok: true,
      opted_in: 0,
      fetched: 0,
      upserted: 0,
      durationMs: Date.now() - started,
    };
  }
  const ingredientIds = optedIn.map((r) => r.id);

  // Supabase REST's "in" filter wants a parenthesised, comma-separated list.
  const inFilter = `(${ingredientIds.join(",")})`;
  const codes = await supaGet(
    `ingredient_retailer_codes?retailer=eq.woolworths&ingredient_id=in.${encodeURIComponent(inFilter)}&select=ingredient_id,stock_code`,
  );
  if (!codes.length) {
    return {
      ok: true,
      opted_in: optedIn.length,
      fetched: 0,
      upserted: 0,
      note: "no Woolworths codes on opted-in ingredients",
      durationMs: Date.now() - started,
    };
  }

  const codeToIngredient = new Map();
  for (const row of codes) codeToIngredient.set(row.stock_code, row.ingredient_id);
  const uniqueCodes = Array.from(new Set(codes.map((r) => r.stock_code)));

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
      console.warn(`[weights] ${code}: ${e.message ?? e}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const upserts = Array.from(perIngredient.entries()).map(
    ([ingredient_id, unit_weight_g]) => ({
      ingredient_id,
      retailer: "woolworths",
      unit_weight_g,
      updated_at: new Date().toISOString(),
    }),
  );
  if (upserts.length) {
    await supaUpsert(
      "ingredient_retailer_weights",
      upserts,
      "ingredient_id,retailer",
    );
  }

  return {
    ok: true,
    opted_in: optedIn.length,
    codes_checked: uniqueCodes.length,
    fetched: perIngredient.size,
    upserted: upserts.length,
    durationMs: Date.now() - started,
  };
}

// Run as CLI when invoked directly (not when imported by the server).
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
