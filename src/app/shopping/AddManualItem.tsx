"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Ingredient, ShoppingItemWithIngredient } from "@/lib/types";
import { IngredientPicker } from "@/components/IngredientPicker";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import { addManualItemAction, addOneOffItemAction } from "./actions";

export function AddManualItem({ ingredients }: { ingredients: Ingredient[] }) {
  const [library, setLibrary] = useState(ingredients);
  const [ingredientId, setIngredientId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const qtyRef = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  function submit() {
    const typed = query.trim();
    if (!typed) {
      setError("Type something to add");
      return;
    }
    const currentQty = quantity;

    // Case-insensitive match against the library — typing "GARLIC" matches "Garlic".
    const typedLower = typed.toLowerCase();
    const matched = library.find((i) => i.name.toLowerCase() === typedLower);

    const rowId = typeof crypto !== "undefined" ? crypto.randomUUID() : "";
    const trimmedQty = currentQty.trim();

    const newRow: ShoppingItemWithIngredient = {
      id: rowId,
      ingredient_id: matched?.id ?? null,
      name: matched ? null : typed,
      quantity: trimmedQty || null,
      source: "manual",
      source_ref: null,
      state: "to_buy",
      notes: null,
      unit_key: null,
      created_at: new Date().toISOString(),
      ingredients: matched
        ? { id: matched.id, name: matched.name, group_name: matched.group_name }
        : null,
      shopping_item_sources: [
        {
          id: typeof crypto !== "undefined" ? crypto.randomUUID() : "",
          shopping_item_id: rowId,
          kind: "manual",
          meal_plan_id: null,
          quantity: trimmedQty || null,
          created_at: new Date().toISOString(),
          meal_plan: null,
        },
      ],
    };

    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      return { ...old, shoppingItems: [...old.shoppingItems, newRow] };
    });
    setIngredientId(null);
    setQuery("");
    setQuantity("");
    setError(null);

    startTransition(async () => {
      const result = matched
        ? await addManualItemAction(matched.id, currentQty, rowId)
        : await addOneOffItemAction(typed, currentQty, rowId);

      if (!result.ok) {
        qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
          if (!old) return old;
          return {
            ...old,
            shoppingItems: old.shoppingItems.filter((i) => i.id !== rowId),
          };
        });
        setError(result.error);
        invalidate();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
      <div>
        <h2 className="font-serif text-xl text-[var(--foreground)]">Add something</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Pick an ingredient to merge quantities, or type anything else (a light
          bulb, batteries) to add as a one-off.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2 items-end">
        <div>
          <label className="text-xs text-[var(--muted)]">Item</label>
          <div className="mt-0.5">
            <IngredientPicker
              ingredients={library}
              value={ingredientId}
              allowCreate={false}
              onQueryChange={(q) => {
                setQuery(q);
                // If user edits after picking, drop the ingredient link so the
                // submit path treats it as a one-off (unless they re-match).
                if (
                  ingredientId &&
                  q !== library.find((i) => i.id === ingredientId)?.name
                ) {
                  setIngredientId(null);
                }
              }}
              onChange={(ing) => {
                if (!library.find((i) => i.id === ing.id)) {
                  setLibrary((prev) =>
                    [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)),
                  );
                }
                setIngredientId(ing.id);
                setQuery(ing.name);
                qtyRef.current?.focus();
              }}
              placeholder="Pick an ingredient or type anything…"
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
