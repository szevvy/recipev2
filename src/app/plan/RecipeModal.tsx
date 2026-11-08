"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, PencilLine, Search, Users, Utensils, X } from "lucide-react";
import type { Recipe } from "@/lib/types";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

export function RecipeModal({
  open,
  recipes,
  selectedId,
  onPick,
  onCustom,
  onClose,
}: {
  open: boolean;
  recipes: RecipeOption[];
  selectedId: string | null;
  onPick: (id: string) => void;
  onCustom?: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    requestAnimationFrame(() => inputRef.current?.focus());
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[85vh] rounded-3xl bg-[var(--background)] shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 p-4 border-b border-[var(--border)]">
          <h2 className="font-serif text-xl text-[var(--foreground)]">Pick a recipe</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-4 border-b border-[var(--border)]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {filtered.length === 0 && !onCustom ? (
            <div className="text-center py-12 text-[var(--muted)]">
              No recipes match &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {onCustom && (
                <button
                  key="__custom"
                  type="button"
                  onClick={onCustom}
                  className="group rounded-2xl border border-dashed border-[var(--border)] overflow-hidden text-left transition-all bg-[var(--surface)] hover:border-[var(--accent)] hover:shadow-md"
                >
                  <div className="h-24 bg-[var(--accent-soft)]/50 flex items-center justify-center">
                    <PencilLine className="text-[var(--accent)]/70" size={24} />
                  </div>
                  <div className="p-3">
                    <h3 className="font-serif text-base text-[var(--accent)] group-hover:text-[var(--accent-hover)] line-clamp-1">
                      Custom meal
                    </h3>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      One-off title + ingredients
                    </div>
                  </div>
                </button>
              )}
              {filtered.map((r) => {
                const isSelected = r.id === selectedId;
                const totalTime =
                  r.prep_minutes != null || r.cook_minutes != null
                    ? (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)
                    : null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onPick(r.id)}
                    className={
                      "group rounded-2xl border overflow-hidden text-left transition-all bg-[var(--surface)] " +
                      (isSelected
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                        : "border-[var(--border)] hover:border-[var(--accent)] hover:shadow-md")
                    }
                  >
                    {r.image_url ? (
                      <div
                        className="h-24 bg-cover bg-center"
                        style={{ backgroundImage: `url(${r.image_url})` }}
                      />
                    ) : (
                      <div className="h-24 bg-[var(--accent-soft)] flex items-center justify-center">
                        <Utensils className="text-[var(--accent)]/50" size={24} />
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="font-serif text-base text-[var(--foreground)] group-hover:text-[var(--accent)] line-clamp-1">
                        {r.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Users size={11} />
                          {r.default_servings}
                        </span>
                        {totalTime != null && (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={11} />
                            {totalTime} min
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
