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
