"use client";

import { useState } from "react";
import { ChevronDown, Home } from "lucide-react";
import type { ShoppingItemWithIngredient } from "@/lib/types";
import { HaveRow } from "./ShoppingItemRow";

export function HaveSection({ items }: { items: ShoppingItemWithIngredient[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) =>
    (a.ingredients?.name ?? "").localeCompare(b.ingredients?.name ?? ""),
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[var(--surface-muted)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Home size={16} className="text-[var(--sage)]" />
          <span className="font-serif text-base text-[var(--foreground)]">
            Already have
          </span>
          <span className="text-xs text-[var(--muted)]">({items.length})</span>
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
