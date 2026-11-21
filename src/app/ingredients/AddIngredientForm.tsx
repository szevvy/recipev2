"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ListPicker } from "@/components/ListPicker";
import { LinkedRecipePicker } from "@/components/LinkedRecipePicker";
import { GroupCombobox } from "@/components/GroupCombobox";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import type { Ingredient, Recipe } from "@/lib/types";
import { createIngredientAction } from "./actions";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

export function AddIngredientForm({
  groupSuggestions,
  knownLists,
  recipes,
}: {
  groupSuggestions: string[];
  knownLists: string[];
  recipes: RecipeOption[];
}) {
  const [lists, setLists] = useState<string[]>([]);
  const [linkedRecipeId, setLinkedRecipeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    const groupName = String(fd.get("group_name") ?? "").trim();
    const rowId = typeof crypto !== "undefined" ? crypto.randomUUID() : "";
    fd.set("id", rowId);

    const shelfRaw = String(fd.get("shelf_life_days") ?? "").trim();
    const shelfLifeDays =
      shelfRaw && Number.isFinite(Number.parseInt(shelfRaw, 10)) &&
      Number.parseInt(shelfRaw, 10) > 0
        ? Number.parseInt(shelfRaw, 10)
        : null;

    const nowIso = new Date().toISOString();
    const newIng: Ingredient = {
      id: rowId,
      name,
      group_name: groupName || null,
      lists: [...lists].sort((a, b) => a.localeCompare(b)),
      linked_recipe_id: linkedRecipeId,
      shelf_life_days: shelfLifeDays,
      staple_state: "not_checked",
      created_at: nowIso,
      updated_at: nowIso,
    };

    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      // Keep alphabetical so the new row lands where the list renders it.
      const next = [...old.ingredients, newIng].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      return { ...old, ingredients: next };
    });

    form.reset();
    setLists([]);
    setLinkedRecipeId(null);
    setError(null);

    startTransition(async () => {
      const result = await createIngredientAction(fd);
      if (!result.ok) {
        qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
          if (!old) return old;
          return {
            ...old,
            ingredients: old.ingredients.filter((i) => i.id !== rowId),
          };
        });
        setError(result.error);
        invalidate();
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--surface)] shadow-sm space-y-3"
    >
      <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
        Add ingredient
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_auto_auto] gap-2 items-end">
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Name</span>
          <input
            name="name"
            required
            maxLength={80}
            className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--muted)]">Group</span>
          <div className="mt-0.5">
            <GroupCombobox
              name="group_name"
              suggestions={groupSuggestions}
              placeholder="e.g. Produce"
            />
          </div>
        </label>
        <ListPicker
          lists={lists}
          knownLists={knownLists}
          onToggle={(name, nowSelected) =>
            setLists((prev) =>
              nowSelected
                ? Array.from(new Set([...prev, name]))
                : prev.filter((l) => l !== name),
            )
          }
          size={22}
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] text-white text-sm px-3 py-1.5 hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={16} />
          Add
        </button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <LinkedRecipePicker
          value={linkedRecipeId}
          recipes={recipes}
          onChange={setLinkedRecipeId}
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <span>Shelf life</span>
          <input
            name="shelf_life_days"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="—"
            title="1 = use the day you buy it, 2 = that day or next, etc. Blank = no limit."
            className="w-14 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]"
          />
          <span>days</span>
        </label>
      </div>
      <input
        type="hidden"
        name="linked_recipe_id"
        value={linkedRecipeId ?? ""}
      />
      {lists.map((l) => (
        <input key={l} type="hidden" name="lists" value={l} />
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
