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
import { setStapleStateAction } from "@/app/shopping/actions";
import { StatePicker } from "@/app/shopping/StatePicker";
import { QuantityPickerModal } from "./QuantityPickerModal";

export type ListMemberView = {
  ingredient_id: string;
  name: string;
  group_name: string | null;
  state: ShoppingItemState;
  last_purchased_at: string | null;
  linked_recipe_id: string | null;
  // Quantity currently on the shopping list from non-staple sources (meal,
  // manual, recipe). Null when nothing else needs it. Shown as "1 already
  // on list" so the user doesn't flag the same thing twice.
  on_list_quantity: string | null;
};

// Terse "last bought" badge. Keeps the row scannable:
//   today · yest · 3d · 2w · 3mo · 1y
function formatLastPurchased(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yest";
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  return `${years}y`;
}

const UNGROUPED = "__ungrouped__";

// One collapsible card per user-defined ingredient list (Staples, Dessert,
// Camping, etc.). Members render grouped by shopping category with a shared
// state picker — toggling to_buy/have creates the backing shopping_items row.
export function ListSection({
  listName,
  members,
  categoryMeta,
  defaultOpen = false,
}: {
  listName: string;
  members: ListMemberView[];
  categoryMeta: CategoryMetaRow[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (members.length === 0) return null;

  const notReviewed = members.filter((m) => m.state === "not_checked").length;
  const toBuy = members.filter((m) => m.state === "to_buy").length;
  const have = members.filter((m) => m.state === "have").length;

  const metaByName = new Map<string, CategoryMetaRow>();
  for (const m of categoryMeta) metaByName.set(m.name, m);

  const byGroup = new Map<string, ListMemberView[]>();
  for (const m of members) {
    const key = m.group_name ?? UNGROUPED;
    const bucket = byGroup.get(key) ?? [];
    bucket.push(m);
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
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={
          "w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[var(--surface-muted)] transition-colors " +
          (open ? "rounded-t-2xl" : "rounded-2xl")
        }
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <span className="font-serif text-base text-[var(--foreground)]">
              {listName}
            </span>
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
                    <ListMemberRow
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

function ListMemberRow({
  item,
  chipText,
}: {
  item: ListMemberView;
  chipText: string | null;
}) {
  const [state, setState] = useState<ShoppingItemState>(item.state);
  const [quantityModalOpen, setQuantityModalOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  useEffect(() => {
    setState(item.state);
  }, [item.state]);

  function patchCache(next: ShoppingItemState, rowId: string, qty: string | null) {
    // Mirror the server's insert/update/delete on the bootstrap cache so
    // every list + the shopping list re-derive instantly without a refetch.
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      const existing = old.shoppingItems.find(
        (i) =>
          i.ingredient_id === item.ingredient_id &&
          i.unit_key == null &&
          (i.source === "staple" || i.state === "not_checked" || i.state === "to_buy" ||
            i.state === "have" || i.state === "later" || i.state === "need_to_make"),
      );
      if (next === "not_checked") {
        if (!existing) return old;
        if (existing.source === "staple") {
          return {
            ...old,
            shoppingItems: old.shoppingItems.filter((i) => i.id !== existing.id),
          };
        }
        // Non-staple primary — leave the row, just drop its state back if it
        // was need_to_make.
        return {
          ...old,
          shoppingItems: old.shoppingItems.map((i) =>
            i.id === existing.id && i.state === "need_to_make"
              ? { ...i, state: "to_buy" as const }
              : i,
          ),
        };
      }
      if (existing) {
        return {
          ...old,
          shoppingItems: old.shoppingItems.map((i) =>
            i.id === existing.id
              ? { ...i, state: next, quantity: qty ?? i.quantity }
              : i,
          ),
        };
      }
      const ingredient = old.ingredients.find((i) => i.id === item.ingredient_id);
      const newRow: ShoppingItemWithIngredient = {
        id: rowId,
        ingredient_id: item.ingredient_id,
        name: null,
        quantity: qty,
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
              linked_recipe_id: ingredient.linked_recipe_id,
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

  function update(next: ShoppingItemState, qty: string | null = null) {
    if (next === state && !qty) return;
    const previous = state;
    const rowId = typeof crypto !== "undefined" ? crypto.randomUUID() : "";
    setState(next);
    patchCache(next, rowId, qty);
    setError(null);
    startTransition(async () => {
      const result = await setStapleStateAction(
        item.ingredient_id,
        next,
        rowId,
        qty,
      );
      if (!result.ok) {
        setState(previous);
        setError(result.error);
        // Cache may be out of sync — fall back to a refetch.
        invalidate();
      }
    });
  }

  // Have / bought rows are muted — the user has already made a decision.
  // Later doesn't exist in the list variant.
  const dimmed = state === "have" || state === "bought";
  const nameStyle = chipText
    ? { color: `${chipText}${dimmed ? "80" : "d9"}` }
    : dimmed
    ? { color: "var(--muted)" }
    : undefined;
  const ageStyle = chipText ? { color: `${chipText}99` } : undefined;
  const lastBought = item.last_purchased_at
    ? formatLastPurchased(item.last_purchased_at)
    : null;

  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <span
        className={
          "flex-1 text-sm truncate " + (state === "bought" ? "line-through" : "")
        }
        style={nameStyle}
      >
        {item.name}
        {item.on_list_quantity && (
          <span className="ml-1.5 text-[10px] italic text-[var(--muted)]">
            {item.on_list_quantity} already on list
          </span>
        )}
      </span>
      {lastBought && (
        <span
          className="text-[10px] tabular-nums text-[var(--muted)] shrink-0"
          style={ageStyle}
          title={`Last bought ${new Date(item.last_purchased_at!).toLocaleDateString()}`}
        >
          {lastBought}
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
      <StatePicker
        state={state}
        onChange={(next) => update(next)}
        canMake={!!item.linked_recipe_id}
        variant="list"
        onNeedMore={() => setQuantityModalOpen(true)}
      />
      <QuantityPickerModal
        open={quantityModalOpen}
        itemName={item.name}
        defaultQuantity={2}
        onPick={(n) => {
          setQuantityModalOpen(false);
          update("to_buy", String(n));
        }}
        onClose={() => setQuantityModalOpen(false)}
      />
    </li>
  );
}
