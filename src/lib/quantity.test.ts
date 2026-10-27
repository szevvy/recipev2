import { describe, it, expect } from "vitest";
import {
  parseQuantity,
  normalizeUnit,
  formatQuantity,
  scaleQuantity,
  mergeShoppingItems,
} from "./quantity";

describe("parseQuantity", () => {
  it("parses decimals and units with no space", () => {
    expect(parseQuantity("500g")).toEqual({ qty: 500, unit: "g", raw: "500g" });
    expect(parseQuantity("400ml")).toEqual({ qty: 400, unit: "ml", raw: "400ml" });
  });

  it("parses number + unit with space", () => {
    expect(parseQuantity("2 cups")).toEqual({ qty: 2, unit: "cup", raw: "2 cups" });
    expect(parseQuantity("1 tsp")).toEqual({ qty: 1, unit: "tsp", raw: "1 tsp" });
  });

  it("parses mixed fractions", () => {
    const r = parseQuantity("1 1/2 cups");
    expect(r.qty).toBeCloseTo(1.5);
    expect(r.unit).toBe("cup");
  });

  it("parses plain fractions", () => {
    const r = parseQuantity("1/8 cup");
    expect(r.qty).toBeCloseTo(0.125);
    expect(r.unit).toBe("cup");
  });

  it("parses bare numbers (no unit)", () => {
    expect(parseQuantity("8")).toEqual({ qty: 8, unit: null, raw: "8" });
    expect(parseQuantity("2.5")).toEqual({ qty: 2.5, unit: null, raw: "2.5" });
  });

  it("normalizes plural units", () => {
    expect(parseQuantity("2 cloves").unit).toBe("clove");
    expect(parseQuantity("3 tablespoons").unit).toBe("tbsp");
  });

  it("fixes known typos", () => {
    expect(parseQuantity("2tbps").unit).toBe("tbsp");
  });

  it("treats pure text as un-parseable", () => {
    expect(parseQuantity("to taste")).toEqual({ qty: null, unit: null, raw: "to taste" });
  });

  it("ignores empty/null", () => {
    expect(parseQuantity("").qty).toBeNull();
    expect(parseQuantity(null).qty).toBeNull();
    expect(parseQuantity("   ").qty).toBeNull();
  });
});

describe("normalizeUnit", () => {
  it("maps common synonyms", () => {
    expect(normalizeUnit("Cups")).toBe("cup");
    expect(normalizeUnit("Tablespoons")).toBe("tbsp");
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("litres")).toBe("L");
  });

  it("returns unknown units unchanged (lowercased)", () => {
    expect(normalizeUnit("Dash")).toBe("dash");
  });

  it("returns null for empty", () => {
    expect(normalizeUnit("")).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit("   ")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("formats integers plainly", () => {
    expect(formatQuantity(3, "cup")).toBe("3 cup");
    expect(formatQuantity(2, null)).toBe("2");
  });

  it("uses unicode fractions where close", () => {
    expect(formatQuantity(0.5, "cup")).toBe("½ cup");
    expect(formatQuantity(1.5, "cup")).toBe("1 ½ cup");
    expect(formatQuantity(0.25, "tsp")).toBe("¼ tsp");
    expect(formatQuantity(0.75, "cup")).toBe("¾ cup");
  });

  it("falls back to decimal for weird numbers", () => {
    expect(formatQuantity(1.33, "cup")).toBe("1 ⅓ cup");
    expect(formatQuantity(1.1, "cup")).toBe("1.1 cup");
  });
});

describe("scaleQuantity", () => {
  it("scales the numeric portion", () => {
    const r = scaleQuantity(parseQuantity("2 cups"), 1.5);
    expect(r.qty).toBe(3);
    expect(r.unit).toBe("cup");
  });

  it("leaves unparseable unchanged", () => {
    const r = scaleQuantity(parseQuantity("to taste"), 2);
    expect(r.qty).toBeNull();
  });

  it("short-circuits when factor is 1", () => {
    const r = scaleQuantity(parseQuantity("1 cup"), 1);
    expect(r.qty).toBe(1);
  });
});

describe("mergeShoppingItems", () => {
  it("sums same ingredient + same unit", () => {
    const r = mergeShoppingItems([
      { ingredient_id: "A", quantity: "1/2 cup", servings_factor: 1 },
      { ingredient_id: "A", quantity: "2 cups", servings_factor: 1 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].ingredient_id).toBe("A");
    expect(r[0].quantity).toBe("2 ½ cup");
  });

  it("keeps same ingredient with different units as separate rows", () => {
    const r = mergeShoppingItems([
      { ingredient_id: "A", quantity: "500g", servings_factor: 1 },
      { ingredient_id: "A", quantity: "1 cup", servings_factor: 1 },
    ]);
    expect(r).toHaveLength(2);
  });

  it("scales by servings_factor", () => {
    const r = mergeShoppingItems([
      { ingredient_id: "A", quantity: "2 cups", servings_factor: 1.5 },
    ]);
    expect(r[0].quantity).toBe("3 cup");
  });

  it("keeps unparseable quantities as separate rows", () => {
    const r = mergeShoppingItems([
      { ingredient_id: "A", quantity: "2 cups", servings_factor: 1 },
      { ingredient_id: "A", quantity: "to taste", servings_factor: 1 },
    ]);
    expect(r).toHaveLength(2);
    expect(r.some((x) => x.quantity === "to taste")).toBe(true);
  });

  it("merges plural + singular + abbreviation of same unit", () => {
    const r = mergeShoppingItems([
      { ingredient_id: "A", quantity: "1 tablespoon", servings_factor: 1 },
      { ingredient_id: "A", quantity: "2 tbsp", servings_factor: 1 },
      { ingredient_id: "A", quantity: "1 tbps", servings_factor: 1 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].quantity).toBe("4 tbsp");
  });

  it("merges numeric-only (no unit) with numeric-only (no unit)", () => {
    const r = mergeShoppingItems([
      { ingredient_id: "A", quantity: "2", servings_factor: 1 },
      { ingredient_id: "A", quantity: "3", servings_factor: 1 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].quantity).toBe("5");
  });

  it("doesn't merge across different ingredients", () => {
    const r = mergeShoppingItems([
      { ingredient_id: "A", quantity: "2 cups", servings_factor: 1 },
      { ingredient_id: "B", quantity: "2 cups", servings_factor: 1 },
    ]);
    expect(r).toHaveLength(2);
  });
});
