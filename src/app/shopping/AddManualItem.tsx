"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import type { Ingredient } from "@/lib/types";
import { IngredientPicker } from "@/components/IngredientPicker";
import { addManualItemAction } from "./actions";

export function AddManualItem({ ingredients }: { ingredients: Ingredient[] }) {
  const [library, setLibrary] = useState(ingredients);
  const [ingredientId, setIngredientId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const qtyRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (!ingredientId) {
      setError("Pick an ingredient");
      return;
    }
    setError(null);
    const currentIngredient = ingredientId;
    const currentQty = quantity;
    startTransition(async () => {
      const result = await addManualItemAction(currentIngredient, currentQty);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIngredientId(null);
      setQuantity("");
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
      <h2 className="font-serif text-xl text-[var(--foreground)]">Add something</h2>
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2 items-end">
        <div>
          <label className="text-xs text-[var(--muted)]">Ingredient</label>
          <div className="mt-0.5">
            <IngredientPicker
              ingredients={library}
              value={ingredientId}
              onChange={(ing) => {
                if (!library.find((i) => i.id === ing.id)) {
                  setLibrary((prev) =>
                    [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)),
                  );
                }
                setIngredientId(ing.id);
                qtyRef.current?.focus();
              }}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]">Quantity</label>
          <input
            ref={qtyRef}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 2, 500g (optional)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-3 py-1.5 disabled:opacity-60 hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={16} /> Add
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
