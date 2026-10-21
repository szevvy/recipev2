import Link from "next/link";
import { Plus, Clock, Pencil, Users, Utensils } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabaseAdmin } from "@/lib/supabase";
import type { Recipe } from "@/lib/types";

export const instant = false;

type RecipeRow = Recipe & { recipe_ingredients: { id: string }[] };

export default async function RecipesPage() {
  const { data, error } = await supabaseAdmin()
    .from("recipes")
    .select("*, recipe_ingredients(id)")
    .order("name", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <AppHeader current="/recipes" />
        <p className="text-red-600">Failed to load recipes: {error.message}</p>
      </main>
    );
  }

  const recipes = (data ?? []) as unknown as RecipeRow[];

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/recipes" />
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">Recipes</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Your cookbook. Add ingredients once, use them across many recipes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((r) => (
            <div
              key={r.id}
              className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)] hover:shadow-md transition-all"
            >
              <Link href={`/recipes/${r.id}`} className="block">
                {r.image_url ? (
                  <div
                    className="h-32 bg-cover bg-center"
                    style={{ backgroundImage: `url(${r.image_url})` }}
                  />
                ) : (
                  <div className="h-32 bg-[var(--accent-soft)] flex items-center justify-center">
                    <Utensils className="text-[var(--accent)]/50" size={32} />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <h2 className="font-serif text-lg text-[var(--foreground)] group-hover:text-[var(--accent)]">
                    {r.name}
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {r.default_servings}
                    </span>
                    {(r.prep_minutes != null || r.cook_minutes != null) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {(r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)} min
                      </span>
                    )}
                    <span>
                      {r.recipe_ingredients.length} ingredient
                      {r.recipe_ingredients.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                href={`/recipes/${r.id}/edit`}
                title="Edit recipe"
                className="absolute top-2 right-2 inline-flex items-center justify-center h-8 w-8 rounded-full bg-[var(--surface)]/95 border border-[var(--border)] text-[var(--muted)] shadow-sm hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
              >
                <Pencil size={14} />
              </Link>
            </div>
          ))}
          <Link
            href="/recipes/new"
            className="group rounded-2xl border-2 border-dashed border-[var(--border)] bg-transparent flex flex-col items-center justify-center p-6 min-h-[14rem] text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 hover:text-[var(--accent)] transition-colors"
          >
            <Plus size={32} className="mb-2" />
            <span className="font-serif text-lg">
              {recipes.length === 0 ? "Add your first recipe" : "Add new recipe"}
            </span>
          </Link>
        </div>
    </main>
  );
}
