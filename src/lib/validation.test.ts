import { describe, it, expect } from "vitest";
import { parseIngredientForm, IngredientInputSchema } from "./validation";

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
      fd({
        name: "Flour",
        default_unit: "g",
        group_name: "Baking",
        is_staple: "on",
      }),
    );
    expect(result).toEqual({
      name: "Flour",
      default_unit: "g",
      group_name: "Baking",
      is_staple: true,
    });
  });

  it("trims whitespace on all string fields", () => {
    const result = parseIngredientForm(
      fd({ name: "  Milk  ", default_unit: " ml ", group_name: "  Dairy  " }),
    );
    expect(result.name).toBe("Milk");
    expect(result.default_unit).toBe("ml");
    expect(result.group_name).toBe("Dairy");
  });

  it("converts empty unit and group to null", () => {
    const result = parseIngredientForm(fd({ name: "Salt" }));
    expect(result.default_unit).toBeNull();
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

  it("rejects unit longer than 20 chars", () => {
    expect(() =>
      parseIngredientForm(fd({ name: "x", default_unit: "u".repeat(21) })),
    ).toThrow();
  });
});

describe("IngredientInputSchema direct", () => {
  it("accepts null values for optional string fields", () => {
    const result = IngredientInputSchema.parse({
      name: "Eggs",
      default_unit: "",
      group_name: "",
      is_staple: false,
    });
    expect(result.default_unit).toBeNull();
    expect(result.group_name).toBeNull();
  });
});
