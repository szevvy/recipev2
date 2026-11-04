import { AppHeader } from "@/components/AppHeader";
import { getSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase";
import type { CategoryMetaRow, Ingredient } from "@/lib/types";
import { CategoryManager, type CategoryRow } from "./CategoryManager";
import { WeekStartPicker } from "./WeekStartPicker";

export const instant = false;

export default async function SettingsPage() {
  const settings = await getSettings();

  const supabase = supabaseAdmin();
  const [ingredientsResp, metaResp] = await Promise.all([
    supabase.from("ingredients").select("group_name"),
    supabase.from("category_meta").select("*"),
  ]);

  const ingredientsErr = ingredientsResp.error;
  const metaErr = metaResp.error;

  const groupNames = new Set<string>();
  for (const row of (ingredientsResp.data ?? []) as unknown as Pick<Ingredient, "group_name">[]) {
    if (row.group_name && row.group_name.trim()) groupNames.add(row.group_name.trim());
  }

  const metaByName = new Map<string, CategoryMetaRow>();
  for (const m of (metaResp.data ?? []) as unknown as CategoryMetaRow[]) {
    metaByName.set(m.name, m);
  }

  const categories: CategoryRow[] = Array.from(groupNames).map((name) => ({
    name,
    color: metaByName.get(name)?.color ?? null,
  }));

  // Sort by sort_order (lower first), fall back to alphabetical when no meta.
  categories.sort((a, b) => {
    const sa = metaByName.get(a.name)?.sort_order ?? 1_000_000;
    const sb = metaByName.get(b.name)?.sort_order ?? 1_000_000;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <AppHeader current="/settings" />
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Settings</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Household-wide preferences. Changes save instantly.
          </p>
        </div>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
          <div>
            <h2 className="font-serif text-xl text-[var(--foreground)]">Week starts on</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Determines how the meal planner week lays out.
            </p>
          </div>
          <WeekStartPicker initial={settings.week_starts_on} />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
          <div>
            <h2 className="font-serif text-xl text-[var(--foreground)]">Categories</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Reorder with drag or arrows — top of this list is top of the shopping list.
              Pick a colour chip for each to colour-code the shopping sections.
            </p>
          </div>
          {ingredientsErr || metaErr ? (
            <p className="text-sm text-red-600">
              Failed to load categories: {(ingredientsErr ?? metaErr)?.message}
            </p>
          ) : (
            <CategoryManager categories={categories} />
          )}
        </section>
      </div>
    </main>
  );
}
