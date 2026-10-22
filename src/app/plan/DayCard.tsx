"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Plus, Users, X } from "lucide-react";
import { format, isToday, isPast } from "date-fns";
import type { MealPlanWithRecipe, Recipe } from "@/lib/types";
import { RecipePicker } from "@/components/RecipePicker";
import { clearMealAction, setMealAction } from "./actions";

export function DayCard({
  date,
  meal,
  recipes,
}: {
  date: Date;
  meal: MealPlanWithRecipe | null;
  recipes: Pick<Recipe, "id" | "name" | "image_url" | "default_servings">[];
}) {
  const [picking, setPicking] = useState(false);
  const [mealLocal, setMealLocal] = useState<MealPlanWithRecipe | null>(meal);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dateIso = format(date, "yyyy-MM-dd");
  const today = isToday(date);
  const past = !today && isPast(date);

  useEffect(() => {
    setMealLocal(meal);
  }, [meal]);

  function assign(recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const previous = mealLocal;
    const optimistic: MealPlanWithRecipe = {
      id: previous?.id ?? `temp-${Date.now()}`,
      date: dateIso,
      recipe_id: recipeId,
      servings: previous?.servings ?? null,
      slot: null,
      created_at: previous?.created_at ?? new Date().toISOString(),
      recipes: {
        id: recipe.id,
        name: recipe.name,
        default_servings: recipe.default_servings,
        image_url: recipe.image_url,
      },
    };
    setMealLocal(optimistic);
    setPicking(false);
    setError(null);
    startTransition(async () => {
      const result = await setMealAction(dateIso, recipeId);
      if (!result.ok) {
        setMealLocal(previous);
        setError(result.error);
      }
    });
  }

  function clear() {
    const previous = mealLocal;
    setMealLocal(null);
    setError(null);
    startTransition(async () => {
      const result = await clearMealAction(dateIso);
      if (!result.ok) {
        setMealLocal(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div
      className={
        "rounded-2xl border p-4 flex flex-col gap-2 transition-colors min-h-[8rem] " +
        (today
          ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
          : past
          ? "border-[var(--border)] bg-[var(--surface)]/60 opacity-80"
          : "border-[var(--border)] bg-[var(--surface)]")
      }
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-serif text-lg text-[var(--foreground)] leading-none">
            {format(date, "EEEE")}
          </div>
          <div className="text-xs text-[var(--muted)] mt-0.5">
            {format(date, "d MMM")}
            {today && <span className="ml-1 text-[var(--accent)] font-medium">· Today</span>}
          </div>
        </div>
        {mealLocal && !picking && (
          <button
            onClick={clear}
            title="Remove meal"
            className="p-1 rounded-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {mealLocal && !picking ? (
        <button
          onClick={() => setPicking(true)}
          className="group flex-1 text-left -mx-2 -mb-2 px-2 pb-2 rounded-xl hover:bg-[var(--accent-soft)] transition-colors"
        >
          <div className="font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] truncate">
            {mealLocal.recipes?.name ?? "(deleted recipe)"}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1 inline-flex items-center gap-1">
            <Users size={11} />
            {mealLocal.servings ?? mealLocal.recipes?.default_servings ?? "–"}
          </div>
        </button>
      ) : picking ? (
        <div className="space-y-1">
          <RecipePicker
            recipes={recipes}
            value={mealLocal?.recipe_id ?? null}
            onChange={assign}
            autoOpen
          />
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]/40 transition-colors"
        >
          <Plus size={14} /> Add meal
        </button>
      )}

      {mealLocal && mealLocal.recipes && (
        <Link
          href={`/recipes/${mealLocal.recipes.id}`}
          className="text-xs text-[var(--muted)] hover:text-[var(--accent)] self-start"
        >
          View recipe →
        </Link>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
