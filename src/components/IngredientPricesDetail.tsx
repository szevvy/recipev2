"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { BOOTSTRAP_KEY, type BootstrapData } from "@/lib/queries";
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

// Derive pack size from pack + unit price (e.g. $7.40 pack @ $37/kg → 200g).
// Converts sub-1 kg/L into g/ml so "200g" reads better than "0.2kg".
function formatPackSize(
  packCents: number,
  unitCents: number,
  uom: string,
): string {
  if (unitCents <= 0) return "";
  const packInUom = packCents / unitCents;
  const u = uom.toLowerCase();
  if (u === "kg") {
    if (packInUom < 1) return `${Math.round(packInUom * 1000)}g`;
    return `${packInUom >= 10 ? packInUom.toFixed(0) : packInUom.toFixed(1)}kg`;
  }
  if (u === "l") {
    if (packInUom < 1) return `${Math.round(packInUom * 1000)}ml`;
    return `${packInUom >= 10 ? packInUom.toFixed(0) : packInUom.toFixed(1)}L`;
  }
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
        // For each variant, derive $/kg from retailer weight when the
        // actor didn't publish one. Keeps the detail panel honest about
        // what we're comparing across retailers.
        const derived = variants.map((p) => {
          if (
            p.unit_price_cents == null &&
            p.price_cents != null &&
            retailerWeight != null &&
            retailerWeight > 0
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
                    {(!p.in_stock || p.price_cents == null) && (
                      <div className="text-[10px] uppercase tracking-wide text-amber-700">
                        out of stock
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                    {p.price_cents != null ? (
                      <>
                        <span className="font-medium">
                          ${(p.price_cents / 100).toFixed(2)}
                          {p.unit_price_cents != null && p.unit_of_measure && (
                            <span className="text-[var(--muted)] font-normal">
                              /{formatPackSize(p.price_cents, p.unit_price_cents, p.unit_of_measure)}
                            </span>
                          )}
                        </span>
                        {p.unit_price_cents != null && p.unit_of_measure && (
                          <span className="text-[var(--muted)]">
                            ${(p.unit_price_cents / 100).toFixed(2)}/{p.unit_of_measure}
                          </span>
                        )}
                        {p.on_sale && (
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
