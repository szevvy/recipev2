import "server-only";

// Pull UnitWeightInGrams from Woolworths' internal product-detail API
// for a batch of stock codes. Used by the price-refresh webhook when
// an ingredient has auto_fetch_weight=true so we don't have to type
// per-unit weights manually.
//
// Flow:
//   1. GET the homepage once to pick up an anti-bot session cookie
//      (undocumented endpoint, so we mimic a real browser enough to
//      not get reset). Returns a Cookie header to reuse.
//   2. GET /apis/ui/product/detail/<id> per stock code with that
//      Cookie header + a Referer. Parse Product.UnitWeightInGrams
//      out of the JSON.
//
// If homepage / individual fetches fail we just omit that code from
// the returned map — the caller keeps whatever weight was already
// stored and tries again next refresh.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export type FetchedWeight = {
  stockCode: string;
  unitWeightG: number;
};

async function primeSession(): Promise<string | null> {
  // Follow redirects manually so we can collect Set-Cookie from every
  // hop — Node's auto-follow only exposes headers of the final response,
  // but anti-bot cookies often land on the first 3xx.
  const jar = new Map<string, string>(); // name -> value
  let url = "https://www.woolworths.com.au/";
  for (let i = 0; i < 6; i++) {
    let res: Response;
    try {
      res = await fetch(url, {
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
    } catch (e) {
      console.warn(
        `[ww weights] primeSession fetch failed: ${e instanceof Error ? e.message : "?"}`,
      );
      return null;
    }
    // Collect cookies from this hop into the jar.
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
      console.warn(`[ww weights] primeSession got ${res.status} at ${url}`);
      return null;
    }
    break;
  }
  if (jar.size === 0) {
    console.warn("[ww weights] primeSession: no cookies captured");
    return null;
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

type ProductPayload = {
  Product?: {
    UnitWeightInGrams?: number | null;
  };
};

export async function fetchWoolworthsWeights(
  stockCodes: readonly string[],
): Promise<FetchedWeight[]> {
  const unique = Array.from(new Set(stockCodes.filter((c) => !!c)));
  if (unique.length === 0) return [];

  const cookie = await primeSession();
  if (!cookie) {
    console.warn("[ww weights] failed to prime session, skipping");
    return [];
  }
  console.log(
    `[ww weights] primed session (${cookie.split(";").length} cookies); fetching ${unique.length} codes`,
  );

  const results: FetchedWeight[] = [];
  for (const code of unique) {
    try {
      const res = await fetch(
        `https://www.woolworths.com.au/apis/ui/product/detail/${encodeURIComponent(code)}`,
        {
          method: "GET",
          headers: {
            "User-Agent": UA,
            Accept: "application/json, text/plain, */*",
            Cookie: cookie,
            Referer: "https://www.woolworths.com.au/",
          },
        },
      );
      if (!res.ok) {
        console.warn(`[ww weights] ${code}: ${res.status}`);
        continue;
      }
      const json = (await res.json()) as ProductPayload;
      const grams = json.Product?.UnitWeightInGrams;
      if (grams && grams > 0) {
        results.push({ stockCode: code, unitWeightG: Math.round(grams) });
      } else {
        console.log(`[ww weights] ${code}: no UnitWeightInGrams`);
      }
    } catch (e) {
      console.warn(
        `[ww weights] fetch ${code} failed: ${e instanceof Error ? e.message : "?"}`,
      );
    }
    // Light rate limit — 20-30 items at 200ms each is well under the
    // webhook's 60s cap.
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(
    `[ww weights] fetched ${results.length}/${unique.length} weights`,
  );
  return results;
}
