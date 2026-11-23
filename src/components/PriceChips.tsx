"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BOOTSTRAP_KEY, type BootstrapData } from "@/lib/queries";
import type { Retailer } from "@/lib/types";

// A chip group: one price label, one or more retailer icons. When two
// retailers advertise the exact same price we collapse them into a
// single chip ([coles][woolies] $37.00/kg) — see grouping logic below.
export type ChipGroup = {
  key: string;
  retailers: {
    retailer: Retailer;
    icon: string;
    // Non-empty when that retailer has more than one SKU — tells the
    // user which specific variant the group's price is quoting.
    variantHint: string | null;
  }[];
  priceLabel: string;
  cheapest: boolean;
  outOfStock: boolean;
  // Only true when every retailer in the group is on sale — avoids
  // falsely implying a non-sale retailer is on sale after a merge.
  onSale: boolean;
  // Multi-line tooltip: each retailer's per-SKU breakdown.
  title: string;
};

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

export function usePriceChipsFor(ingredientId: string | null): ChipGroup[] {
  const qc = useQueryClient();
  if (!ingredientId) return [];
  const bootstrap = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
  const prices = (bootstrap?.prices ?? []).filter(
    (p) => p.ingredient_id === ingredientId,
  );
  if (prices.length === 0) return [];
  // Per-retailer weight (grams) set on the ingredient — lets us derive
  // $/kg when the retailer only publishes an each price.
  const ingredient = (bootstrap?.ingredients ?? []).find(
    (i) => i.id === ingredientId,
  );
  const weights = ingredient?.retailer_weights ?? null;

  // Group by retailer and collapse variants: one chip per retailer. We
  // prefer unit price ($/kg etc.) for cheapest decisions so a smaller
  // pack doesn't fake a win over a larger one. Falls back to pack price
  // when no unit price is available.
  const byRetailer = new Map<Retailer, typeof prices>();
  for (const p of prices) {
    const bucket = byRetailer.get(p.retailer) ?? [];
    bucket.push(p);
    byRetailer.set(p.retailer, bucket);
  }

  type Pricing = {
    retailer: Retailer;
    bestUnitCents: number | null;
    bestUnitOfMeasure: string | null;
    bestPackCents: number | null;
    bestVariantTitle: string | null;
    variantCount: number;
    onSale: boolean;
    outOfStock: boolean;
    titleLines: string[];
  };
  const pricings: Pricing[] = [];
  for (const [retailer, bucket] of byRetailer) {
    const inStock = bucket.filter(
      (p) => p.in_stock && p.price_cents != null,
    );
    // Pick the cheapest variant by unit price (when available). Fall back
    // to pack price for variants / retailers that don't publish one.
    const bestVariant =
      inStock.length === 0
        ? null
        : inStock
            .slice()
            .sort((a, b) => {
              const au = a.unit_price_cents ?? Number.MAX_SAFE_INTEGER;
              const bu = b.unit_price_cents ?? Number.MAX_SAFE_INTEGER;
              if (au !== bu) return au - bu;
              const ap = a.price_cents ?? Number.MAX_SAFE_INTEGER;
              const bp = b.price_cents ?? Number.MAX_SAFE_INTEGER;
              return ap - bp;
            })[0] ?? null;
    const titleLines = bucket
      .slice()
      .sort((a, b) => {
        const av = a.unit_price_cents ?? a.price_cents ?? Number.MAX_SAFE_INTEGER;
        const bv = b.unit_price_cents ?? b.price_cents ?? Number.MAX_SAFE_INTEGER;
        return av - bv;
      })
      .map((p) => {
        const title = p.product_title ?? `#${p.stock_code}`;
        if (!p.in_stock || p.price_cents == null) {
          return `${title} — out of stock`;
        }
        const pack = `$${(p.price_cents / 100).toFixed(2)}`;
        const unit =
          p.unit_price_cents != null && p.unit_of_measure
            ? ` · $${(p.unit_price_cents / 100).toFixed(2)}/${p.unit_of_measure}`
            : "";
        const sale = p.on_sale ? " (sale)" : "";
        return `${title} — ${pack}${unit}${sale}`;
      });
    // Normalise to $/kg using the user-set weight whenever the actor
    // isn't already quoting in kg — Woolies sometimes returns
    // "$0.86/ea" which is non-comparable with Coles's "$4.90/kg".
    // Actor's kg price still wins when it's there; we only override
    // when the uom is "ea" / "100g" / anything else.
    const retailerWeight = weights?.[retailer] ?? null;
    let bestUnitCents = bestVariant?.unit_price_cents ?? null;
    let bestUnitOfMeasure = bestVariant?.unit_of_measure ?? null;
    if (
      bestVariant &&
      bestVariant.price_cents != null &&
      retailerWeight != null &&
      retailerWeight > 0 &&
      bestUnitOfMeasure !== "kg"
    ) {
      bestUnitCents = Math.round(
        (bestVariant.price_cents * 1000) / retailerWeight,
      );
      bestUnitOfMeasure = "kg";
    }
    pricings.push({
      retailer,
      bestUnitCents,
      bestUnitOfMeasure,
      bestPackCents: bestVariant?.price_cents ?? null,
      bestVariantTitle: bestVariant?.product_title ?? null,
      variantCount: bucket.length,
      onSale: !!bestVariant?.on_sale,
      outOfStock: !bestVariant,
      titleLines,
    });
  }

  // Across retailers, only call a "cheapest" winner when the comparison
  // is honest — either every in-stock retailer publishes a unit price in
  // the SAME unit_of_measure, or none do and we fall back to pack price.
  const inStockChips = pricings.filter((p) => !p.outOfStock);
  const allHaveUnit = inStockChips.every(
    (p) => p.bestUnitCents != null && p.bestUnitOfMeasure != null,
  );
  const sharedUom =
    allHaveUnit &&
    inStockChips.every(
      (p) => p.bestUnitOfMeasure === inStockChips[0]?.bestUnitOfMeasure,
    );
  const cheapestUnit =
    sharedUom && inStockChips.length > 0
      ? Math.min(...inStockChips.map((p) => p.bestUnitCents as number))
      : null;
  const cheapestPack =
    cheapestUnit == null && inStockChips.length > 0
      ? inStockChips
          .map((p) => p.bestPackCents)
          .filter((v): v is number => v != null)
          .reduce<number | null>((acc, v) => (acc == null || v < acc ? v : acc), null)
      : null;

  const perRetailer = pricings
    .slice()
    .sort((a, b) => a.retailer.localeCompare(b.retailer))
    .map((p) => {
      // Primary chip label: unit price when we've got one, pack price otherwise.
      const priceLabel =
        p.bestUnitCents != null && p.bestUnitOfMeasure
          ? `$${(p.bestUnitCents / 100).toFixed(2)}/${p.bestUnitOfMeasure}`
          : p.bestPackCents != null
          ? `$${(p.bestPackCents / 100).toFixed(2)}`
          : "—";
      const cheapest =
        !p.outOfStock &&
        ((cheapestUnit != null && p.bestUnitCents === cheapestUnit) ||
          (cheapestPack != null && p.bestPackCents === cheapestPack));
      return {
        retailer: p.retailer,
        icon: RETAILER_ICON[p.retailer],
        priceLabel,
        variantHint:
          p.variantCount > 1 && p.bestVariantTitle ? p.bestVariantTitle : null,
        cheapest,
        outOfStock: p.outOfStock,
        onSale: p.onSale,
        title:
          p.titleLines.length > 1
            ? `${RETAILER_LABEL[p.retailer]}:\n${p.titleLines.join("\n")}`
            : `${RETAILER_LABEL[p.retailer]}: ${p.titleLines[0] ?? ""}`,
      };
    });

  // Collapse retailers that advertise the exact same price label into
  // one chip. OOS chips stay per-retailer so we don't hide which
  // retailer is actually out. `onSale` only sticks when every merged
  // retailer is on sale — otherwise we'd be labelling a non-sale item
  // as discounted.
  const groups = new Map<string, ChipGroup>();
  for (const c of perRetailer) {
    const key = c.outOfStock ? `oos:${c.retailer}` : `price:${c.priceLabel}`;
    const existing = groups.get(key);
    if (existing) {
      existing.retailers.push({
        retailer: c.retailer,
        icon: c.icon,
        variantHint: c.variantHint,
      });
      existing.onSale = existing.onSale && c.onSale;
      existing.cheapest = existing.cheapest || c.cheapest;
      existing.title = `${existing.title}\n\n${c.title}`;
    } else {
      groups.set(key, {
        key,
        retailers: [
          {
            retailer: c.retailer,
            icon: c.icon,
            variantHint: c.variantHint,
          },
        ],
        priceLabel: c.priceLabel,
        cheapest: c.cheapest,
        outOfStock: c.outOfStock,
        onSale: c.onSale,
        title: c.title,
      });
    }
  }

  // Sort so cheapest first, then by first retailer name (stable order).
  return Array.from(groups.values()).sort((a, b) => {
    if (a.cheapest !== b.cheapest) return a.cheapest ? -1 : 1;
    if (a.outOfStock !== b.outOfStock) return a.outOfStock ? 1 : -1;
    return (a.retailers[0]?.retailer ?? "").localeCompare(
      b.retailers[0]?.retailer ?? "",
    );
  });
}

