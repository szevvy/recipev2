import { z } from "zod";

const emptyToNull = z.string().trim().transform((v) => (v.length === 0 ? null : v));

export const IngredientInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name too long"),
  default_unit: emptyToNull.pipe(z.string().max(20).nullable()),
  group_name: emptyToNull.pipe(z.string().max(50).nullable()),
  is_staple: z.boolean(),
});

export type IngredientInput = z.infer<typeof IngredientInputSchema>;

export function parseIngredientForm(fd: FormData): IngredientInput {
  const raw = {
    name: String(fd.get("name") ?? ""),
    default_unit: String(fd.get("default_unit") ?? ""),
    group_name: String(fd.get("group_name") ?? ""),
    is_staple: fd.get("is_staple") === "on" || fd.get("is_staple") === "true",
  };
  return IngredientInputSchema.parse(raw);
}
