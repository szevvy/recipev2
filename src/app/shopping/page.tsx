import { connection } from "next/server";
import { AppHeader } from "@/components/AppHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { syncShoppingList } from "@/lib/shopping-sync";
import type { Ingredient, ShoppingItemWithIngredient } from "@/lib/types";
import { AddManualItem } from "./AddManualItem";
import { FinishShoppingButton } from "./FinishShoppingButton";
import { HaveSection } from "./HaveSection";
import { ShoppingItemRow } from "./ShoppingItemRow";
import { StaplesSection } from "./StaplesSection";

export const instant = false;

const UNGROUPED = "__ungrouped__";

export default async function ShoppingPage() {
  await connection();
  await syncShoppingList();

  const supabase = supabaseAdmin();
  const [itemsResp, ingredientsResp] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("*, ingredients(id, name, group_name, is_staple)")
      .order("created_at"),
    supabase.from("ingredients").select("*").order("name"),
  ]);

  if (itemsResp.error || ingredientsResp.error) {
    return (
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <AppHeader current="/shopping" />
        <p className="text-red-600">
          Failed to load shopping list:{" "}
          {(itemsResp.error ?? ingredientsResp.error)?.message}
        </p>
      </main>
    );
  }

  const items = (itemsResp.data ?? []) as unknown as ShoppingItemWithIngredient[];
  const ingredients = (ingredientsResp.data ?? []) as unknown as Ingredient[];

  const active = items.filter((i) => i.state !== "have");
  const have = items.filter((i) => i.state === "have");
  const staples = items.filter(
    (i) => (i.ingredients as { is_staple?: boolean } | null)?.is_staple === true,
  );

  // Group active items by group_name
  const byGroup = new Map<string, ShoppingItemWithIngredient[]>();
  for (const item of active) {
    const key = item.ingredients?.group_name ?? UNGROUPED;
    const bucket = byGroup.get(key) ?? [];
    bucket.push(item);
    byGroup.set(key, bucket);
  }
  for (const bucket of byGroup.values()) {
    bucket.sort((a, b) => {
      const sa = a.state === "bought" ? 1 : 0;
      const sb = b.state === "bought" ? 1 : 0;
      if (sa !== sb) return sa - sb;
      const an = a.ingredients?.name ?? "";
      const bn = b.ingredients?.name ?? "";
      return an.localeCompare(bn);
    });
  }
  const groupKeys = Array.from(byGroup.keys())
    .filter((k) => k !== UNGROUPED)
    .sort((a, b) => a.localeCompare(b));
  if (byGroup.has(UNGROUPED)) groupKeys.push(UNGROUPED);

  const toBuyCount = active.filter((i) => i.state === "to_buy").length;
  const notCheckedCount = active.filter((i) => i.state === "not_checked").length;
  const boughtCount = active.filter((i) => i.state === "bought").length;

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <AppHeader current="/shopping" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Shopping</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {notCheckedCount > 0 && <span>{notCheckedCount} to review · </span>}
            <span className="text-[var(--accent)]">{toBuyCount} to buy</span>
            {boughtCount > 0 && (
              <span className="text-[var(--sage)]"> · {boughtCount} ticked</span>
            )}
            {have.length > 0 && (
              <span className="text-[var(--muted)]"> · {have.length} have</span>
            )}
          </p>
        </div>
        <FinishShoppingButton />
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
        {active.length === 0 ? (
          <p className="text-sm text-[var(--muted)] italic">
            Nothing to buy right now. Plan some meals, mark staples as needed, or add
            something below.
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

      <StaplesSection staples={staples} />

      <HaveSection items={have} />

      <AddManualItem ingredients={ingredients} />
    </main>
  );
}
