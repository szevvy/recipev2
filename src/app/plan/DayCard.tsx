"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, PencilLine, Plus, X } from "lucide-react";
import { format, isToday, isPast } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Ingredient,
  MealPlanWithRecipe,
  Recipe,
  ShoppingItemWithIngredient,
} from "@/lib/types";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import {
  clearMealAction,
  setCustomMealAction,
  setMealAction,
  type CustomMealIngredientInput,
} from "./actions";
import { RecipeModal } from "./RecipeModal";
import { CustomMealModal } from "./CustomMealModal";
import { MealIngredientRow } from "./MealIngredientRow";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

export function DayCard({
  date,
  meal,
  recipes,
  ingredients,
  mealItems,
}: {
  date: Date;
  meal: MealPlanWithRecipe | null;
  recipes: RecipeOption[];
  ingredients: Ingredient[];
  // Shopping items contributed to by this meal (via shopping_item_sources).
  // Used to render the per-meal ingredient list with state pickers.
  mealItems: ShoppingItemWithIngredient[];
}) {
  const [picking, setPicking] = useState(false);
  const [editingCustom, setEditingCustom] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mealLocal, setMealLocal] = useState<MealPlanWithRecipe | null>(meal);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();
  const dateIso = format(date, "yyyy-MM-dd");
  const today = isToday(date);
  const past = !today && isPast(date);
  const isCustom = !!mealLocal && !mealLocal.recipes && !!mealLocal.custom_name;

  useEffect(() => {
    setMealLocal(meal);
  }, [meal]);

  // Patch every plan week cache + bootstrap.meals so the day card re-renders
  // from cached data instantly, without a bootstrap refetch (that round-trip
  // was causing a visible beat + scroll nudge on mobile).
  function patchMealCaches(nextMeal: MealPlanWithRecipe | null) {
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      const filtered = old.meals.filter((m) => m.date !== dateIso);
      return {
        ...old,
        meals: nextMeal ? [...filtered, nextMeal] : filtered,
      };
    });
    qc.setQueriesData<MealPlanWithRecipe[]>({ queryKey: ["plan"] }, (old) => {
      if (!old) return old;
      const filtered = old.filter((m) => m.date !== dateIso);
      return nextMeal ? [...filtered, nextMeal] : filtered;
    });
  }

  function assign(recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const previous = mealLocal;

    // If replacing an existing meal with a *different* recipe, offer to also
    // remove its ingredients from the shopping list. Custom → recipe swap
    // doesn't prompt — its library items will re-sync and free-text items
    // get cleared server-side anyway.
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
      custom_name: null,
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
      meal_plan_custom_ingredients: [],
    };
    setMealLocal(optimistic);
    patchMealCaches(optimistic);
    setPicking(false);
    setError(null);
    startTransition(async () => {
      const result = await setMealAction(dateIso, recipeId, undefined, removeOldIngredients);
      if (!result.ok) {
        setMealLocal(previous);
        patchMealCaches(previous);
        setError(result.error);
        return;
      }
      // Shopping list items change server-side (sync + orphan cleanup), so
      // refresh bootstrap when we touched the shopping side too. Also when
      // the old meal was a custom one, since its free-text shopping items
      // were cleared.
      if (removeOldIngredients || (previous && !previous.recipes)) invalidate();
    });
  }

  async function saveCustom(
    name: string,
    rows: CustomMealIngredientInput[],
  ): Promise<void> {
    const previous = mealLocal;
    // Optimistic: build a local meal-with-custom-ingredients view.
    const optimistic: MealPlanWithRecipe = {
      id: previous?.id ?? `temp-${Date.now()}`,
      date: dateIso,
      recipe_id: null,
      custom_name: name,
      servings: null,
      slot: null,
      shopped_at: null,
      created_at: previous?.created_at ?? new Date().toISOString(),
      recipes: null,
      meal_plan_custom_ingredients: rows.map((r, idx) => {
        const linked = r.ingredient_id
          ? ingredients.find((i) => i.id === r.ingredient_id) ?? null
          : null;
        return {
          id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(idx),
          meal_plan_id: previous?.id ?? "",
          ingredient_id: r.ingredient_id,
          name: r.name,
          quantity: r.quantity,
          sort_order: idx,
          ingredients: linked
            ? { id: linked.id, name: linked.name, group_name: linked.group_name }
            : null,
        };
      }),
    };
    setMealLocal(optimistic);
    patchMealCaches(optimistic);
    setEditingCustom(false);
    setError(null);
    const result = await setCustomMealAction(dateIso, name, rows);
    if (!result.ok) {
      setMealLocal(previous);
      patchMealCaches(previous);
      setError(result.error);
      // Surface error inside modal by re-opening.
      setEditingCustom(true);
      throw new Error(result.error);
    }
    // Shopping items were just added server-side — refresh bootstrap so the
    // list picks them up.
    invalidate();
  }

  function clear() {
    const previous = mealLocal;
    if (!previous) return;

    const label =
      previous.recipes?.name ?? previous.custom_name ?? "this meal";
    const removeIngredients =
      typeof window !== "undefined"
        ? window.confirm(
            `Remove "${label}". Also remove its ingredients from the shopping list?`,
          )
        : false;

    setMealLocal(null);
    patchMealCaches(null);
    setError(null);
    startTransition(async () => {
      const result = await clearMealAction(dateIso, removeIngredients);
      if (!result.ok) {
        setMealLocal(previous);
        patchMealCaches(previous);
        setError(result.error);
        return;
      }
      // Custom meals' free-text items were cascaded away by the delete, so
      // refresh bootstrap regardless of the user's "remove ingredients" pick.
      if (removeIngredients || !previous.recipes) invalidate();
    });
  }

  function openMealAction() {
    if (isCustom) {
      setEditingCustom(true);
    } else {
      setPicking(true);
    }
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
              onClick={openMealAction}
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
          ) : isCustom ? (
            <button
              onClick={openMealAction}
              className="group flex-1 text-left -mx-2 -mb-2 px-2 pb-2 rounded-xl hover:bg-[var(--accent-soft)] transition-colors"
            >
              <div className="font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] truncate flex items-center gap-1">
                <PencilLine size={12} className="text-[var(--accent)] shrink-0" />
                <span className="truncate">{mealLocal.custom_name}</span>
              </div>
              <div className="text-[10px] italic text-[var(--muted)] mt-0.5">
                custom meal
              </div>
            </button>
          ) : (
            <button
              onClick={openMealAction}
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

        {mealLocal && (
          <div className="flex items-center justify-between gap-2">
            {mealLocal.recipes ? (
              <Link
                href={`/recipes/${mealLocal.recipes.id}`}
                className="text-xs text-[var(--muted)] hover:text-[var(--accent)]"
              >
                View recipe →
              </Link>
            ) : (
              <span />
            )}
            {mealItems.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                title={expanded ? "Hide ingredients" : "Show ingredients"}
                className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
              >
                {mealItems.length} ingredient{mealItems.length === 1 ? "" : "s"}
                <ChevronDown
                  size={12}
                  className={"transition-transform " + (expanded ? "rotate-180" : "")}
                />
              </button>
            )}
          </div>
        )}
        {expanded && mealItems.length > 0 && mealLocal && (
          <ul className="border-t border-[var(--border)]/60 pt-2 space-y-0.5">
            {mealItems.map((item) => {
              const source = item.shopping_item_sources.find(
                (s) => s.meal_plan_id === mealLocal.id,
              );
              return (
                <MealIngredientRow
                  key={item.id}
                  item={item}
                  displayQuantity={source?.quantity ?? null}
                />
              );
            })}
          </ul>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <RecipeModal
        open={picking}
        recipes={recipes}
        selectedId={mealLocal?.recipe_id ?? null}
        onPick={assign}
        onCustom={() => {
          setPicking(false);
          setEditingCustom(true);
        }}
        onClose={() => setPicking(false)}
      />

      <CustomMealModal
        open={editingCustom}
        ingredients={ingredients}
        initialName={isCustom ? mealLocal?.custom_name ?? "" : ""}
        initialIngredients={isCustom ? mealLocal?.meal_plan_custom_ingredients ?? [] : []}
        onSave={saveCustom}
        onClose={() => setEditingCustom(false)}
      />
    </>
  );
}
