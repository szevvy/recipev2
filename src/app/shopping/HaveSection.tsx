"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Home, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ShoppingItemWithIngredient } from "@/lib/types";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import { HaveRow } from "./ShoppingItemRow";
import { clearHaveItemsAction } from "./actions";

export function HaveSection({ items }: { items: ShoppingItemWithIngredient[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) =>
    (a.ingredients?.name ?? a.name ?? "").localeCompare(
      b.ingredients?.name ?? b.name ?? "",
    ),
  );

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !confirm(
        `Clear all ${items.length} already-have item${items.length === 1 ? "" : "s"}? They'll be removed from the pantry drawer entirely.`,
      )
    )
      return;
    const snapshot = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
    setError(null);
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      return {
        ...old,
        shoppingItems: old.shoppingItems.filter((i) => i.state !== "have"),
      };
    });
    startTransition(async () => {
      const result = await clearHaveItemsAction();
      if (!result.ok) {
        if (snapshot) qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, snapshot);
        else invalidate();
        setError(result.error);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 shadow-sm overflow-hidden">
      <div className="w-full flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left flex-1 min-w-0 hover:opacity-80 transition-opacity"
        >
          <Home size={16} className="text-[var(--sage)]" />
          <span className="font-serif text-base text-[var(--foreground)]">
            Already have
          </span>
          <span className="text-xs text-[var(--muted)]">({items.length})</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            title="Clear all"
            className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-600 px-2 py-1 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} />
            Clear
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            title={open ? "Collapse" : "Expand"}
            className="p-1 rounded-full hover:bg-[var(--surface-muted)]"
          >
            <ChevronDown
              size={16}
              className={
                "text-[var(--muted)] transition-transform " +
                (open ? "rotate-180" : "")
              }
            />
          </button>
        </div>
      </div>
      {error && (
        <p className="px-4 pb-2 text-xs text-red-600">{error}</p>
      )}
      {open && (
        <div className="px-4 pb-4 border-t border-[var(--border)]/60 pt-2">
          <ul className="divide-y divide-[var(--border)]/40">
            {sorted.map((item) => (
              <HaveRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
