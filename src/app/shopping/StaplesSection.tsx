"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { ShoppingItemState, ShoppingItemWithIngredient } from "@/lib/types";
import { setItemStateAction } from "./actions";
import { StatePicker } from "./ShoppingItemRow";

export function StaplesSection({ staples }: { staples: ShoppingItemWithIngredient[] }) {
  const [open, setOpen] = useState(false);
  if (staples.length === 0) return null;

  const sorted = [...staples].sort((a, b) =>
    (a.ingredients?.name ?? "").localeCompare(b.ingredients?.name ?? ""),
  );

  const notCheckedCount = staples.filter((s) => s.state === "not_checked").length;
  const toBuyCount = staples.filter((s) => s.state === "to_buy").length;
  const haveCount = staples.filter((s) => s.state === "have").length;

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
            {notCheckedCount > 0 && <span>{notCheckedCount} to review</span>}
            {notCheckedCount > 0 && (toBuyCount > 0 || haveCount > 0) && <span> · </span>}
            {toBuyCount > 0 && (
              <span className="text-[var(--accent)]">{toBuyCount} to buy</span>
            )}
            {toBuyCount > 0 && haveCount > 0 && <span> · </span>}
            {haveCount > 0 && <span className="text-[var(--sage)]">{haveCount} have</span>}
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
        <div className="px-3 pb-3 border-t border-[var(--border)]/60 pt-2">
          <ul className="divide-y divide-[var(--border)]/40">
            {sorted.map((item) => (
              <StapleRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StapleRow({ item }: { item: ShoppingItemWithIngredient }) {
  const [state, setState] = useState<ShoppingItemState>(item.state);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(item.state);
  }, [item.state]);

  function update(next: ShoppingItemState) {
    if (next === state) return;
    const previous = state;
    setState(next);
    setError(null);
    startTransition(async () => {
      const result = await setItemStateAction(item.id, next);
      if (!result.ok) {
        setState(previous);
        setError(result.error);
      }
    });
  }

  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <span className="flex-1 text-sm text-[var(--foreground)] truncate">
        {item.ingredients?.name ?? "(unknown)"}
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
      <StatePicker state={state} onChange={update} />
    </li>
  );
}
