"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Home, ShoppingBasket, X } from "lucide-react";
import type { ShoppingItemState, ShoppingItemWithIngredient } from "@/lib/types";
import { removeShoppingItemAction, setItemStateAction } from "./actions";

export function ShoppingItemRow({ item }: { item: ShoppingItemWithIngredient }) {
  const [state, setState] = useState<ShoppingItemState>(item.state);
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(item.state);
  }, [item.state]);

  function pick(next: ShoppingItemState) {
    const previous = state;
    // Clicking the current state cycles it back to default (to_buy) so the user
    // can quickly undo without hunting for the right button.
    const resolved = state === next ? "to_buy" : next;
    setState(resolved);
    setError(null);
    startTransition(async () => {
      const result = await setItemStateAction(item.id, resolved);
      if (!result.ok) {
        setState(previous);
        setError(result.error);
      }
    });
  }

  function remove() {
    setRemoved(true);
    startTransition(async () => {
      const result = await removeShoppingItemAction(item.id);
      if (!result.ok) {
        setRemoved(false);
        setError(result.error);
      }
    });
  }

  if (removed) return null;

  const isBought = state === "bought";
  const isHave = state === "have";

  const btnBase =
    "inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors shrink-0";

  return (
    <li
      className={
        "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors " +
        (isBought ? "opacity-50" : "") +
        " hover:bg-[var(--surface-muted)]"
      }
    >
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => pick("have")}
          title={isHave ? "On the list again" : "Already have"}
          className={
            btnBase +
            " " +
            (isHave
              ? "bg-[var(--sage)] text-white"
              : "text-[var(--muted)] hover:bg-[var(--sage)]/15 hover:text-[var(--sage)]")
          }
        >
          <Home size={14} />
        </button>
        <button
          type="button"
          onClick={() => pick("bought")}
          title={isBought ? "Un-tick" : "Got it"}
          className={
            btnBase +
            " " +
            (isBought
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]")
          }
        >
          <Check size={14} />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={
            "text-sm text-[var(--foreground)] " + (isBought ? "line-through" : "")
          }
        >
          {item.quantity ? <span className="font-medium">{item.quantity} </span> : null}
          {item.ingredients?.name ?? "(unknown)"}
        </span>
        {item.source !== "meal" && (
          <span
            className={
              "ml-2 text-[10px] uppercase tracking-wide " +
              (item.source === "manual" ? "text-[var(--accent)]" : "text-[var(--muted)]")
            }
          >
            {item.source === "manual" ? "added" : "staple"}
          </span>
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={remove}
        title="Remove"
        className="p-1 rounded-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <X size={14} />
      </button>
    </li>
  );
}

export function HaveRow({ item }: { item: ShoppingItemWithIngredient }) {
  const [moving, setMoving] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function moveToBuy() {
    setMoving(true);
    startTransition(async () => {
      const result = await setItemStateAction(item.id, "to_buy");
      if (!result.ok) {
        setMoving(false);
        setError(result.error);
      }
    });
  }

  if (moving) return null;

  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <ShoppingBasket size={12} className="text-[var(--muted)]/60 shrink-0" />
      <span className="flex-1 truncate text-[var(--muted)]">
        {item.quantity ? <span>{item.quantity} </span> : null}
        {item.ingredients?.name ?? "(unknown)"}
      </span>
      <button
        type="button"
        onClick={moveToBuy}
        className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
      >
        add to list
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}
