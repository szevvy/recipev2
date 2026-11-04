"use client";

import { useMemo } from "react";
import type { BootstrapData } from "@/lib/queries";
import type { Ingredient } from "@/lib/types";
import { AddIngredientForm } from "@/app/ingredients/AddIngredientForm";
import { IngredientRow } from "@/app/ingredients/IngredientRow";

const UNGROUPED_KEY = "__ungrouped__";
const UNGROUPED_LABEL = "Ungrouped";

export function IngredientsTab({ data }: { data: BootstrapData }) {
  const ingredients = data.ingredients as Ingredient[];

  const { groupKeys, byGroup, groupSuggestions } = useMemo(() => {
    const byGroup = new Map<string, Ingredient[]>();
    for (const ing of ingredients) {
      const key = ing.group_name ?? UNGROUPED_KEY;
      const bucket = byGroup.get(key) ?? [];
      bucket.push(ing);
      byGroup.set(key, bucket);
    }

    const groupKeys = Array.from(byGroup.keys())
      .filter((k) => k !== UNGROUPED_KEY)
      .sort((a, b) => a.localeCompare(b));
    if (byGroup.has(UNGROUPED_KEY)) groupKeys.push(UNGROUPED_KEY);

    const groupSuggestions = Array.from(byGroup.keys())
      .filter((k) => k !== UNGROUPED_KEY)
      .sort();

    return { byGroup, groupKeys, groupSuggestions };
  }, [ingredients]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">Ingredients</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          The star marks staples. Groups come from whatever you type in the Group field.
        </p>
      </div>

      <AddIngredientForm groupSuggestions={groupSuggestions} />

      {ingredients.length === 0 ? (
        <p className="text-[var(--muted)] text-sm italic text-center py-10">
          Nothing in the pantry yet. Add your first ingredient above.
        </p>
      ) : (
        <div className="space-y-6">
          {groupKeys.map((key) => {
            const label = key === UNGROUPED_KEY ? UNGROUPED_LABEL : key;
            const items = byGroup.get(key) ?? [];
            return (
              <section key={key} className="space-y-2">
                <h3 className="font-serif text-lg text-[var(--accent)] px-1">
                  {label}
                  <span className="ml-2 text-sm font-sans text-[var(--muted)] font-normal">
                    ({items.length})
                  </span>
                </h3>
                <ul className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm divide-y divide-[var(--border)]/70 p-1">
                  {items.map((ing) => (
                    <IngredientRow
                      key={ing.id}
                      ingredient={ing}
                      groupSuggestions={groupSuggestions}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
