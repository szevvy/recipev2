"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { format, isToday, isPast } from "date-fns";
import type { MealPlanWithRecipe, Recipe } from "@/lib/types";
import { useInvalidateBootstrap } from "@/lib/queries";
import { clearMealAction, setMealAction } from "./actions";
import { RecipeModal } from "./RecipeModal";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

export function DayCard({
  date,
  meal,
  recipes,
}: {
  date: Date;
  meal: MealPlanWithRecipe | null;
  recipes: RecipeOption[];
}) {
  const [picking, setPicking] = useState(false);
  const [mealLocal, setMealLocal] = useState<MealPlanWithRecipe | null>(meal);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
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

    // If replacing an existing meal, ask whether to also remove its ingredients
    // from the shopping list. Only prompt when there's actually an old recipe
    // and we're changing to something different.
    let removeOldIngredients = false;
    if (
      previous &&
      previous.recipes &&
      previous.recipes.id !== recipeId &&
      typeof window !== "undefined"
    ) {
      removeOldIngredients = window.confirm(
        `Replace "${previous.recipes.name}" with "${recipe.name}". Also remove its ingredients from the shopping list?`,
      );
    }

    const optimistic: MealPlanWithRecipe = {
      id: previous?.id ?? `temp-${Date.now()}`,
      date: dateIso,
      recipe_id: recipeId,
      servings: previous?.servings ?? null,
      slot: null,
      shopped_at: null,
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
      const result = await setMealAction(dateIso, recipeId, undefined, removeOldIngredients);
      if (!result.ok) {
        setMealLocal(previous);
        setError(result.error);
        return;
      }
      invalidate();
    });
  }

  function clear() {
    const previous = mealLocal;
    if (!previous) return;

    const removeIngredients =
      typeof window !== "undefined"
        ? window.confirm(
            `Remove "${previous.recipes?.name ?? "this meal"}". Also remove its ingredients from the shopping list?`,
          )
        : false;

    setMealLocal(null);
    setError(null);
    startTransition(async () => {
      const result = await clearMealAction(dateIso, removeIngredients);
      if (!result.ok) {
        setMealLocal(previous);
        setError(result.error);
        return;
      }
      invalidate();
    });
  }

  return (
    <>
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
              {today && (
                <span className="ml-1 text-[var(--accent)] font-medium">· Today</span>
              )}
            </div>
          </div>
          {mealLocal && (
            <button
              onClick={clear}
              title="Remove meal"
              className="p-1 rounded-full text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {mealLocal ? (
          mealLocal.recipes?.image_url ? (
            <button
              onClick={() => setPicking(true)}
              className="group flex-1 text-left -mx-2 -mb-2 min-h-[7rem] rounded-xl overflow-hidden relative bg-cover bg-center transition-transform hover:scale-[1.01]"
              style={{ backgroundImage: `url(${mealLocal.recipes.image_url})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <div className="relative flex flex-col justify-end h-full p-2">
                <div className="font-medium text-white drop-shadow-sm truncate">
                  {mealLocal.recipes?.name ?? "(deleted recipe)"}
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => setPicking(true)}
              className="group flex-1 text-left -mx-2 -mb-2 px-2 pb-2 rounded-xl hover:bg-[var(--accent-soft)] transition-colors"
            >
              <div className="font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] truncate">
                {mealLocal.recipes?.name ?? "(deleted recipe)"}
              </div>
            </button>
          )
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

      <RecipeModal
        open={picking}
        recipes={recipes}
        selectedId={mealLocal?.recipe_id ?? null}
        onPick={assign}
        onClose={() => setPicking(false)}
      />
    </>
  );
}
