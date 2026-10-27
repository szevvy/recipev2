"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import type { ShoppingItemWithIngredient } from "@/lib/types";
import { removeShoppingItemAction, toggleBoughtAction } from "./actions";

export function ShoppingItemRow({ item }: { item: ShoppingItemWithIngredient }) {
  const [bought, setBought] = useState(item.bought);
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !bought;
    setBought(next);
    setError(null);
    startTransition(async () => {
      const result = await toggleBoughtAction(item.id, next);
      if (!result.ok) {
        setBought(!next);
        setError(result.error);
      }
    });
  }

  function remove() {
    setRemoved(true);
    setError(null);
    startTransition(async () => {
      const result = await removeShoppingItemAction(item.id);
      if (!result.ok) {
        setRemoved(false);
        setError(result.error);
      }
    });
  }

  if (removed) return null;

  return (
    <li
      className={
        "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors " +
        (bought
          ? "opacity-50 hover:bg-[var(--surface-muted)]"
          : "hover:bg-[var(--surface-muted)]")
      }
    >
      <button
        type="button"
        onClick={toggle}
        title={bought ? "Mark not bought" : "Mark bought"}
        className={
          "inline-flex items-center justify-center h-6 w-6 rounded-full border transition-colors shrink-0 " +
          (bought
            ? "bg-[var(--sage)] border-[var(--sage)] text-white"
            : "border-[var(--border)] text-transparent hover:border-[var(--accent)] hover:text-[var(--accent)]")
        }
      >
        <Check size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <span
          className={
            "text-sm text-[var(--foreground)] " + (bought ? "line-through" : "")
          }
        >
          {item.quantity ? <span className="font-medium">{item.quantity} </span> : null}
          {item.ingredients?.name ?? "(unknown)"}
        </span>
        {item.source === "manual" && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
            manual
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
