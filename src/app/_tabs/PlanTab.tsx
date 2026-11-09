"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { BootstrapData } from "@/lib/queries";
import { usePlanWeek } from "@/lib/queries";
import type {
  Ingredient,
  MealPlanWithRecipe,
  Recipe,
  ShoppingItemWithIngredient,
} from "@/lib/types";
import { DayCard } from "@/app/plan/DayCard";
import { buildMealIngredients } from "@/app/plan/mealIngredients";
import { ListSection, type ListMemberView } from "@/app/plan/ListSection";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

export function PlanTab({ data }: { data: BootstrapData }) {
  const weekStartsOn = data.settings.week_starts_on as 0 | 1;
  const ingredients = data.ingredients as Ingredient[];
  const shoppingItems = data.shoppingItems as ShoppingItemWithIngredient[];
  const categoryMeta = data.categoryMeta;
  const latestPurchases = data.latestPurchases;
  const todayWeekStart = useMemo(
    () => startOfWeek(new Date(), { weekStartsOn }),
    [weekStartsOn],
  );
  const todayWeekIso = format(todayWeekStart, "yyyy-MM-dd");

  // Local state drives which week is visible; react-query caches each week's meals.
  const [weekStartIso, setWeekStartIso] = useState<string>(todayWeekIso);
  const weekStart = parseISO(weekStartIso);
  const weekEnd = addDays(weekStart, 6);

  // Seed the current week's query from bootstrap so there's no initial fetch.
  const initialMeals = weekStartIso === data.weekStart ? data.meals : undefined;
  const planQuery = usePlanWeek(weekStartIso, initialMeals);

  const meals = planQuery.data ?? [];
  const recipes = data.recipes as RecipeOption[];

  const mealByDate = new Map<string, MealPlanWithRecipe>();
  for (const m of meals) mealByDate.set(m.date, m);

  // Resolve each meal's complete ingredient list (from recipe_ingredients /
  // meal_plan_custom_ingredients) and link each to its shopping_items row
  // if one exists. Previously we derived this from the sources side, which
  // missed any ingredient that was globally in "have" state.
  const ingredientsByMealId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildMealIngredients>>();
    for (const meal of meals) {
      map.set(meal.id, buildMealIngredients(meal, shoppingItems));
    }
    return map;
  }, [meals, shoppingItems]);

  // Pivot ingredients → per-list ListMemberView arrays. Every list named
  // in any ingredient.lists gets its own section; Staples is special-cased
  // to appear first (and to show even when empty if the user is bootstrapping).
  const listSections = useMemo(() => {
    const stapleRowByIngredient = new Map<string, ShoppingItemWithIngredient>();
    for (const item of shoppingItems) {
      if (item.source === "staple" && item.ingredient_id) {
        stapleRowByIngredient.set(item.ingredient_id, item);
      }
    }
    const lastPurchasedByIngredient = new Map<string, string>();
    for (const p of latestPurchases) {
      lastPurchasedByIngredient.set(p.ingredient_id, p.purchased_at);
    }
    const membersByList = new Map<string, ListMemberView[]>();
    for (const ing of ingredients) {
      if (ing.lists.length === 0) continue;
      const view: ListMemberView = {
        ingredient_id: ing.id,
        name: ing.name,
        group_name: ing.group_name,
        state: stapleRowByIngredient.get(ing.id)?.state ?? "not_checked",
        last_purchased_at: lastPurchasedByIngredient.get(ing.id) ?? null,
      };
      for (const listName of ing.lists) {
        const bucket = membersByList.get(listName) ?? [];
        bucket.push(view);
        membersByList.set(listName, bucket);
      }
    }
    const names = Array.from(membersByList.keys()).sort((a, b) => {
      if (a === "Staples") return -1;
      if (b === "Staples") return 1;
      return a.localeCompare(b);
    });
    return names.map((name) => ({ name, members: membersByList.get(name) ?? [] }));
  }, [ingredients, shoppingItems, latestPurchases]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const prevWeek = format(addDays(weekStart, -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(weekStart, 7), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Meal plan</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setWeekStartIso(prevWeek)}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekStartIso(todayWeekIso)}
            className="px-3 py-1 text-sm rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekStartIso(nextWeek)}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center space-y-3">
          <p className="text-[var(--muted)]">
            You need recipes before you can plan meals.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((d) => {
            const dateIso = format(d, "yyyy-MM-dd");
            const dayMeal = mealByDate.get(dateIso) ?? null;
            const mealIngredients = dayMeal
              ? ingredientsByMealId.get(dayMeal.id) ?? []
              : [];
            return (
              <DayCard
                key={dateIso}
                date={d}
                meal={dayMeal}
                recipes={recipes}
                ingredients={ingredients}
                mealIngredients={mealIngredients}
              />
            );
          })}
        </div>
      )}

      {listSections.map((list) => (
        <ListSection
          key={list.name}
          listName={list.name}
          members={list.members}
          categoryMeta={categoryMeta}
        />
      ))}
    </div>
  );
}
