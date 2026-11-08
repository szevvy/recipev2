"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { BootstrapData } from "@/lib/queries";
import { usePlanWeek } from "@/lib/queries";
import type { Ingredient, MealPlanWithRecipe, Recipe } from "@/lib/types";
import { DayCard } from "@/app/plan/DayCard";

type RecipeOption = Pick<
  Recipe,
  "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"
>;

export function PlanTab({ data }: { data: BootstrapData }) {
  const weekStartsOn = data.settings.week_starts_on as 0 | 1;
  const ingredients = data.ingredients as Ingredient[];
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((d) => (
            <DayCard
              key={format(d, "yyyy-MM-dd")}
              date={d}
              meal={mealByDate.get(format(d, "yyyy-MM-dd")) ?? null}
              recipes={recipes}
              ingredients={ingredients}
            />
          ))}
        </div>
      )}
    </div>
  );
}
