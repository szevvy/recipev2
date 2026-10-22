import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { AppHeader } from "@/components/AppHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import type { MealPlanWithRecipe, Recipe } from "@/lib/types";
import { DayCard } from "./DayCard";

export const instant = false;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function parseWeekParam(raw: unknown): Date | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  try {
    const d = parseISO(s);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default async function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const settings = await getSettings();
  const weekStartsOn = settings.week_starts_on as 0 | 1;

  const requested = parseWeekParam(sp.week);
  const weekStart = startOfWeek(requested ?? new Date(), { weekStartsOn });
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = format(addDays(weekStart, -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(weekStart, 7), "yyyy-MM-dd");

  const supabase = supabaseAdmin();
  const [{ data: mealsData }, { data: recipesData }] = await Promise.all([
    supabase
      .from("meal_plan")
      .select("*, recipes(id, name, default_servings, image_url)")
      .gte("date", format(weekStart, "yyyy-MM-dd"))
      .lte("date", format(weekEnd, "yyyy-MM-dd"))
      .is("slot", null),
    supabase
      .from("recipes")
      .select("id, name, image_url, default_servings")
      .order("name", { ascending: true }),
  ]);

  const meals = (mealsData ?? []) as unknown as MealPlanWithRecipe[];
  const recipes = (recipesData ?? []) as unknown as Pick<
    Recipe,
    "id" | "name" | "image_url" | "default_servings"
  >[];

  const mealByDate = new Map<string, MealPlanWithRecipe>();
  for (const m of meals) mealByDate.set(m.date, m);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <AppHeader current="/plan" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Meal plan</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
          <Link
            href={`/plan?week=${prevWeek}`}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
          >
            <ChevronLeft size={14} /> Prev
          </Link>
          <Link
            href="/plan"
            className="px-3 py-1 text-sm rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
          >
            This week
          </Link>
          <Link
            href={`/plan?week=${nextWeek}`}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
          >
            Next <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center space-y-3">
          <p className="text-[var(--muted)]">
            You need recipes before you can plan meals.
          </p>
          <Link
            href="/recipes/new"
            className="inline-flex items-center rounded-full bg-[var(--accent)] text-white text-sm px-4 py-2 hover:bg-[var(--accent-hover)] transition-colors"
          >
            Create a recipe
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((d) => (
            <DayCard
              key={format(d, "yyyy-MM-dd")}
              date={d}
              meal={mealByDate.get(format(d, "yyyy-MM-dd")) ?? null}
              recipes={recipes}
            />
          ))}
        </div>
      )}
    </main>
  );
}
