"use client";

import { useEffect, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ShoppingItemState } from "@/lib/types";
import {
  BOOTSTRAP_KEY,
  useInvalidateBootstrap,
  type BootstrapData,
} from "@/lib/queries";
import { setItemStateAction } from "@/app/shopping/actions";
import { setMealIngredientStateAction } from "@/app/plan/actions";
import { StatePicker } from "@/app/shopping/StatePicker";
import type { MealIngredientView } from "./mealIngredients";

// Plan-tab ingredient row: name + quantity + a state picker so you can
// move items between not reviewed / already have / need to buy without
// leaving the plan. The "bought" tick lives on the shopping list — that's
// a shopping action, not a planning one.
export function MealIngredientRow({
  view,
  mealId,
}: {
  view: MealIngredientView;
  mealId: string;
}) {
  const item = view.shoppingItem;
  const initialState: ShoppingItemState = item?.state ?? "not_checked";
  const [state, setState] = useState<ShoppingItemState>(initialState);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateBootstrap();
  const qc = useQueryClient();

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  function patchCacheState(newState: ShoppingItemState) {
    if (!item) return;
    qc.setQueryData<BootstrapData>(BOOTSTRAP_KEY, (old) => {
      if (!old) return old;
      return {
        ...old,
        shoppingItems: old.shoppingItems.map((i) =>
          i.id === item.id ? { ...i, state: newState } : i,
        ),
      };
    });
  }

  function update(next: ShoppingItemState) {
    if (next === state && item) return;
    const previous = state;
    setState(next);
    setError(null);

    // No shopping_item yet — happens when the ingredient was bought +
    // cleared from pantry (sync won't recreate the row because the meal's
    // shopped_at is still set). Create one tied to this meal so the user's
    // state change actually sticks.
    if (!item || !view.ingredient_id) {
      startTransition(async () => {
        if (!view.ingredient_id) {
          setState(previous);
          return;
        }
        const result = await setMealIngredientStateAction(
          mealId,
          view.ingredient_id,
          next,
        );
        if (!result.ok) {
          setState(previous);
          setError(result.error);
        }
        // Either way, refresh bootstrap so the fresh row shows up in the
        // plan + shopping list views.
        invalidate();
      });
      return;
    }

    patchCacheState(next);
    startTransition(async () => {
      const result = await setItemStateAction(item.id, next);
      if (!result.ok) {
        setState(previous);
        patchCacheState(previous);
        setError(result.error);
        invalidate();
      }
    });
  }

  const isBought = state === "bought";
  const isHave = state === "have";
  const isLater = state === "later";
  const qty = view.quantity ?? "";

  return (
    <li className="flex items-center gap-2 px-1 py-1">
      <span
        className={
          "flex-1 text-sm min-w-0 truncate " +
          (isBought
            ? "line-through text-[var(--muted)]"
            : isHave || isLater
            ? "text-[var(--muted)]"
            : "text-[var(--foreground)]")
        }
      >
        {qty ? <span className="font-medium">{qty} </span> : null}
        {view.name}
        {view.otherMealsQuantity && (
          <span
            className="ml-1 text-xs text-[var(--muted)] italic"
            title="Also needed by other planned meals this week"
          >
            + {view.otherMealsQuantity} from other meals
          </span>
        )}
      </span>
      {error && <span className="text-[10px] text-red-600 mr-1">{error}</span>}
      <StatePicker
        state={state}
        onChange={update}
        canMake={!!item?.ingredients?.linked_recipe_id}
      />
    </li>
  );
}
