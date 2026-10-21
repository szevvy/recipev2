"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { Ingredient } from "@/lib/types";
import { quickCreateIngredientAction } from "@/app/recipes/actions";

export function IngredientPicker({
  ingredients,
  value,
  onChange,
  placeholder = "Pick an ingredient…",
}: {
  ingredients: Ingredient[];
  value: string | null;
  onChange: (ing: Ingredient) => void;
  placeholder?: string;
}) {
  const selected = value ? ingredients.find((i) => i.id === value) ?? null : null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [creating, startCreate] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selected?.name ?? "");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selected?.name]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? ingredients.filter((i) => i.name.toLowerCase().includes(q))
    : ingredients;
  const exactMatch = ingredients.some((i) => i.name.toLowerCase() === q);

  function pick(ing: Ingredient) {
    onChange(ing);
    setQuery(ing.name);
    setOpen(false);
    setError(null);
  }

  function createNew() {
    const name = query.trim();
    if (!name) return;
    startCreate(async () => {
      setError(null);
      const result = await quickCreateIngredientAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      pick(result.ingredient);
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q && !exactMatch && filtered.length === 0) {
            e.preventDefault();
            createNew();
          } else if (e.key === "Enter" && filtered.length === 1) {
            e.preventDefault();
            pick(filtered[0]);
          } else if (e.key === "Escape") {
            setOpen(false);
            e.stopPropagation();
          }
        }}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] pl-2 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show ingredients"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
          inputRef.current?.focus();
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ChevronDown size={16} />
      </button>
      {open && (filtered.length > 0 || (q && !exactMatch)) && (
        <ul className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg z-20 py-1">
          {filtered.slice(0, 50).map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(i);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-soft)] text-sm"
              >
                {i.name}
              </button>
            </li>
          ))}
          {q && !exactMatch && (
            <li className="border-t border-[var(--border)]/70 mt-1 pt-1">
              <button
                type="button"
                disabled={creating}
                onMouseDown={(e) => {
                  e.preventDefault();
                  createNew();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-soft)] text-sm flex items-center gap-2 text-[var(--accent)] disabled:opacity-60"
              >
                <Plus size={14} />
                {creating ? "Creating…" : `Create "${query.trim()}"`}
              </button>
            </li>
          )}
        </ul>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
