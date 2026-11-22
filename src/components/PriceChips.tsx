"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BOOTSTRAP_KEY, type BootstrapData } from "@/lib/queries";
import type { Retailer } from "@/lib/types";

type Chip = {
  retailer: Retailer;
  icon: string;
  priceLabel: string;
  // Non-empty when the retailer has more than one SKU — tells the user
  // which specific variant the chip's price is quoting (e.g. "Salmon
  // Skin On" when there are two salmon SKUs).
  variantHint: string | null;
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
    pricings.push({
      retailer,
      bestUnitCents: bestVariant?.unit_price_cents ?? null,
      bestUnitOfMeasure: bestVariant?.unit_of_measure ?? null,
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

  return pricings
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
            : p.titleLines[0] ?? RETAILER_LABEL[p.retailer],
      };
    });
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
          {c.variantHint && !c.outOfStock && (
            <span className="italic text-[var(--muted)] truncate max-w-[12ch]">
              · {c.variantHint}
            </span>
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
