"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { IngredientPicker } from "@/components/IngredientPicker";
import type {
  Ingredient,
  MealPlanCustomIngredientWithLink,
} from "@/lib/types";
import type { CustomMealIngredientInput } from "./actions";

type RowDraft = {
  key: string;
  ingredientId: string | null;
  query: string;
  quantity: string;
};

function newBlankRow(): RowDraft {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    ingredientId: null,
    query: "",
    quantity: "",
  };
}

export function CustomMealModal({
  open,
  ingredients,
  initialName,
  initialIngredients,
  onSave,
  onClose,
}: {
  open: boolean;
  ingredients: Ingredient[];
  initialName: string;
  initialIngredients: MealPlanCustomIngredientWithLink[];
  onSave: (name: string, rows: CustomMealIngredientInput[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<RowDraft[]>(() => buildInitialRows(initialIngredients));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Re-seed when opened fresh (or switching between edit targets).
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setRows(buildInitialRows(initialIngredients));
    setError(null);
    requestAnimationFrame(() => nameRef.current?.focus());
  }, [open, initialName, initialIngredients]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const libraryByLower = useMemo(() => {
    const m = new Map<string, Ingredient>();
    for (const i of ingredients) m.set(i.name.toLowerCase(), i);
    return m;
  }, [ingredients]);

  if (!open) return null;

  function updateRow(key: string, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? [newBlankRow()] : prev.filter((r) => r.key !== key)));
  }
  function addRow() {
    setRows((prev) => [...prev, newBlankRow()]);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give it a name");
      nameRef.current?.focus();
      return;
    }
    const cleaned: CustomMealIngredientInput[] = [];
    for (const r of rows) {
      const q = r.query.trim();
      const qty = r.quantity.trim();
      if (!q) continue;
      // Prefer a library match on the typed text even if the user hasn't
      // explicitly picked — matches the AddManualItem behaviour.
      const matched = libraryByLower.get(q.toLowerCase());
      cleaned.push({
        ingredient_id: matched?.id ?? r.ingredientId ?? null,
        name: matched ? null : q,
        quantity: qty || null,
      });
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed, cleaned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] rounded-3xl bg-[var(--background)] shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 p-4 border-b border-[var(--border)]">
          <h2 className="font-serif text-xl text-[var(--foreground)]">Custom meal</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Title</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="e.g. Fridge-clean fried rice"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[var(--muted)] uppercase tracking-wide">
                Ingredients
              </span>
              <span className="text-[10px] text-[var(--muted)] italic">
                Library match or typed one-off
              </span>
            </div>
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 items-start"
                >
                  <IngredientPicker
                    ingredients={ingredients}
                    value={row.ingredientId}
                    allowCreate={false}
                    onQueryChange={(q) => {
                      // Keep ingredientId linked only while the text matches
                      // the picked ingredient — otherwise treat as free-text.
                      updateRow(row.key, {
                        query: q,
                        ingredientId:
                          row.ingredientId &&
                          q === ingredients.find((i) => i.id === row.ingredientId)?.name
                            ? row.ingredientId
                            : null,
                      });
                    }}
                    onChange={(ing) => {
                      updateRow(row.key, { ingredientId: ing.id, query: ing.name });
                    }}
                    placeholder="Pick or type an ingredient…"
                  />
                  <input
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                    placeholder="qty"
                    className="w-24 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    title="Remove"
                    className="p-2 rounded-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              <Plus size={14} /> Add ingredient
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm px-4 py-1.5 hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-4 py-1.5 disabled:opacity-60 hover:bg-[var(--accent-hover)] transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function buildInitialRows(
  initial: MealPlanCustomIngredientWithLink[],
): RowDraft[] {
  if (!initial || initial.length === 0) return [newBlankRow()];
  return [...initial]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ci) => ({
      key: ci.id,
      ingredientId: ci.ingredient_id,
      query: ci.ingredients?.name ?? ci.name ?? "",
      quantity: ci.quantity ?? "",
    }));
}
