"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ShoppingItemState, ShoppingItemWithIngredient } from "@/lib/types";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import { setItemStateAction } from "@/app/shopping/actions";
import { StatePicker } from "@/app/shopping/StatePicker";

export function MealIngredientRow({
  item,
  displayQuantity,
}: {
  item: ShoppingItemWithIngredient;
  // Per-meal contribution from shopping_item_sources — what this meal
  // contributes, not the aggregated total. Falls back to item.quantity.
  displayQuantity: string | null;
}) {
  const [state, setState] = useState<ShoppingItemState>(item.state);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  useEffect(() => {
    setState(item.state);
  }, [item.state]);

  function patchCacheState(newState: ShoppingItemState) {
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
        invalidate();
      }
    });
  }

  const isBought = state === "bought";
  const isHave = state === "have";
  const name = item.ingredients?.name ?? item.name ?? "(unknown)";
  // Prefer per-meal contribution; some items (e.g. unique free-text) have none
  // on their sources — fall back to the aggregated item quantity.
  const qty = (displayQuantity ?? item.quantity) ?? "";

  return (
    <li className="flex items-center gap-2 px-1 py-1">
      <BoughtButton
        active={isBought}
        onClick={() => update(isBought ? "to_buy" : "bought")}
      />
      <span
        className={
          "flex-1 text-sm min-w-0 truncate " +
          (isBought
            ? "line-through text-[var(--muted)]"
            : isHave
            ? "text-[var(--muted)]"
            : "text-[var(--foreground)]")
        }
      >
        {qty ? <span className="font-medium">{qty} </span> : null}
        {name}
      </span>
      {error && <span className="text-[10px] text-red-600 mr-1">{error}</span>}
      <StatePicker state={state} onChange={update} />
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
        "inline-flex items-center justify-center h-6 w-6 rounded-full border transition-colors shrink-0 " +
        (active
          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
          : "border-[var(--border)] text-transparent hover:border-[var(--accent)] hover:text-[var(--accent)]")
      }
    >
      <Check size={12} />
    </button>
  );
}
