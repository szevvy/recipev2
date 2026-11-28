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
  try {
    const res = await fetch("https://www.woolworths.com.au/", {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    // Collect every Set-Cookie; keep only the name=value portion so we
    // can echo them back in a single Cookie header.
    const raw = res.headers.getSetCookie?.() ?? [];
    if (raw.length === 0) return null;
    const pairs = raw
      .map((c) => c.split(";")[0]?.trim())
      .filter((v): v is string => !!v);
    return pairs.join("; ");
  } catch {
    return null;
  }
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
      if (!res.ok) continue;
      const json = (await res.json()) as ProductPayload;
      const grams = json.Product?.UnitWeightInGrams;
      if (grams && grams > 0) {
        results.push({ stockCode: code, unitWeightG: Math.round(grams) });
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
  return results;
}
