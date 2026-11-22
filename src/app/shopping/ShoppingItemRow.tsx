"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CalendarClock,
  ChefHat,
  Check,
  Home,
  PencilLine,
  ShoppingBasket,
  Sparkles,
  Utensils,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import type { ShoppingItemState, ShoppingItemWithIngredient } from "@/lib/types";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import {
  removeShoppingItemAction,
  setItemNotesAction,
  setItemStateAction,
} from "./actions";
import { StatePicker } from "./StatePicker";
import { usePriceChipsFor } from "@/components/PriceChips";
import { IngredientPricesDetail } from "@/components/IngredientPricesDetail";

export type RowAccent = { chipBg: string; chipText: string } | null;

export function ShoppingItemRow({
  item,
  expanded,
  onToggleExpand,
  accent,
}: {
  item: ShoppingItemWithIngredient;
  expanded: boolean;
  onToggleExpand: () => void;
  accent?: RowAccent;
}) {
  const [state, setState] = useState<ShoppingItemState>(item.state);
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  useEffect(() => {
    setState(item.state);
  }, [item.state]);

  function patchCacheState(newState: ShoppingItemState) {
    // Patch the shared bootstrap cache in place so the parent list re-filters
    // (e.g. moves this row into or out of the Already-have drawer) without a
    // full refetch. Avoids the ~300ms /api/bootstrap round-trip and SPA
    // re-render that was causing a visible scroll nudge on mobile.
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      return {
        ...old,
        shoppingItems: old.shoppingItems.map((i) =>
          i.id === item.id ? { ...i, state: newState } : i,
        ),
      };
    });
  }

  function update(next: ShoppingItemState) {
    if (next === state) return;
    const previous = state;
    setState(next);
    patchCacheState(next);
    setError(null);
    startTransition(async () => {
      const result = await setItemStateAction(item.id, next);
      if (!result.ok) {
        setState(previous);
        patchCacheState(previous);
        setError(result.error);
      }
    });
  }

  function remove() {
    const previousItems = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY)?.shoppingItems;
    setRemoved(true);
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      return {
        ...old,
        shoppingItems: old.shoppingItems.filter((i) => i.id !== item.id),
      };
    });
    startTransition(async () => {
      const result = await removeShoppingItemAction(item.id);
      if (!result.ok) {
        setRemoved(false);
        if (previousItems) {
          qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) =>
            old ? { ...old, shoppingItems: previousItems } : old,
          );
        } else {
          invalidate();
        }
        setError(result.error);
      }
    });
  }

  if (removed) return null;
  // Instant hide when the user picks 'have' or 'need_to_make' — both live in
  // the Already have drawer instead of the active list.
  if (state === "have" || state === "need_to_make") return null;

  const isBought = state === "bought";
  const isLater = state === "later";
  const dimmed = isBought || isLater;
  const notes = item.notes?.trim() ?? "";
  const buyHint = computeBuyHint(item);
  const priceChips = usePriceChipsFor(item.ingredients?.id ?? null);

  const expandedRingStyle = expanded && accent
    ? { backgroundColor: `${accent.chipBg}8f`, boxShadow: `inset 0 0 0 1px ${accent.chipText}26` }
    : undefined;
  const hoverTintClass = accent ? "" : " hover:bg-[var(--surface-muted)]";
  const nameStyle = accent ? { color: `${accent.chipText}d9` } : undefined;

  return (
    <li
      className={
        "rounded-lg transition-colors " +
        (expanded && !accent ? "bg-[var(--accent-soft)]/40 ring-1 ring-[var(--accent)]/20" : "")
      }
      style={expandedRingStyle}
    >
      <div
        className={
          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer " +
          (dimmed ? "opacity-50 " : "") +
          (expanded ? "" : hoverTintClass)
        }
        onMouseEnter={(e) => {
          if (!expanded && accent) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = `${accent.chipBg}77`;
          }
        }}
        onMouseLeave={(e) => {
          if (accent) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
          }
        }}
        onClick={(e) => {
          // Only expand/collapse when clicking the "body" area, not when a nested
          // interactive (bought check, picker chevron) was clicked.
          if ((e.target as HTMLElement).closest("button,input,textarea")) return;
          onToggleExpand();
        }}
      >
        <BoughtButton
          active={isBought}
          onClick={() => update(isBought ? "to_buy" : "bought")}
        />
        <div className="flex-1 min-w-0">
          <span
            className={"text-sm " + (isBought ? "line-through" : "")}
            style={nameStyle ?? { color: "var(--foreground)" }}
          >
            {item.quantity ? <span className="font-medium">{item.quantity} </span> : null}
            {item.ingredients?.name ?? item.name ?? "(unknown)"}
          </span>
          {buyHint && (
            <div className="text-xs italic text-amber-700 mt-0.5 truncate flex items-center gap-1">
              <CalendarClock size={10} /> {buyHint}
            </div>
          )}
          {priceChips.length > 0 && (
            <div className="mt-0.5 flex items-center gap-2 text-[10px]">
              {priceChips.map((g) => (
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
                        width={12}
                        height={12}
                        className="rounded-sm shrink-0"
                      />
                    ))}
                  </span>
                  {g.outOfStock ? (
                    <span className="line-through">OOS</span>
                  ) : (
                    <span>{g.priceLabel}</span>
                  )}
                  {g.onSale && !g.outOfStock && (
                    <span className="text-[9px] uppercase tracking-wide text-[var(--sage)]">
                      sale
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
          {notes && !expanded && (
            <div className="text-xs italic text-[var(--muted)] mt-0.5 truncate flex items-center gap-1">
              <PencilLine size={10} /> {notes}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-red-600 mr-1">{error}</span>}
        <StatePicker
          state={state}
          onChange={update}
          onRemove={remove}
          canMake={!!item.ingredients?.linked_recipe_id}
        />
      </div>
      {expanded && <ExpandedPanel item={item} />}
    </li>
  );
}

function BoughtButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Un-tick" : "Got it"}
      className={
        "inline-flex items-center justify-center h-7 w-7 rounded-full border transition-colors shrink-0 " +
        (active
          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
          : "border-[var(--border)] text-transparent hover:border-[var(--accent)] hover:text-[var(--accent)]")
      }
    >
      <Check size={14} />
    </button>
  );
}

function ExpandedPanel({ item }: { item: ShoppingItemWithIngredient }) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  useEffect(() => {
    setNotes(item.notes ?? "");
  }, [item.notes]);

  // Look up which lists this ingredient belongs to so staple-source sources
  // can be labelled "from <list>" instead of a generic "from staples".
  const bootstrap = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
  const ingredientLists: string[] = (() => {
    const id = item.ingredients?.id;
    if (!id) return [];
    const ing = bootstrap?.ingredients.find((i) => i.id === id);
    return ing?.lists ?? [];
  })();

  // For recipe-kind sources, resolve the parent shopping_item -> ingredient
  // name so the label can read "to make <parent>".
  function parentNameFor(sourceRef: string | null): string | null {
    if (!sourceRef) return null;
    const parent = bootstrap?.shoppingItems.find((i) => i.id === sourceRef);
    return parent?.ingredients?.name ?? parent?.name ?? null;
  }

  function commitNotes() {
    const nextTrim = notes.trim();
    const currentTrim = (item.notes ?? "").trim();
    if (nextTrim === currentTrim) return;
    startTransition(async () => {
      const result = await setItemNotesAction(item.id, nextTrim);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
        invalidate();
      }
    });
  }

  const sources = item.shopping_item_sources ?? [];

  return (
    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[var(--border)]/60">
      <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          Note
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          rows={2}
          placeholder="e.g. buy on Thursday"
          className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
        />
        {saved && <span className="text-xs text-[var(--sage)]">Saved.</span>}
      </label>

      <div>
        {sources.length === 0 ? (
          <p className="text-xs italic text-[var(--muted)]">
            No source info recorded for this row.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-[var(--foreground)]">
                <SourceIcon kind={s.kind} />
                <span className="font-medium">{s.quantity ?? "–"}</span>
                <span>{sourceLabel(s, ingredientLists, parentNameFor(s.source_ref))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {item.ingredients?.id && (
        <div>
          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)] block mb-1">
            Prices
          </span>
          <IngredientPricesDetail ingredientId={item.ingredients.id} />
        </div>
      )}
    </div>
  );
}

function SourceIcon({
  kind,
}: {
  kind: "meal" | "staple" | "manual" | "recipe";
}) {
  if (kind === "meal") return <Utensils size={12} className="text-[var(--muted)]" />;
  if (kind === "staple") return <Sparkles size={12} className="text-[var(--muted)]" />;
  if (kind === "recipe") return <ChefHat size={12} className="text-[var(--accent)]" />;
  return <ShoppingBasket size={12} className="text-[var(--accent)]" />;
}

function sourceLabel(
  s: ShoppingItemWithIngredient["shopping_item_sources"][number],
  ingredientLists: string[],
  parentName: string | null,
): string {
  if (s.kind === "staple") {
    if (ingredientLists.length === 0) return "from a list";
    return `from ${ingredientLists.join(", ")}`;
  }
  if (s.kind === "recipe") {
    return parentName ? `to make ${parentName}` : "to make a linked recipe";
  }
  if (s.kind === "manual") return "manually added";
  // Custom meals have no `recipes` row — their title lives on
  // meal_plan.custom_name. Fall back to that when the recipe is absent.
  const name = s.meal_plan?.recipes?.name ?? s.meal_plan?.custom_name ?? null;
  const dateIso = s.meal_plan?.date;
  const day = dateIso ? format(parseISO(dateIso), "EEE d MMM") : null;
  if (name && day) return `from ${name} (${day})`;
  if (name) return `from ${name}`;
  return "from a planned meal";
}

// Combine the item's shelf_life_days with each contributing meal's date to
// decide whether some portion needs to wait before buying. Returns a short
// hint like "Buy Thu-Fri", "Buy some later", or null when nothing's
// constrained.
function computeBuyHint(item: ShoppingItemWithIngredient): string | null {
  const shelf = item.ingredients?.shelf_life_days ?? null;
  if (!shelf || shelf < 1) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  let immediateMeals = 0;
  const seen = new Set<string>();
  let firstWindow: { start: Date; end: Date } | null = null;

  for (const s of item.shopping_item_sources) {
    if (s.kind !== "meal") continue;
    const dateStr = s.meal_plan?.date;
    if (!dateStr) continue;
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) continue;
    const mealDate = new Date(y, m - 1, d);
    const daysFromToday = Math.round((mealDate.getTime() - todayMs) / 86_400_000);
    if (daysFromToday < 0) continue;
    if (daysFromToday < shelf) {
      // Shelf life covers the gap — fine to buy today for this meal.
      immediateMeals++;
      continue;
    }
    // Needs delaying. Window: [mealDate - shelf + 1, mealDate].
    const start = new Date(mealDate);
    start.setDate(start.getDate() - shelf + 1);
    const key = `${start.getTime()}|${mealDate.getTime()}`;
    if (!seen.has(key)) {
      if (!firstWindow) firstWindow = { start, end: mealDate };
      seen.add(key);
    }
  }

  if (seen.size === 0) return null;
  const prefix = immediateMeals > 0 ? "Buy some" : "Buy";
  if (seen.size > 1 || !firstWindow) return `${prefix} later`;
  const sameDay = firstWindow.start.getTime() === firstWindow.end.getTime();
  const startLabel = format(firstWindow.start, "EEE");
  const endLabel = format(firstWindow.end, "EEE");
  const window = sameDay ? startLabel : `${startLabel}-${endLabel}`;
  return `${prefix} ${window}`;
}

