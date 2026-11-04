"use client";

import { useMemo } from "react";
import type { BootstrapData } from "@/lib/queries";
import type { Ingredient, ShoppingItemWithIngredient } from "@/lib/types";
import { AddManualItem } from "@/app/shopping/AddManualItem";
import { FinishShoppingButton } from "@/app/shopping/FinishShoppingButton";
import { HaveSection } from "@/app/shopping/HaveSection";
import { ShoppingList } from "@/app/shopping/ShoppingList";
import {
  StaplesSection,
  type StapleView,
} from "@/app/shopping/StaplesSection";

export function ShoppingTab({ data }: { data: BootstrapData }) {
  const items = data.shoppingItems as ShoppingItemWithIngredient[];
  const ingredients = data.ingredients as Ingredient[];
  const categoryMeta = data.categoryMeta;

  const { active, have, staples, counts } = useMemo(() => {
    const active = items.filter((i) => i.state !== "have");
    const have = items.filter((i) => i.state === "have");

    const stapleRowByIngredient = new Map<string, ShoppingItemWithIngredient>();
    for (const item of items) {
      if (item.source === "staple" && item.ingredient_id) {
        stapleRowByIngredient.set(item.ingredient_id, item);
      }
    }
    const staples: StapleView[] = ingredients
      .filter((i) => i.is_staple)
      .map((i) => ({
        ingredient_id: i.id,
        name: i.name,
        group_name: i.group_name,
        state: stapleRowByIngredient.get(i.id)?.state ?? "not_checked",
      }));

    const counts = {
      toBuy: active.filter((i) => i.state === "to_buy").length,
      notChecked: active.filter((i) => i.state === "not_checked").length,
      bought: active.filter((i) => i.state === "bought").length,
    };

    return { active, have, staples, counts };
  }, [items, ingredients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[var(--foreground)]">Shopping</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {counts.notChecked > 0 && (
              <span className="text-red-500 font-medium">
                {counts.notChecked} to review ·{" "}
              </span>
            )}
            <span className="text-[var(--accent)]">{counts.toBuy} to buy</span>
            {counts.bought > 0 && (
              <span className="text-[var(--sage)]"> · {counts.bought} ticked</span>
            )}
            {have.length > 0 && (
              <span className="text-[var(--muted)]"> · {have.length} have</span>
            )}
          </p>
        </div>
        <FinishShoppingButton />
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
        <ShoppingList items={active} categoryMeta={categoryMeta} />
      </section>

      <StaplesSection staples={staples} categoryMeta={categoryMeta} />

      <HaveSection items={have} />

      <AddManualItem ingredients={ingredients} />
    </div>
  );
}
