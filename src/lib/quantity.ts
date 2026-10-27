// Parses free-text recipe quantities ("500g", "1 1/2 cups", "2 cloves") into
// numeric qty + unit so we can scale by servings and merge across recipes.

export type Parsed = {
  qty: number | null;
  unit: string | null;
  raw: string;
};

// Normalize unit variants so merging treats them as equal.
const UNIT_ALIASES: Record<string, string> = {
  cup: "cup", cups: "cup",
  tbsp: "tbsp", tbs: "tbsp", tbps: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  g: "g", gram: "g", grams: "g", gm: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  mg: "mg", milligram: "mg", milligrams: "mg",
  ml: "ml", milliliter: "ml", millilitre: "ml", milliliters: "ml", millilitres: "ml",
  l: "L", liter: "L", litre: "L", liters: "L", litres: "L",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  can: "can", cans: "can", tin: "can", tins: "can",
  clove: "clove", cloves: "clove",
  slice: "slice", slices: "slice",
  piece: "piece", pieces: "piece",
  bunch: "bunch", bunches: "bunch",
  pack: "pack", packs: "pack", packet: "pack", packets: "pack",
  jar: "jar", jars: "jar",
  bottle: "bottle", bottles: "bottle",
  item: "item", items: "item", unit: "item", units: "item",
};

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const lower = unit.trim().toLowerCase();
  if (!lower) return null;
  return UNIT_ALIASES[lower] ?? lower;
}

// Parses "1 1/2 cups" → { qty: 1.5, unit: "cup" }
// Parses "500g" → { qty: 500, unit: "g" }
// Parses "to taste" → { qty: null, unit: null }
export function parseQuantity(input: string | null | undefined): Parsed {
  const raw = String(input ?? "").trim();
  if (!raw) return { qty: null, unit: null, raw };

  // Mixed fraction: "1 1/2 cups" or "2 1/4 tsp"
  let m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)(?:\s+(.*))?$/.exec(raw);
  if (m) {
    const qty = parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
    return { qty, unit: normalizeUnit(m[4] ?? null), raw };
  }

  // Plain fraction: "1/2 cup", "3/4 tsp"
  m = /^(\d+)\s*\/\s*(\d+)(?:\s+(.*))?$/.exec(raw);
  if (m) {
    const qty = parseInt(m[1], 10) / parseInt(m[2], 10);
    return { qty, unit: normalizeUnit(m[3] ?? null), raw };
  }

  // Decimal or integer with optional unit: "500g", "1.5 cups", "2"
  m = /^(\d+(?:\.\d+)?)(?:\s*(.*))?$/.exec(raw);
  if (m) {
    const qty = parseFloat(m[1]);
    return { qty, unit: normalizeUnit(m[2] ?? null), raw };
  }

  return { qty: null, unit: null, raw };
}

const COMMON_FRACTIONS: Array<[number, string]> = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const whole = Math.floor(n);
  const frac = n - whole;
  for (const [v, s] of COMMON_FRACTIONS) {
    if (Math.abs(frac - v) < 0.02) {
      return whole === 0 ? s : `${whole} ${s}`;
    }
  }
  return Number(n.toFixed(2)).toString();
}

export function formatQuantity(qty: number | null, unit: string | null): string {
  if (qty == null) return unit ?? "";
  const num = formatNumber(qty);
  return unit ? `${num} ${unit}` : num;
}

// Scale the numeric portion only. Unparseable quantities pass through unchanged.
export function scaleQuantity(parsed: Parsed, factor: number): Parsed {
  if (parsed.qty == null) return parsed;
  if (factor === 1) return parsed;
  return { ...parsed, qty: parsed.qty * factor };
}

// Group items by (ingredient_id, normalized_unit) and sum. Items where the
// quantity didn't parse into a number stay as separate rows (we display raw).
export type MergeInput = {
  ingredient_id: string;
  quantity: string | null;
  servings_factor: number;
};

export type MergeOutput = {
  ingredient_id: string;
  quantity: string | null;
};

export function mergeShoppingItems(inputs: MergeInput[]): MergeOutput[] {
  type Bucket = { qty: number; unit: string | null };
  const parsedBuckets = new Map<string, Bucket>();
  const unparsed: MergeOutput[] = [];

  for (const item of inputs) {
    const parsed = parseQuantity(item.quantity);
    if (parsed.qty == null) {
      unparsed.push({
        ingredient_id: item.ingredient_id,
        quantity: parsed.raw || null,
      });
      continue;
    }
    const scaled = scaleQuantity(parsed, item.servings_factor);
    const key = `${item.ingredient_id}|${scaled.unit ?? ""}`;
    const existing = parsedBuckets.get(key);
    if (existing) {
      existing.qty += scaled.qty!;
    } else {
      parsedBuckets.set(key, { qty: scaled.qty!, unit: scaled.unit });
    }
  }

  const merged: MergeOutput[] = [];
  for (const [key, bucket] of parsedBuckets) {
    const [ingredient_id] = key.split("|");
    merged.push({
      ingredient_id,
      quantity: formatQuantity(bucket.qty, bucket.unit) || null,
    });
  }

  return [...merged, ...unparsed];
}
