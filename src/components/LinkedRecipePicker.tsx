"use client";

import { useState } from "react";
import { ChefHat, X } from "lucide-react";
import type { Recipe } from "@/lib/types";
import { RecipeModal } from "@/app/plan/RecipeModal";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

// Small "Make from recipe" slot for the ingredient edit form. Clicking
// opens the existing RecipeModal (without the Custom-meal tile, since
// custom entries can't live on an ingredient) to pick the linked recipe.
export function LinkedRecipePicker({
  value,
  recipes,
  onChange,
}: {
  value: string | null;
  recipes: RecipeOption[];
  onChange: (recipeId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const linked = value ? recipes.find((r) => r.id === value) ?? null : null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-xs transition-colors " +
          (linked
            ? "bg-[var(--accent-soft)]/50 text-[var(--accent)] border-solid"
            : "text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]")
        }
        title={linked ? "Change linked recipe" : "Link a recipe"}
      >
        <ChefHat size={12} />
        <span className="truncate max-w-[12rem]">
          {linked ? linked.name : "Make from recipe"}
        </span>
      </button>
      {linked && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Unlink recipe"
          className="p-1 rounded-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <X size={12} />
        </button>
      )}
      <RecipeModal
        open={open}
        recipes={recipes}
        selectedId={value}
        onPick={(id) => {
          onChange(id);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
