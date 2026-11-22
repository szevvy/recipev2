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
  const inStockPrices = prices.filter(
    (p) => p.in_stock && p.price_cents != null,
  );
  const cheapestCents =
    inStockPrices.length > 0
      ? Math.min(...inStockPrices.map((p) => p.price_cents as number))
      : null;
  return prices
    .slice()
    .sort((a, b) => a.retailer.localeCompare(b.retailer))
    .map((p) => {
      const outOfStock = !p.in_stock || p.price_cents == null;
      const priceLabel =
        p.price_cents != null
          ? `$${(p.price_cents / 100).toFixed(2)}`
          : "—";
      const cheapest =
        !outOfStock && cheapestCents != null && p.price_cents === cheapestCents;
      const title = outOfStock
        ? `Out of stock at ${RETAILER_LABEL[p.retailer]}`
        : [
            p.product_title ?? RETAILER_LABEL[p.retailer],
            p.unit_price_text ?? null,
            p.promo_text ?? null,
          ]
            .filter(Boolean)
            .join(" · ");
      return {
        retailer: p.retailer,
        icon: RETAILER_ICON[p.retailer],
        priceLabel,
        cheapest,
        outOfStock,
        onSale: !!p.on_sale,
        title,
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