export function HaveRow({ item }: { item: ShoppingItemWithIngredient }) {
  const [moving, setMoving] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();
  const isNeedToMake = item.state === "need_to_make";

  function moveToBuy() {
    setMoving(true);
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      return {
        ...old,
        shoppingItems: old.shoppingItems.map((i) =>
          i.id === item.id ? { ...i, state: "to_buy" } : i,
        ),
      };
    });
    startTransition(async () => {
      const result = await setItemStateAction(item.id, "to_buy");
      if (!result.ok) {
        setMoving(false);
        invalidate();
        setError(result.error);
      }
    });
  }

  if (moving) return null;

  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      {isNeedToMake ? (
        <ChefHat size={12} className="text-[var(--accent)] shrink-0" />
      ) : (
        <Home size={12} className="text-[var(--sage)]/70 shrink-0" />
      )}
      <span className="flex-1 truncate text-[var(--muted)]">
        {isNeedToMake && (
          <span className="text-[10px] uppercase tracking-wide text-[var(--accent)] mr-1">
            To make
          </span>
        )}
        {item.quantity ? <span>{item.quantity} </span> : null}
        {item.ingredients?.name ?? item.name ?? "(unknown)"}
      </span>
      <button
        type="button"
        onClick={moveToBuy}
        className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
      >
        {isNeedToMake ? "actually buy" : "add to list"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}
