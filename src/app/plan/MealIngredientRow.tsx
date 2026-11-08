import type { MealIngredientView } from "./mealIngredients";

// Read-only display: the plan tab lists each meal's ingredients so you can
// see what's needed and whether you already have it. Interactive state
// changes (bought / to_buy / have) live on the shopping list.
export function MealIngredientRow({ view }: { view: MealIngredientView }) {
  const state = view.shoppingItem?.state ?? "not_checked";
  const isBought = state === "bought";
  const isHave = state === "have";
  const qty = view.quantity ?? "";

  return (
    <li className="flex items-center gap-2 px-1 py-1">
      <span
        className={
          "flex-1 text-sm min-w-0 truncate " +
          (isBought
            ? "line-through text-[var(--muted)]"
            : isHave
            ? "text-[var(--muted)]"
            : "text-[var(--foreground)]")
        }
      >
        {qty ? <span className="font-medium">{qty} </span> : null}
        {view.name}
      </span>
      {isHave && (
        <span className="text-[10px] uppercase tracking-wide text-[var(--sage)] shrink-0">
          have
        </span>
      )}
      {isBought && (
        <span className="text-[10px] uppercase tracking-wide text-[var(--accent)] shrink-0">
          bought
        </span>
      )}
    </li>
  );
}
