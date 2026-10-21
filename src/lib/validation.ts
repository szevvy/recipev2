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
  is_staple: z.boolean(),
});

export type IngredientInput = z.infer<typeof IngredientInputSchema>;

export function parseIngredientForm(fd: FormData): IngredientInput {
  const raw = {
    name: String(fd.get("name") ?? ""),
    group_name: String(fd.get("group_name") ?? ""),
    is_staple: fd.get("is_staple") === "on" || fd.get("is_staple") === "true",
  };
  return IngredientInputSchema.parse(raw);
}

export const RecipeIngredientInputSchema = z.object({
  ingredient_id: z.string().uuid().nullable(),
  ingredient_name: z.string().trim().min(1, "Pick an ingredient").max(80),
  qty: z.number({ error: "Qty required" }).positive("Qty must be > 0"),
  unit: trimmedNullable(20),
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
