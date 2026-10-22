"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Utensils } from "lucide-react";
import type { Recipe } from "@/lib/types";

type RecipeOption = Pick<Recipe, "id" | "name" | "image_url" | "default_servings">;

export function RecipePicker({
  recipes,
  value,
  onChange,
  placeholder = "Pick a recipe…",
  autoOpen = false,
}: {
  recipes: RecipeOption[];
  value: string | null;
  onChange: (recipeId: string) => void;
  placeholder?: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = value ? recipes.find((r) => r.id === value) ?? null : null;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? recipes.filter((r) => r.name.toLowerCase().includes(q))
    : recipes;

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-sm text-left hover:border-[var(--accent)]/50"
      >
        <span className={selected ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={14} className="text-[var(--muted)] shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg z-30 overflow-hidden">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes…"
            className="w-full px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-muted)] text-sm focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                e.stopPropagation();
              } else if (e.key === "Enter" && filtered.length === 1) {
                e.preventDefault();
                pick(filtered[0].id);
              }
            }}
          />
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-[var(--muted)] text-center space-y-2">
              <Utensils size={20} className="mx-auto text-[var(--accent)]/40" />
              <p>No recipes match.</p>
              <Link
                href="/recipes/new"
                className="inline-block text-[var(--accent)] hover:underline"
              >
                Create one
              </Link>
            </div>
          ) : (
            <ul className="max-h-64 overflow-auto py-1">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r.id)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--accent-soft)]"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
