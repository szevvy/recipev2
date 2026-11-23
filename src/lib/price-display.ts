import type { CategoryMetaRow, Ingredient, PriceDisplay } from "./types";

// Resolve the effective price display for an ingredient: explicit
// override on the ingredient wins; otherwise fall back to the group's
// default; otherwise "both" (show everything).
export function resolvePriceDisplay(
  ingredient: Pick<Ingredient, "group_name" | "price_display_override"> | null | undefined,
  categoryMeta: Pick<CategoryMetaRow, "name" | "price_display">[] | null | undefined,
): PriceDisplay {
  if (!ingredient) return "both";
  if (ingredient.price_display_override) return ingredient.price_display_override;
  if (ingredient.group_name && categoryMeta) {
    const meta = categoryMeta.find((c) => c.name === ingredient.group_name);
    if (meta?.price_display) return meta.price_display;
  }
  return "both";
}
