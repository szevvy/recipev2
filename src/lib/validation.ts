import { z } from "zod";

const emptyToNull = z.string().trim().transform((v) => (v.length === 0 ? null : v));

const trimmedNullable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (!v || v.length === 0 ? null : v));

export const IngredientInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name too long"),
  group_name: emptyToNull.pipe(z.string().max(50).nullable()),
  // List memberships are passed as repeated form fields named "lists".
  // Unknown lists are created implicitly when we insert a membership.
  lists: z.array(z.string().trim().min(1).max(60)).default([]),
  // Optional recipe link — empty string from an unticked FormData entry
  // normalises to null.
  linked_recipe_id: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .pipe(z.string().uuid().nullable())
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  // Optional positive integer; blank input becomes null.
  shelf_life_days: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
      const trimmed = v.trim();
      if (!trimmed) return null;
      const n = Number.parseInt(trimmed, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    })
    .pipe(z.number().int().positive().nullable())
    .optional()
    .transform((v) => v ?? null),
  // Per-retailer SKU/stock code. Blank/missing = not linked to that retailer.
  retailer_codes: z
    .object({
      coles: z.string().trim().max(60).optional().nullable(),
      woolworths: z.string().trim().max(60).optional().nullable(),
      aldi: z.string().trim().max(60).optional().nullable(),
    })
    .optional()
    .transform((v) => ({
      coles: v?.coles?.trim() || null,
      woolworths: v?.woolworths?.trim() || null,
      aldi: v?.aldi?.trim() || null,
    })),
});

export type IngredientInput = z.infer<typeof IngredientInputSchema>;

export function parseIngredientForm(fd: FormData): IngredientInput {
  const rawLists = fd
    .getAll("lists")
    .map((v) => String(v ?? ""))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  // Dedupe (case-insensitive) while preserving first-seen casing.
  const seen = new Set<string>();
  const lists: string[] = [];
  for (const l of rawLists) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lists.push(l);
  }
  const raw = {
    name: String(fd.get("name") ?? ""),
    group_name: String(fd.get("group_name") ?? ""),
    lists,
    linked_recipe_id: String(fd.get("linked_recipe_id") ?? ""),
    shelf_life_days: String(fd.get("shelf_life_days") ?? ""),
    retailer_codes: {
      coles: String(fd.get("retailer_coles") ?? ""),
      woolworths: String(fd.get("retailer_woolworths") ?? ""),
      aldi: String(fd.get("retailer_aldi") ?? ""),
    },
  };
  return IngredientInputSchema.parse(raw);
}

export const RecipeIngredientInputSchema = z.object({
  ingredient_id: z.string().uuid().nullable(),
  ingredient_name: z.string().trim().min(1, "Pick an ingredient").max(80),
  quantity: trimmedNullable(50),
  note: trimmedNullable(100),
});

export const RecipeInputSchema = z.object({
  name: z.string().trim().min(1, "Recipe name required").max(100, "Name too long"),
  default_servings: z
    .number({ error: "Servings required" })
    .positive("Servings must be > 0"),
  prep_minutes: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  cook_minutes: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  source_url: trimmedNullable(500),
  image_url: trimmedNullable(500),
  instructions: trimmedNullable(10000),
  notes: trimmedNullable(1000),
  ingredients: z.array(RecipeIngredientInputSchema),
});

export type RecipeInput = z.infer<typeof RecipeInputSchema>;
export type RecipeIngredientInput = z.infer<typeof RecipeIngredientInputSchema>;
