import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, Pencil, Users, Utensils } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabaseAdmin } from "@/lib/supabase";
import type { RecipeWithIngredients } from "@/lib/types";

export const instant = false;

type Params = Promise<{ id: string }>;

export default async function RecipeViewPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*, ingredients(id, name, group_name))")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <AppHeader current="/recipes" />
        <p className="text-red-600">Failed to load recipe: {error.message}</p>
      </main>
    );
  }
  if (!recipe) notFound();

  const r = recipe as unknown as RecipeWithIngredients;
  const sortedIngredients = [...r.recipe_ingredients].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const totalTime =
    r.prep_minutes != null || r.cook_minutes != null
      ? (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)
      : null;

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-4">
      <AppHeader current="/recipes" />
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft size={14} /> All recipes
        </Link>
        <Link
          href={`/recipes/${r.id}/edit?from=view`}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm px-3 py-1.5 hover:bg-[var(--accent-soft)] hover:border-[var(--accent)] transition-colors"
        >
          <Pencil size={14} /> Edit
        </Link>
      </div>

      <article className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm overflow-hidden">
        {r.image_url && (
          <div
            className="h-56 sm:h-72 bg-cover bg-center"
            style={{ backgroundImage: `url(${r.image_url})` }}
          />
        )}
        <div className="p-6 sm:p-10 space-y-8">
          <header className="space-y-4">
            <h1 className="font-serif text-4xl sm:text-5xl text-[var(--foreground)] leading-tight">
              {r.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} /> Serves {r.default_servings}
              </span>
              {totalTime != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} />
                  {r.prep_minutes != null && r.cook_minutes != null
                    ? `${r.prep_minutes} prep · ${r.cook_minutes} cook`
                    : `${totalTime} min`}
                </span>
              )}
              {r.source_url && (
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[var(--accent)]"
                >
                  <ExternalLink size={14} /> Source
                </a>
              )}
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8 lg:gap-12">
            <section className="space-y-3">
              <h2 className="font-serif text-xl text-[var(--accent)] border-b border-[var(--border)] pb-2">
                Ingredients
              </h2>
              {sortedIngredients.length === 0 ? (
                <p className="text-sm text-[var(--muted)] italic flex items-center gap-2">
                  <Utensils size={14} /> No ingredients yet.
                </p>
              ) : (
                <ul className="space-y-1.5 text-[var(--foreground)]">
                  {sortedIngredients.map((ri) => (
                    <li key={ri.id} className="leading-snug">
                      {ri.quantity && (
                        <span className="font-medium">{ri.quantity} </span>
                      )}
                      <span>{ri.ingredients?.name ?? "(deleted ingredient)"}</span>
                      {ri.note && (
                        <span className="text-[var(--muted)] text-sm">, {ri.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-xl text-[var(--accent)] border-b border-[var(--border)] pb-2">
                Method
              </h2>
              {r.instructions ? (
                <div className="font-serif leading-relaxed whitespace-pre-wrap text-[var(--foreground)]">
                  {r.instructions}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)] italic">No instructions yet.</p>
              )}
            </section>
          </div>

          {r.notes && (
            <section className="rounded-xl bg-[var(--accent-soft)]/50 p-4 space-y-2">
              <h3 className="text-xs uppercase tracking-wide text-[var(--accent)] font-semibold">
                Notes
              </h3>
              <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap font-serif leading-relaxed">
                {r.notes}
              </p>
            </section>
          )}
        </div>
      </article>
    </main>
  );
}
