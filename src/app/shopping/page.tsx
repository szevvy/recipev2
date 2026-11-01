import { connection } from "next/server";
import { AppHeader } from "@/components/AppHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { syncShoppingList } from "@/lib/shopping-sync";
import type { Ingredient, ShoppingItemWithIngredient } from "@/lib/types";
import { AddManualItem } from "./AddManualItem";
import { FinishShoppingButton } from "./FinishShoppingButton";
import { HaveSection } from "./HaveSection";
import { ShoppingList } from "./ShoppingList";
import { StaplesSection, type StapleView } from "./StaplesSection";

export const instant = false;

export default async function ShoppingPage() {
  await connection();
  await syncShoppingList();

  const supabase = supabaseAdmin();
  const [itemsResp, ingredientsResp] = await Promise.all([
    supabase
      .from("shopping_items")
      .select(
        "*, ingredients(id, name, group_name, is_staple), shopping_item_sources(id, kind, quantity, meal_plan_id, meal_plan(date, recipes(id, name)))",
      )
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

  const stapleRowByIngredient = new Map<string, ShoppingItemWithIngredient>();
  for (const item of items) {
    if (item.source === "staple") stapleRowByIngredient.set(item.ingredient_id, item);
  }
  const staples: StapleView[] = ingredients
    .filter((i) => i.is_staple)
    .map((i) => ({
      ingredient_id: i.id,
      name: i.name,
      state: stapleRowByIngredient.get(i.id)?.state ?? "not_checked",
    }));

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
            {notCheckedCount > 0 && (
              <span className="text-red-500 font-medium">{notCheckedCount} to review · </span>
            )}
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
        <ShoppingList items={active} />
      </section>

      <StaplesSection staples={staples} />

      <HaveSection items={have} />

      <AddManualItem ingredients={ingredients} />
    </main>
  );
}
