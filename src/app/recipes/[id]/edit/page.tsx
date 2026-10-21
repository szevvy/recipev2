import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabaseAdmin } from "@/lib/supabase";
import type { Ingredient, RecipeWithIngredients } from "@/lib/types";
import { RecipeEditor } from "../../RecipeEditor";

export const instant = false;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function EditRecipePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const fromParam = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const returnUrl = fromParam === "view" ? `/recipes/${id}` : "/recipes";
  const returnLabel = fromParam === "view" ? "Back to recipe" : "All recipes";

  const supabase = supabaseAdmin();

  const [{ data: recipe, error: recipeErr }, { data: ingredients }] = await Promise.all([
    supabase
      .from("recipes")
      .select("*, recipe_ingredients(*, ingredients(id, name))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ingredients").select("*").order("name", { ascending: true }),
  ]);

  if (recipeErr) {
    return (
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <AppHeader current="/recipes" />
        <p className="text-red-600">Failed to load recipe: {recipeErr.message}</p>
      </main>
    );
  }
  if (!recipe) notFound();

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/recipes" />
      <div className="flex items-center justify-between gap-4">
        <Link
          href={returnUrl}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft size={14} /> {returnLabel}
        </Link>
      </div>
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">
          Edit <span className="text-[var(--accent)]">{recipe.name as string}</span>
        </h1>
      </div>
      <RecipeEditor
        recipe={recipe as unknown as RecipeWithIngredients}
        initialIngredients={(ingredients ?? []) as unknown as Ingredient[]}
        returnUrl={returnUrl}
      />
    </main>
  );
}
