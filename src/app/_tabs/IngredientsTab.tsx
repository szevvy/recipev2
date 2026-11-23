"use client";

import { useMemo } from "react";
import { paletteColor } from "@/lib/category-palette";
import type { BootstrapData } from "@/lib/queries";
import type { CategoryMetaRow, Ingredient, Recipe } from "@/lib/types";
import { AddIngredientForm } from "@/app/ingredients/AddIngredientForm";
import { IngredientRow } from "@/app/ingredients/IngredientRow";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

const UNGROUPED_KEY = "__ungrouped__";
const UNGROUPED_LABEL = "Ungrouped";

export function IngredientsTab({ data }: { data: BootstrapData }) {
  const ingredients = data.ingredients as Ingredient[];
  const recipes = data.recipes as RecipeOption[];
  const categoryMeta = data.categoryMeta as CategoryMetaRow[];

  const { groupKeys, byGroup, groupSuggestions, knownLists, metaByName } = useMemo(() => {
    const byGroup = new Map<string, Ingredient[]>();
    const listSet = new Set<string>();
    for (const ing of ingredients) {
      const key = ing.group_name ?? UNGROUPED_KEY;
      const bucket = byGroup.get(key) ?? [];
      bucket.push(ing);
      byGroup.set(key, bucket);
      for (const l of ing.lists) listSet.add(l);
    }
    for (const bucket of byGroup.values()) {
      bucket.sort((a, b) => a.name.localeCompare(b.name));
    }

    const metaByName = new Map<string, CategoryMetaRow>();
    for (const m of categoryMeta) metaByName.set(m.name, m);

    // Mirror shopping-list ordering: sort_order from category_meta first,
    // ungrouped last.
    const groupKeys = Array.from(byGroup.keys()).sort((a, b) => {
      if (a === UNGROUPED_KEY) return 1;
      if (b === UNGROUPED_KEY) return -1;
      const sa = metaByName.get(a)?.sort_order ?? 1_000_000;
      const sb = metaByName.get(b)?.sort_order ?? 1_000_000;
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    });

    const groupSuggestions = Array.from(byGroup.keys())
      .filter((k) => k !== UNGROUPED_KEY)
      .sort();

    const knownLists = Array.from(listSet).sort((a, b) => a.localeCompare(b));
    if (!listSet.has("Staples")) knownLists.unshift("Staples");

    return { byGroup, groupKeys, groupSuggestions, knownLists, metaByName };
  }, [ingredients, categoryMeta]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">Ingredients</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          The star picks which lists an ingredient belongs to — Staples, or
          any ad-hoc list you want. Groups come from the Group field.
        </p>
      </div>

      <AddIngredientForm
        groupSuggestions={groupSuggestions}
        knownLists={knownLists}
        recipes={recipes}
      />

      {ingredients.length === 0 ? (
        <p className="text-[var(--muted)] text-sm italic text-center py-10">
          Nothing in the pantry yet. Add your first ingredient above.
        </p>
      ) : (
        <div className="space-y-5">
          {groupKeys.map((key) => {
            const label = key === UNGROUPED_KEY ? UNGROUPED_LABEL : key;
            const items = byGroup.get(key) ?? [];
            const color = paletteColor(metaByName.get(key)?.color ?? null);
            const headerStyle = color
              ? { backgroundColor: color.chipBg, color: color.chipText }
              : undefined;
            const ulStyle = color
              ? { backgroundColor: `${color.chipBg}47`, borderColor: `${color.chipText}12` }
              : undefined;
            const divideBorder = color ? `${color.chipText}12` : undefined;
            return (
              <section key={key} className="space-y-1">
                <h3
                  className={
                    "inline-flex items-center font-serif text-sm uppercase tracking-wide px-2.5 py-0.5 rounded-full " +
                    (color ? "" : "text-[var(--accent)]")
                  }
                  style={headerStyle}
                >
                  {label}
                  <span
                    className="ml-2 text-xs font-sans normal-case font-normal opacity-70"
                    style={color ? { color: color.chipText } : undefined}
                  >
                    ({items.length})
                  </span>
                </h3>
                <ul
                  className={
                    "rounded-xl p-1 border " +
                    (color
                      ? ""
                      : "bg-[var(--surface-muted)]/60 border-transparent divide-y divide-[var(--border)]/60")
                  }
                  style={ulStyle}
                >
                  {items.map((ing, idx) => (
                    <div
                      key={ing.id}
                      style={
                        color && idx > 0
                          ? { borderTop: `1px solid ${divideBorder}` }
                          : undefined
                      }
                    >
                      <IngredientRow
                        ingredient={ing}
                        groupSuggestions={groupSuggestions}
                        knownLists={knownLists}
                        recipes={recipes}
                        accent={
                          color
                            ? { chipBg: color.chipBg, chipText: color.chipText }
                            : null
                        }
                      />
                    </div>
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
