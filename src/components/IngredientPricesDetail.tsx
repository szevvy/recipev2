"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { BOOTSTRAP_KEY, type BootstrapData } from "@/lib/queries";
import { resolvePriceDisplay } from "@/lib/price-display";
import type { IngredientPrice, Retailer } from "@/lib/types";

const RETAILER_ICON: Record<Retailer, string> = {
  coles: "https://www.google.com/s2/favicons?domain=coles.com.au&sz=32",
  woolworths: "https://www.google.com/s2/favicons?domain=woolworths.com.au&sz=32",
  aldi: "https://www.google.com/s2/favicons?domain=aldi.com.au&sz=32",
};
const RETAILER_LABEL: Record<Retailer, string> = {
  coles: "Coles",
  woolworths: "Woolworths",
  aldi: "ALDI",
};

// Actor sometimes concatenates promo clauses with "; " — e.g.
// "Pick any 2 for $12; Any 2 $12". The first clause tends to be the
// verbose, human-written one; the trailing bit is often a terser repeat.
function firstPromoClause(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(";")[0]?.trim();
  return first || null;
}

// Derive pack size from pack + unit price (e.g. $7.40 pack @ $37/kg → 200g).
// Normalises every weight/volume uom into grams/ml internally, then picks
// a human unit on the way out (sub-1000g → g, otherwise kg; same for ml/L).
function formatPackSize(
  packCents: number,
  unitCents: number,
  uom: string,
): string {
  if (unitCents <= 0) return "";
  const packInUom = packCents / unitCents;
  const u = uom.toLowerCase();

  const gramsPerUom: Record<string, number> = {
    kg: 1000,
    "100g": 100,
    "10g": 10,
    g: 1,
  };
  const mlPerUom: Record<string, number> = {
    l: 1000,
    "100ml": 100,
    "10ml": 10,
    ml: 1,
  };
  if (u in gramsPerUom) {
    const grams = packInUom * gramsPerUom[u];
    if (grams >= 1000) {
      const kg = grams / 1000;
      return `${kg >= 10 ? kg.toFixed(0) : kg.toFixed(1)}kg`;
    }
    return `${Math.round(grams)}g`;
  }
  if (u in mlPerUom) {
    const ml = packInUom * mlPerUom[u];
    if (ml >= 1000) {
      const l = ml / 1000;
      return `${l >= 10 ? l.toFixed(0) : l.toFixed(1)}L`;
    }
    return `${Math.round(ml)}ml`;
  }
  // Unknown uom — fall back to raw number + whatever label we got.
  if (packInUom >= 10) return `${packInUom.toFixed(0)}${uom}`;
  if (packInUom >= 1) return `${packInUom.toFixed(1)}${uom}`;
  return `${packInUom.toFixed(2)}${uom}`;
}

