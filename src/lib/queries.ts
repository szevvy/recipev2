"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AppSettings,
  CategoryMetaRow,
  Ingredient,
  MealPlanWithRecipe,
  Recipe,
  ShoppingItemWithIngredient,
} from "./types";

export type BootstrapData = {
  settings: AppSettings;
  weekStart: string;
  shoppingItems: ShoppingItemWithIngredient[];
  ingredients: Ingredient[];
  recipes: Array<
    Pick<Recipe, "id" | "name" | "image_url" | "default_servings" | "prep_minutes" | "cook_minutes"> & {
      recipe_ingredients: { id: string }[];
    }
  >;
  meals: MealPlanWithRecipe[];
  categoryMeta: CategoryMetaRow[];
  latestPurchases: Array<{ ingredient_id: string; purchased_at: string }>;
};

async function fetchBootstrap(): Promise<BootstrapData> {
  const res = await fetch("/api/bootstrap", { cache: "no-store" });
  const json = (await res.json()) as
    | { ok: true; data: BootstrapData }
    | { ok: false; error: string };
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

export const BOOTSTRAP_KEY = ["bootstrap"] as const;

export function useBootstrap() {
  return useQuery({
    queryKey: BOOTSTRAP_KEY,
    queryFn: fetchBootstrap,
  });
}

// Call after any mutation that affects shopping/plan/recipes/ingredients.
export function useInvalidateBootstrap() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY });
    qc.invalidateQueries({ queryKey: ["plan"] });
  };
}

export const planKey = (weekStartIso: string) => ["plan", weekStartIso] as const;

async function fetchPlanWeek(weekStartIso: string): Promise<MealPlanWithRecipe[]> {
  const res = await fetch(`/api/plan?week=${weekStartIso}`, { cache: "no-store" });
  const json = (await res.json()) as
    | { ok: true; meals: MealPlanWithRecipe[] }
    | { ok: false; error: string };
  if (!json.ok) throw new Error(json.error);
  return json.meals;
}

export function usePlanWeek(
  weekStartIso: string,
  initialData?: MealPlanWithRecipe[],
) {
  return useQuery({
    queryKey: planKey(weekStartIso),
    queryFn: () => fetchPlanWeek(weekStartIso),
    initialData,
  });
}
