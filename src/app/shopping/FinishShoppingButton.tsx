"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import { finishShoppingAction } from "./actions";

export function FinishShoppingButton() {
  const [pending, startTransition] = useTransition();
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  function onClick() {
    if (!confirm("Finish shopping? This clears bought items and resets staples.")) return;

    const snapshot = qc.getQueryData<BootstrapData>(BOOTSTRAP_KEY);
    const nowIso = new Date().toISOString();

    // Mirror the server's finish steps on the cache so the list clears
    // immediately: drop bought+have rows, reset remaining staples to
    // not_checked, stamp current meals as shopped so sync won't re-add them,
    // and roll forward latestPurchases so "last bought" badges refresh.
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      const boughtIngredientIds = new Set(
        old.shoppingItems
          .filter((i) => i.state === "bought" && i.ingredient_id)
          .map((i) => i.ingredient_id as string),
      );
      const shoppingItems = old.shoppingItems
        .filter((i) => i.state !== "bought" && i.state !== "have")
        .map((i) => (i.source === "staple" ? { ...i, state: "not_checked" as const } : i));
      const meals = old.meals.map((m) =>
        m.shopped_at ? m : { ...m, shopped_at: nowIso },
      );
      const touched = new Set<string>();
      const latestPurchases = old.latestPurchases.map((p) => {
        if (boughtIngredientIds.has(p.ingredient_id)) {
          touched.add(p.ingredient_id);
          return { ...p, purchased_at: nowIso };
        }
        return p;
      });
      for (const id of boughtIngredientIds) {
        if (!touched.has(id)) latestPurchases.push({ ingredient_id: id, purchased_at: nowIso });
      }
      return { ...old, shoppingItems, meals, latestPurchases };
    });

    startTransition(async () => {
      const result = await finishShoppingAction();
      if (!result.ok) {
        if (snapshot) qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, snapshot);
        else invalidate();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sage)] text-white text-sm px-4 py-2 hover:brightness-110 disabled:opacity-60 transition-all"
    >
      <CheckCircle2 size={16} /> {pending ? "Finishing…" : "Finish shopping"}
    </button>
  );
}
