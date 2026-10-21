import { describe, it, expect } from "vitest";
import {
  parseIngredientForm,
  IngredientInputSchema,
  RecipeInputSchema,
} from "./validation";

function fd(entries: Record<string, string | undefined>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (v !== undefined) f.append(k, v);
  }
  return f;
}

describe("parseIngredientForm", () => {
  it("parses a full row", () => {
    const result = parseIngredientForm(
      fd({ name: "Flour", group_name: "Baking", is_staple: "on" }),
    );
    expect(result).toEqual({
      name: "Flour",
      group_name: "Baking",
      is_staple: true,
    });
  });

  it("trims whitespace on string fields", () => {
    const result = parseIngredientForm(fd({ name: "  Milk  ", group_name: "  Dairy  " }));
    expect(result.name).toBe("Milk");
    expect(result.group_name).toBe("Dairy");
  });

  it("converts empty group to null", () => {
    const result = parseIngredientForm(fd({ name: "Salt" }));
    expect(result.group_name).toBeNull();
  });

  it("defaults is_staple to false when checkbox omitted", () => {
    const result = parseIngredientForm(fd({ name: "Pepper" }));
    expect(result.is_staple).toBe(false);
  });

  it("rejects empty name", () => {
    expect(() => parseIngredientForm(fd({ name: "   " }))).toThrow();
  });

  it("rejects name longer than 80 chars", () => {
    expect(() => parseIngredientForm(fd({ name: "a".repeat(81) }))).toThrow();
  });
});

describe("IngredientInputSchema direct", () => {
  it("accepts null value for group_name", () => {
    const result = IngredientInputSchema.parse({
      name: "Eggs",
      group_name: "",
      is_staple: false,
    });
    expect(result.group_name).toBeNull();
  });
});

describe("RecipeInputSchema", () => {
  const base = {
    name: "Pasta",
    default_servings: 4,
    ingredients: [],
  };

  it("accepts the minimum valid recipe", () => {
    const r = RecipeInputSchema.parse(base);
    expect(r.name).toBe("Pasta");
    expect(r.default_servings).toBe(4);
    expect(r.prep_minutes).toBeNull();
    expect(r.cook_minutes).toBeNull();
    expect(r.source_url).toBeNull();
    expect(r.ingredients).toEqual([]);
  });

  it("rejects empty name", () => {
    expect(() => RecipeInputSchema.parse({ ...base, name: "   " })).toThrow();
  });

  it("rejects non-positive servings", () => {
    expect(() => RecipeInputSchema.parse({ ...base, default_servings: 0 })).toThrow();
    expect(() => RecipeInputSchema.parse({ ...base, default_servings: -1 })).toThrow();
  });

  it("coerces empty optional strings to null", () => {
    const r = RecipeInputSchema.parse({
      ...base,
      source_url: "",
      image_url: "   ",
      instructions: "",
      notes: "",
    });
    expect(r.source_url).toBeNull();
    expect(r.image_url).toBeNull();
    expect(r.instructions).toBeNull();
    expect(r.notes).toBeNull();
  });

  it("validates ingredient rows", () => {
    const good = RecipeInputSchema.parse({
      ...base,
      ingredients: [
        {
          ingredient_id: "11111111-1111-4111-8111-111111111111",
          ingredient_name: "Flour",
          qty: 2,
          unit: "cup",
          note: null,
        },
      ],
    });
    expect(good.ingredients).toHaveLength(1);

    expect(() =>
      RecipeInputSchema.parse({
        ...base,
        ingredients: [
          {
            ingredient_id: "not-a-uuid",
            ingredient_name: "Flour",
            qty: 1,
            unit: null,
            note: null,
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      RecipeInputSchema.parse({
        ...base,
        ingredients: [
          {
            ingredient_id: "11111111-1111-4111-8111-111111111111",
            ingredient_name: "Flour",
            qty: 0,
            unit: null,
            note: null,
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts a row with no ingredient_id but a name (freshly-typed, not yet matched)", () => {
    const r = RecipeInputSchema.parse({
      ...base,
      ingredients: [
        {
          ingredient_id: null,
          ingredient_name: "Fresh basil",
          qty: 1,
          unit: "bunch",
          note: null,
        },
      ],
    });
    expect(r.ingredients[0].ingredient_id).toBeNull();
    expect(r.ingredients[0].ingredient_name).toBe("Fresh basil");
  });

  it("rejects a row with no name", () => {
    expect(() =>
      RecipeInputSchema.parse({
        ...base,
        ingredients: [
          {
            ingredient_id: null,
            ingredient_name: "   ",
            qty: 1,
            unit: null,
            note: null,
          },
        ],
      }),
    ).toThrow();
  });
});
