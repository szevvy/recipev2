"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { paletteColor } from "@/lib/category-palette";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import type {
  CategoryMetaRow,
  ShoppingItemState,
  ShoppingItemWithIngredient,
} from "@/lib/types";
import { setStapleStateAction } from "./actions";
import { StatePicker } from "./StatePicker";

export type StapleView = {
  ingredient_id: string;
  name: string;
  group_name: string | null;
  state: ShoppingItemState;
};

const UNGROUPED = "__ungrouped__";

export function StaplesSection({
  staples,
  categoryMeta,
}: {
  staples: StapleView[];
  categoryMeta: CategoryMetaRow[];
}) {
  const [open, setOpen] = useState(false);
  if (staples.length === 0) return null;

  const notReviewed = staples.filter((s) => s.state === "not_checked").length;
  const toBuy = staples.filter((s) => s.state === "to_buy").length;
  const have = staples.filter((s) => s.state === "have").length;

  const metaByName = new Map<string, CategoryMetaRow>();
  for (const m of categoryMeta) metaByName.set(m.name, m);

  const byGroup = new Map<string, StapleView[]>();
  for (const s of staples) {
    const key = s.group_name ?? UNGROUPED;
    const bucket = byGroup.get(key) ?? [];
    bucket.push(s);
    byGroup.set(key, bucket);
  }
  for (const bucket of byGroup.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name));
  }
  const groupKeys = Array.from(byGroup.keys()).sort((a, b) => {
    if (a === UNGROUPED) return 1;
    if (b === UNGROUPED) return -1;
    const sa = metaByName.get(a)?.sort_order ?? 1_000_000;
    const sb = metaByName.get(b)?.sort_order ?? 1_000_000;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[var(--surface-muted)] transition-colors"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <span className="font-serif text-base text-[var(--foreground)]">Staples</span>
          </div>
          <span className="text-xs text-[var(--muted)] truncate">
            {notReviewed > 0 && (
              <span className="text-red-600 font-medium">{notReviewed} to review</span>
            )}
            {notReviewed > 0 && (toBuy > 0 || have > 0) && <span> · </span>}
            {toBuy > 0 && <span className="text-[var(--accent)]">{toBuy} to buy</span>}
            {toBuy > 0 && have > 0 && <span> · </span>}
            {have > 0 && <span className="text-[var(--sage)]">{have} have</span>}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={
            "text-[var(--muted)] shrink-0 transition-transform " +
            (open ? "rotate-180" : "")
          }
        />
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-[var(--border)]/60 pt-2 space-y-3">
          {groupKeys.map((key) => {
            const label = key === UNGROUPED ? "Other" : key;
            const bucket = byGroup.get(key) ?? [];
            const color = paletteColor(metaByName.get(key)?.color ?? null);
            const headerStyle = color
              ? { backgroundColor: color.chipBg, color: color.chipText }
              : undefined;
            const ulStyle = color
              ? { backgroundColor: `${color.chipBg}30` }
              : undefined;
            return (
              <section key={key} className="space-y-1">
                <h4
                  className={
                    "inline-flex items-center font-serif text-xs uppercase tracking-wide px-2 py-0.5 rounded-full " +
                    (color ? "" : "text-[var(--muted)]")
                  }
                  style={headerStyle}
                >
                  {label}
                  <span
                    className="ml-1.5 text-[10px] font-sans normal-case font-normal opacity-70"
                    style={color ? { color: color.chipText } : undefined}
                  >
                    ({bucket.length})
                  </span>
                </h4>
                <ul
                  className={color ? "rounded-lg p-1" : "divide-y divide-[var(--border)]/40"}
                  style={ulStyle}
                >
                  {bucket.map((item) => (
                    <StapleRow
                      key={item.ingredient_id}
                      item={item}
                      chipText={color?.chipText ?? null}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StapleRow({
  item,
  chipText,
}: {
  item: StapleView;
  chipText: string | null;
}) {
  const [state, setState] = useState<ShoppingItemState>(item.state);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  useEffect(() => {
    setState(item.state);
  }, [item.state]);

  function patchCache(next: ShoppingItemState, rowId: string) {
    // Mirror the server's insert/update/delete on the bootstrap cache so the
    // staples summary + ShoppingList re-derive instantly without a refetch.
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      const existing = old.shoppingItems.find(
        (i) => i.source === "staple" && i.ingredient_id === item.ingredient_id,
      );
      if (next === "not_checked") {
        if (!existing) return old;
        return {
          ...old,
          shoppingItems: old.shoppingItems.filter((i) => i.id !== existing.id),
        };
      }
      if (existing) {
        return {
          ...old,
          shoppingItems: old.shoppingItems.map((i) =>
            i.id === existing.id ? { ...i, state: next } : i,
          ),
        };
      }
      const ingredient = old.ingredients.find((i) => i.id === item.ingredient_id);
      const newRow: ShoppingItemWithIngredient = {
        id: rowId,
        ingredient_id: item.ingredient_id,
        name: null,
        quantity: null,
        source: "staple",
        source_ref: null,
        state: next,
        notes: null,
        unit_key: null,
        created_at: new Date().toISOString(),
        ingredients: ingredient
          ? {
              id: ingredient.id,
              name: ingredient.name,
              group_name: ingredient.group_name,
            }
          : null,
        shopping_item_sources: [],
      };
      return {
        ...old,
        shoppingItems: [...old.shoppingItems, newRow],
      };
    });
  }

  function update(next: ShoppingItemState) {
    if (next === state) return;
    const previous = state;
    const rowId = typeof crypto !== "undefined" ? crypto.randomUUID() : "";
    setState(next);
    patchCache(next, rowId);
    setError(null);
    startTransition(async () => {
      const result = await setStapleStateAction(item.ingredient_id, next, rowId);
      if (!result.ok) {
        setState(previous);
        setError(result.error);
        // Cache may be out of sync — fall back to a refetch.
        invalidate();
      }
    });
  }

  const nameStyle = chipText ? { color: `${chipText}d9` } : undefined;

  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <span className="flex-1 text-sm truncate" style={nameStyle}>
        {item.name}
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
      <StatePicker state={state} onChange={update} />
    </li>
  );
}
