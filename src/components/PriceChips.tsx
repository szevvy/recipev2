"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BOOTSTRAP_KEY, type BootstrapData } from "@/lib/queries";
import type { Retailer } from "@/lib/types";

type Chip = {
  retailer: Retailer;
  icon: string;
  priceLabel: string;
  cheapest: boolean;
  outOfStock: boolean;
  onSale: boolean;
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

export function usePriceChipsFor(ingredientId: string | null): Chip[] {
  const qc = useQueryClient();
  if (!ingredientId) return [];
  const bootstrap = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
  const prices = (bootstrap?.prices ?? []).filter(
    (p) => p.ingredient_id === ingredientId,
  );
  if (prices.length === 0) return [];

  // Group by retailer and collapse variants: one chip per retailer that
  // reflects the cheapest in-stock variant. Tooltip enumerates every
  // variant we tracked.
  const byRetailer = new Map<Retailer, typeof prices>();
  for (const p of prices) {
    const bucket = byRetailer.get(p.retailer) ?? [];
    bucket.push(p);
    byRetailer.set(p.retailer, bucket);
  }
  type Pricing = {
    retailer: Retailer;
    best: number | null;
    onSale: boolean;
    outOfStock: boolean;
    titleLines: string[];
  };
  const pricings: Pricing[] = [];
  for (const [retailer, bucket] of byRetailer) {
    const inStock = bucket.filter(
      (p) => p.in_stock && p.price_cents != null,
    );
    const best =
      inStock.length > 0
        ? Math.min(...inStock.map((p) => p.price_cents as number))
        : null;
    // Chip sale tag only if the cheapest variant is on sale — sales from
    // a more expensive variant shouldn't claim the whole chip.
    const bestVariant =
      inStock.find((p) => p.price_cents === best) ?? null;
    const titleLines = bucket
      .slice()
      .sort((a, b) => {
        const av = a.price_cents ?? Number.MAX_SAFE_INTEGER;
        const bv = b.price_cents ?? Number.MAX_SAFE_INTEGER;
        return av - bv;
      })
      .map((p) => {
        const title = p.product_title ?? `#${p.stock_code}`;
        if (!p.in_stock || p.price_cents == null) {
          return `${title} — out of stock`;
        }
        const price = `$${(p.price_cents / 100).toFixed(2)}`;
        const sale = p.on_sale ? " (sale)" : "";
        const unit = p.unit_price_text ? ` · ${p.unit_price_text}` : "";
        return `${title} — ${price}${sale}${unit}`;
      });
    pricings.push({
      retailer,
      best,
      onSale: !!bestVariant?.on_sale,
      outOfStock: best == null,
      titleLines,
    });
  }

  const cheapestAcross =
    pricings
      .map((p) => p.best)
      .filter((v): v is number => v != null)
      .reduce<number | null>((acc, v) => (acc == null || v < acc ? v : acc), null);

  return pricings
    .slice()
    .sort((a, b) => a.retailer.localeCompare(b.retailer))
    .map((p) => ({
      retailer: p.retailer,
      icon: RETAILER_ICON[p.retailer],
      priceLabel: p.best != null ? `$${(p.best / 100).toFixed(2)}` : "—",
      cheapest: !p.outOfStock && cheapestAcross != null && p.best === cheapestAcross,
      outOfStock: p.outOfStock,
      onSale: p.onSale,
      title:
        p.titleLines.length > 1
          ? `${RETAILER_LABEL[p.retailer]}:\n${p.titleLines.join("\n")}`
          : p.titleLines[0] ?? RETAILER_LABEL[p.retailer],
    }));
}

export function PriceChips({
  ingredientId,
  size = "md",
}: {
  ingredientId: string | null;
  size?: "sm" | "md";
}) {
  const chips = usePriceChipsFor(ingredientId);
  if (chips.length === 0) return null;
  const textCls = size === "sm" ? "text-[10px]" : "text-xs";
  const iconPx = size === "sm" ? 10 : 12;
  return (
    <div className={`flex items-center gap-2 ${textCls}`}>
      {chips.map((c) => (
        <span
          key={c.retailer}
          className={
            "inline-flex items-center gap-1 " +
            (c.cheapest
              ? "text-[var(--accent)] font-semibold"
              : "text-[var(--muted)]")
          }
          title={c.title}
        >
          <img
            src={c.icon}
            alt={c.retailer}
            width={iconPx}
            height={iconPx}
            className="rounded-sm shrink-0"
          />
          {c.outOfStock ? (
            <span className="line-through">OOS</span>
          ) : (
            <span>{c.priceLabel}</span>
          )}
          {c.onSale && !c.outOfStock && (
            <span className="text-[9px] uppercase tracking-wide text-[var(--sage)]">
              sale
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