export function PriceChips({
  ingredientId,
  size = "md",
}: {
  ingredientId: string | null;
  size?: "sm" | "md";
}) {
  const groups = usePriceChipsFor(ingredientId);
  if (groups.length === 0) return null;
  const textCls = size === "sm" ? "text-[10px]" : "text-xs";
  const iconPx = size === "sm" ? 10 : 12;
  return (
    <div className={`flex items-center gap-2 ${textCls}`}>
      {groups.map((g) => {
        const soloVariantHint =
          g.retailers.length === 1 ? g.retailers[0].variantHint : null;
        return (
          <span
            key={g.key}
            className={
              "inline-flex items-center gap-1 " +
              (g.cheapest
                ? "text-[var(--accent)] font-semibold"
                : "text-[var(--muted)]")
            }
            title={g.title}
          >
            <span className="inline-flex items-center gap-0.5">
              {g.retailers.map((r) => (
                <img
                  key={r.retailer}
                  src={r.icon}
                  alt={r.retailer}
                  width={iconPx}
                  height={iconPx}
                  className="rounded-sm shrink-0"
                />
              ))}
            </span>
            {g.outOfStock ? (
              <span className="line-through">OOS</span>
            ) : (
              <span>{g.priceLabel}</span>
            )}
            {soloVariantHint && !g.outOfStock && (
              <span className="italic text-[var(--muted)] truncate max-w-[12ch]">
                · {soloVariantHint}
              </span>
            )}
            {g.onSale && !g.outOfStock && (
              <span className="text-[9px] uppercase tracking-wide text-[var(--sage)]">
                sale
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