// Expandable per-ingredient detail panel: every price snapshot grouped
// by retailer, sorted cheapest first (unit price where available).
// Used in the Ingredients list row expansion + the shopping list row's
// expanded panel.
export function IngredientPricesDetail({
  ingredientId,
}: {
  ingredientId: string;
}) {
  const qc = useQueryClient();
  const bootstrap = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
  const prices = (bootstrap?.prices ?? []).filter(
    (p) => p.ingredient_id === ingredientId,
  );
  if (prices.length === 0) {
    return (
      <p className="text-xs italic text-[var(--muted)]">
        No prices yet. Set a stock code on this ingredient and hit Refresh prices in Settings.
      </p>
    );
  }
  const ingredient = (bootstrap?.ingredients ?? []).find(
    (i) => i.id === ingredientId,
  );
  const weights = ingredient?.retailer_weights ?? null;
  const priceDisplay = resolvePriceDisplay(
    ingredient ?? null,
    bootstrap?.categoryMeta ?? null,
  );

  const byRetailer = new Map<Retailer, IngredientPrice[]>();
  for (const p of prices) {
    const bucket = byRetailer.get(p.retailer) ?? [];
    bucket.push(p);
    byRetailer.set(p.retailer, bucket);
  }

  const sections = Array.from(byRetailer.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  return (
    <div className="space-y-2">
      {sections.map(([retailer, variants]) => {
        const retailerWeight = weights?.[retailer] ?? null;
        // For each variant, normalise to $/kg via the retailer weight
        // whenever the actor isn't already quoting in kg. Keeps the
        // detail panel honest about what we're comparing across
        // retailers (e.g. Woolies's "/ea" turns into "/kg").
        const derived = variants.map((p) => {
          if (
            p.price_cents != null &&
            retailerWeight != null &&
            retailerWeight > 0 &&
            p.unit_of_measure !== "kg"
          ) {
            return {
              ...p,
              unit_price_cents: Math.round(
                (p.price_cents * 1000) / retailerWeight,
              ),
              unit_of_measure: "kg",
            };
          }
          return p;
        });
        const sorted = derived.slice().sort((a, b) => {
          const au = a.unit_price_cents ?? a.price_cents ?? Number.MAX_SAFE_INTEGER;
          const bu = b.unit_price_cents ?? b.price_cents ?? Number.MAX_SAFE_INTEGER;
          return au - bu;
        });
        return (
          <section key={retailer} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <img
                src={RETAILER_ICON[retailer]}
                alt={retailer}
                width={12}
                height={12}
                className="rounded-sm"
              />
              <span className="font-medium text-[var(--foreground)]">
                {RETAILER_LABEL[retailer]}
              </span>
            </div>
            <ul className="divide-y divide-[var(--border)]/40 rounded-lg border border-[var(--border)]/60">
              {sorted.map((p) => (
                <li key={p.stock_code} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="text-[var(--foreground)] truncate">
                      {p.product_title ?? `#${p.stock_code}`}
                    </div>
                    {firstPromoClause(p.promo_text) && (
                      <div className="text-[10px] italic text-[var(--sage)] truncate">
                        {firstPromoClause(p.promo_text)}
                      </div>
                    )}
                    {(!p.in_stock || p.price_cents == null) && (
                      <div className="text-[10px] uppercase tracking-wide text-amber-700">
                        out of stock
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                    {p.price_cents != null ? (
                      <>
                        {/* Was-price (pack) first so it reads "was X · now Y". */}
                        {priceDisplay !== "per_kg" &&
                          p.on_sale &&
                          p.regular_price_cents != null &&
                          p.regular_price_cents > p.price_cents && (
                            <span className="line-through text-[var(--muted)]/70 font-normal">
                              ${(p.regular_price_cents / 100).toFixed(2)}
                            </span>
                          )}
                        {/* Pack price (with pack-size annotation when unit
                            price exists). Hidden in "per_kg" mode. */}
                        {priceDisplay !== "per_kg" && (
                          <span className="font-medium">
                            ${(p.price_cents / 100).toFixed(2)}
                            {priceDisplay === "both" &&
                              p.unit_price_cents != null &&
                              p.unit_of_measure && (
                                <span className="text-[var(--muted)] font-normal">
                                  /{formatPackSize(p.price_cents, p.unit_price_cents, p.unit_of_measure)}
                                </span>
                              )}
                          </span>
                        )}
                        {/* Was-price (per unit) first so it reads "was X · now Y". */}
                        {priceDisplay !== "pack" &&
                          p.on_sale &&
                          p.regular_price_cents != null &&
                          p.regular_price_cents > p.price_cents &&
                          p.unit_price_cents != null &&
                          p.unit_of_measure && (
                            <span className="line-through text-[var(--muted)]/70 font-normal">
                              $
                              {(
                                (p.unit_price_cents * p.regular_price_cents) /
                                p.price_cents /
                                100
                              ).toFixed(2)}
                              /{p.unit_of_measure}
                            </span>
                          )}
                        {/* Unit price. Hidden in "pack" mode. */}
                        {priceDisplay !== "pack" &&
                          p.unit_price_cents != null &&
                          p.unit_of_measure && (
                            <span
                              className={
                                priceDisplay === "per_kg"
                                  ? "font-medium"
                                  : "text-[var(--muted)]"
                              }
                            >
                              ${(p.unit_price_cents / 100).toFixed(2)}/{p.unit_of_measure}
                            </span>
                          )}
                        {p.on_sale &&
                          !(
                            p.regular_price_cents != null &&
                            p.regular_price_cents > p.price_cents
                          ) && (
                            <span className="text-[9px] uppercase tracking-wide text-[var(--sage)]">
                              sale
                            </span>
                          )}
                      </>
                    ) : (
                      <span className="line-through text-[var(--muted)]">OOS</span>
                    )}
                  </div>
                  {p.product_url && (
                    <a
                      href={p.product_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      title="Open on retailer site"
                      className="shrink-0 p-1 text-[var(--muted)] hover:text-[var(--accent)]"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
