import { AppHeader } from "@/components/AppHeader";
import { supabaseAdmin } from "@/lib/supabase";
import type { Ingredient } from "@/lib/types";
import { RecipeEditor } from "../RecipeEditor";

export const instant = false;

export default async function NewRecipePage() {
  const { data: ingredients } = await supabaseAdmin()
    .from("ingredients")
    .select("*")
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/recipes" />
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">New recipe</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Fill in what you have — you can always edit later.
        </p>
      </div>
      <RecipeEditor
        recipe={null}
        initialIngredients={(ingredients ?? []) as unknown as Ingredient[]}
      />
    </main>
  );
}
