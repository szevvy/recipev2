"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2, Save, X } from "lucide-react";
import type { Ingredient, RecipeWithIngredients } from "@/lib/types";
import { IngredientPicker } from "@/components/IngredientPicker";
import {
  createRecipeAction,
  deleteRecipeAction,
  updateRecipeAction,
} from "./actions";

type Row = {
  tempId: string;
  ingredient_id: string | null;
  ingredient_name: string;
  quantity: string;
  note: string;
};

function emptyRow(): Row {
  return {
    tempId: crypto.randomUUID(),
    ingredient_id: null,
    ingredient_name: "",
    quantity: "",
    note: "",
  };
}

function rowsFromRecipe(recipe: RecipeWithIngredients | null): Row[] {
  const existing = recipe
    ? [...recipe.recipe_ingredients]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((ri) => ({
          tempId: crypto.randomUUID(),
          ingredient_id: ri.ingredient_id,
          ingredient_name: ri.ingredients?.name ?? "",
          quantity: ri.quantity ?? "",
          note: ri.note ?? "",
        }))
    : [];
  return [...existing, emptyRow()];
}

function withTrailingEmpty(rows: Row[]): Row[] {
  const last = rows[rows.length - 1];
  if (!last || last.ingredient_name.trim()) return [...rows, emptyRow()];
  return rows;
}

export function RecipeEditor({
  recipe,
  initialIngredients,
  returnUrl = "/recipes",
}: {
  recipe: RecipeWithIngredients | null;
  initialIngredients: Ingredient[];
  returnUrl?: string;
}) {
  const router = useRouter();
  const [ingredientsLibrary, setIngredientsLibrary] = useState(initialIngredients);
  const [name, setName] = useState(recipe?.name ?? "");
  const [servings, setServings] = useState(String(recipe?.default_servings ?? 4));
  const [prepMinutes, setPrepMinutes] = useState(
    recipe?.prep_minutes != null ? String(recipe.prep_minutes) : "",
  );
  const [cookMinutes, setCookMinutes] = useState(
    recipe?.cook_minutes != null ? String(recipe.cook_minutes) : "",
  );
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? "");
  const [imageUrl, setImageUrl] = useState(recipe?.image_url ?? "");
  const [instructions, setInstructions] = useState(recipe?.instructions ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(() => rowsFromRecipe(recipe));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function pickRowIngredient(idx: number, ing: Ingredient) {
    if (!ingredientsLibrary.find((i) => i.id === ing.id)) {
      setIngredientsLibrary((prev) => [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setRows((prev) => {
      const next = prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              ingredient_id: ing.id,
              ingredient_name: ing.name,
            }
          : r,
      );
      return withTrailingEmpty(next);
    });
  }

  function removeRow(idx: number) {
    setRows((prev) => withTrailingEmpty(prev.filter((_, i) => i !== idx)));
  }

  function onSave() {
    setError(null);
    const servingsNum = Number(servings);
    const prepNum = prepMinutes ? Number(prepMinutes) : null;
    const cookNum = cookMinutes ? Number(cookMinutes) : null;

    const ingredientPayload = rows
      .filter((r) => r.ingredient_name.trim())
      .map((r) => ({
        ingredient_id: r.ingredient_id,
        ingredient_name: r.ingredient_name.trim(),
        quantity: r.quantity.trim() || null,
        note: r.note.trim() || null,
      }));

    const payload = {
      name: name.trim(),
      default_servings: servingsNum,
      prep_minutes: prepNum,
      cook_minutes: cookNum,
      source_url: sourceUrl.trim() || null,
      image_url: imageUrl.trim() || null,
      instructions: instructions.trim() || null,
      notes: notes.trim() || null,
      ingredients: ingredientPayload,
    };

    startTransition(async () => {
      if (recipe) {
        const result = await updateRecipeAction(recipe.id, payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      } else {
        const result = await createRecipeAction(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      router.push(returnUrl);
    });
  }

  function onDelete() {
    if (!recipe) return;
    if (!confirm(`Delete "${recipe.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteRecipeAction(recipe.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/recipes");
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Recipe name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spaghetti bolognese"
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
            required
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Servings</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Prep (min)</span>
            <input
              type="number"
              min="0"
              value={prepMinutes}
              onChange={(e) => setPrepMinutes(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Cook (min)</span>
            <input
              type="number"
              min="0"
              value={cookMinutes}
              onChange={(e) => setCookMinutes(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Source URL</span>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Image URL</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
        <h2 className="font-serif text-xl text-[var(--foreground)]">Ingredients</h2>
        <ul className="space-y-2">
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            const isEmpty = !row.ingredient_name.trim();
            return (
              <li
                key={row.tempId}
                className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr_auto] gap-2 items-start"
              >
                <IngredientPicker
                  ingredients={ingredientsLibrary}
                  value={row.ingredient_id}
                  onChange={(ing) => pickRowIngredient(idx, ing)}
                  placeholder={isLast ? "Add ingredient…" : "Pick an ingredient…"}
                />
                <input
                  value={row.quantity}
                  onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                  placeholder="500g, 1 1/2 cups…"
                  maxLength={50}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
                />
                <input
                  value={row.note}
                  onChange={(e) => updateRow(idx, { note: e.target.value })}
                  placeholder="note (optional)"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
                />
                {isLast && isEmpty ? (
                  <span className="w-7" />
                ) : (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    title="Remove row"
                    className="p-1.5 rounded-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors self-center"
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Instructions</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={10}
            placeholder={"1. …\n2. …"}
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] font-serif leading-relaxed"
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Variations, substitutions, who liked it, …"
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          />
        </label>
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        {recipe ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-full border border-red-200 text-red-600 text-sm px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete recipe
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-4 py-2 disabled:opacity-60 hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Save size={14} /> {pending ? "Saving…" : recipe ? "Save changes" : "Create recipe"}
        </button>
      </div>
    </div>
  );
}
