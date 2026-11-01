"use client";

import { useState } from "react";
import { paletteColor } from "@/lib/category-palette";
import type { CategoryMetaRow, ShoppingItemWithIngredient } from "@/lib/types";
import { ShoppingItemRow } from "./ShoppingItemRow";

const UNGROUPED = "__ungrouped__";

export function ShoppingList({
  items,
  categoryMeta,
}: {
  items: ShoppingItemWithIngredient[];
  categoryMeta: CategoryMetaRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] italic">
        Nothing to buy right now. Plan some meals, mark staples as needed, or add
        something below.
      </p>
    );
  }

  const metaByName = new Map<string, CategoryMetaRow>();
  for (const m of categoryMeta) metaByName.set(m.name, m);

  const byGroup = new Map<string, ShoppingItemWithIngredient[]>();
  for (const item of items) {
    const key = item.ingredients?.group_name ?? UNGROUPED;
    const bucket = byGroup.get(key) ?? [];
    bucket.push(item);
    byGroup.set(key, bucket);
  }
  for (const bucket of byGroup.values()) {
    bucket.sort((a, b) => {
      const sa = a.state === "bought" ? 1 : 0;
      const sb = b.state === "bought" ? 1 : 0;
      if (sa !== sb) return sa - sb;
      const an = a.ingredients?.name ?? "";
      const bn = b.ingredients?.name ?? "";
      return an.localeCompare(bn);
    });
  }
  const groupKeys = Array.from(byGroup.keys()).sort((a, b) => {
    if (a === UNGROUPED) return 1;
    if (b === UNGROUPED) return -1;
    const sa = metaByName.get(a)?.sort_order ?? 1_000_000;
    const sb = metaByName.get(b)?.sort_order ?? 1_000_000;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-5">
      {groupKeys.map((key) => {
        const label = key === UNGROUPED ? "Other" : key;
        const bucket = byGroup.get(key) ?? [];
        const color = paletteColor(metaByName.get(key)?.color ?? null);
        const headerStyle = color
          ? { backgroundColor: color.chipBg, color: color.chipText }
          : undefined;
        const ulStyle = color
          ? { backgroundColor: `${color.chipBg}47`, borderColor: `${color.chipText}12` }
          : undefined;
        const divideBorder = color ? `${color.chipText}12` : undefined;
        return (
          <section key={key} className="space-y-1">
            <h3
              className={
                "inline-flex items-center font-serif text-sm uppercase tracking-wide px-2.5 py-0.5 rounded-full " +
                (color ? "" : "text-[var(--accent)]")
              }
              style={headerStyle}
            >
              {label}
              <span
                className="ml-2 text-xs font-sans normal-case font-normal opacity-70"
                style={color ? { color: color.chipText } : undefined}
              >
                ({bucket.length})
              </span>
            </h3>
            <ul
              className={
                "rounded-xl p-1 border " +
                (color ? "" : "bg-[var(--surface-muted)]/60 border-transparent divide-y divide-[var(--border)]/60")
              }
              style={ulStyle}
            >
              {bucket.map((item, idx) => (
                <div
                  key={item.id}
                  style={
                    color && idx > 0
                      ? { borderTop: `1px solid ${divideBorder}` }
                      : undefined
                  }
                >
                  <ShoppingItemRow
                    item={item}
                    expanded={expandedId === item.id}
                    onToggleExpand={() => toggle(item.id)}
                    accent={color ? { chipBg: color.chipBg, chipText: color.chipText } : null}
                  />
                </div>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
