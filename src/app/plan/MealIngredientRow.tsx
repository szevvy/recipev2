"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ShoppingItemState } from "@/lib/types";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import { setItemStateAction } from "@/app/shopping/actions";
import { StatePicker } from "@/app/shopping/StatePicker";
import type { MealIngredientView } from "./mealIngredients";

export function MealIngredientRow({ view }: { view: MealIngredientView }) {
  const item = view.shoppingItem;
  const initialState: ShoppingItemState = item?.state ?? "not_checked";
  const [state, setState] = useState<ShoppingItemState>(initialState);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  function patchCacheState(newState: ShoppingItemState) {
    if (!item) return;
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
    // Nothing in the shopping list is tracking this ingredient (e.g. the user
    // marked it "have" and then removed every meal that needed it before a
    // new meal was added). Fall back to a bootstrap refetch — the server
    // sync will create/update the right row.
    if (!item) {
      invalidate();
      return;
    }
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
  const dimmed = isBought || isHave;
  const qty = view.quantity ?? "";

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
        {view.name}
      </span>
      {isHave && !isBought && (
        <span className="text-[10px] uppercase tracking-wide text-[var(--sage)] shrink-0">
          have
        </span>
      )}
      {error && <span className="text-[10px] text-red-600 mr-1">{error}</span>}
      <StatePicker state={state} onChange={update} />
      {!item && !dimmed && (
        <span
          className="text-[10px] italic text-[var(--muted)] shrink-0"
          title="Not yet in the shopping list — change state to sync it."
        >
          not synced
        </span>
      )}
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
