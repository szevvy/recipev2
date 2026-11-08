"use client";

import { useMemo } from "react";
import type { BootstrapData } from "@/lib/queries";
import type { Ingredient, ShoppingItemWithIngredient } from "@/lib/types";
import { AddManualItem } from "@/app/shopping/AddManualItem";
import { FinishShoppingButton } from "@/app/shopping/FinishShoppingButton";
import { HaveSection } from "@/app/shopping/HaveSection";
import { ShoppingList } from "@/app/shopping/ShoppingList";

export function ShoppingTab({ data }: { data: BootstrapData }) {
  const items = data.shoppingItems as ShoppingItemWithIngredient[];
  const ingredients = data.ingredients as Ingredient[];
  const categoryMeta = data.categoryMeta;

  const { active, have, counts } = useMemo(() => {
    const active = items.filter((i) => i.state !== "have");
    const have = items.filter((i) => i.state === "have");

    const counts = {
      toBuy: active.filter((i) => i.state === "to_buy").length,
      notChecked: active.filter((i) => i.state === "not_checked").length,
      bought: active.filter((i) => i.state === "bought").length,
    };

    return { active, have, counts };
  }, [items]);

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

      <HaveSection items={have} />

      <AddManualItem ingredients={ingredients} />
    </div>
  );
}
