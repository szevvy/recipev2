import { connection } from "next/server";
import { AppHeader } from "@/components/AppHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { syncShoppingList } from "@/lib/shopping-sync";
import type { Ingredient, ShoppingItemWithIngredient } from "@/lib/types";
import { AddManualItem } from "./AddManualItem";
import { FinishShoppingButton } from "./FinishShoppingButton";
import { ShoppingItemRow } from "./ShoppingItemRow";
import { StaplePreCheck } from "./StaplePreCheck";

export const instant = false;

const UNGROUPED = "__ungrouped__";

export default async function ShoppingPage() {
  await connection();
  // Refresh meal + staple items on each visit.
  await syncShoppingList();

  const supabase = supabaseAdmin();
  const [itemsResp, staplesResp, ingredientsResp] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("*, ingredients(id, name, group_name)")
      .order("created_at"),
    supabase
      .from("ingredients")
      .select("id, name, staple_state")
      .eq("is_staple", true)
      .order("name"),
    supabase.from("ingredients").select("*").order("name"),
  ]);

  if (itemsResp.error || staplesResp.error || ingredientsResp.error) {
    return (
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <AppHeader current="/shopping" />
        <p className="text-red-600">
          Failed to load shopping list:{" "}
          {(itemsResp.error ?? staplesResp.error ?? ingredientsResp.error)?.message}
        </p>
      </main>
    );
  }

  const items = (itemsResp.data ?? []) as unknown as ShoppingItemWithIngredient[];
  const staples = (staplesResp.data ?? []) as unknown as Array<
    Pick<Ingredient, "id" | "name" | "staple_state">
  >;
  const ingredients = (ingredientsResp.data ?? []) as unknown as Ingredient[];

  const anyBought = items.some((i) => i.bought);

  // Group by ingredient.group_name
  const byGroup = new Map<string, ShoppingItemWithIngredient[]>();
  for (const item of items) {
    const key = item.ingredients?.group_name ?? UNGROUPED;
    const bucket = byGroup.get(key) ?? [];
    bucket.push(item);
    byGroup.set(key, bucket);
  }
  // Sort within each group: unbought first, then by ingredient name
  for (const bucket of byGroup.values()) {
    bucket.sort((a, b) => {
      if (a.bought !== b.bought) return a.bought ? 1 : -1;
      const an = a.ingredients?.name ?? "";
      const bn = b.ingredients?.name ?? "";
      return an.localeCompare(bn);
    });
  }
  const groupKeys = Array.from(byGroup.keys())
    .filter((k) => k !== UNGROUPED)
    .sort((a, b) => a.localeCompare(b));
  if (byGroup.has(UNGROUPED)) groupKeys.push(UNGROUPED);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/shopping" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Shopping</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            From your meal plan + staples you need. Check off as you go.
          </p>
        </div>
        <FinishShoppingButton anyBought={anyBought} />
      </div>

      <StaplePreCheck staples={staples} />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
        <h2 className="font-serif text-xl text-[var(--foreground)]">List</h2>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)] italic">
            Nothing to buy. Plan some meals, mark staples as “need”, or add something below.
          </p>
        ) : (
          <div className="space-y-5">
            {groupKeys.map((key) => {
              const label = key === UNGROUPED ? "Other" : key;
              const bucket = byGroup.get(key) ?? [];
              return (
                <section key={key} className="space-y-1">
                  <h3 className="font-serif text-sm uppercase tracking-wide text-[var(--accent)]">
                    {label}
                    <span className="ml-2 text-xs font-sans text-[var(--muted)] normal-case font-normal">
                      ({bucket.length})
                    </span>
                  </h3>
                  <ul className="divide-y divide-[var(--border)]/60 bg-[var(--surface-muted)]/60 rounded-xl p-1">
                    {bucket.map((item) => (
                      <ShoppingItemRow key={item.id} item={item} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <AddManualItem ingredients={ingredients} />
    </main>
  );
}
