"use server";

import { revalidatePath } from "next/cache";
import { updatePostcode, updateWeekStart } from "@/lib/settings";
import type { WeekStart } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setWeekStartAction(day: number): Promise<ActionResult> {
  if (![0, 1, 2, 3, 4, 5, 6].includes(day)) {
    return { ok: false, error: "Invalid day" };
  }
  try {
    await updateWeekStart(day as WeekStart);
    revalidatePath("/settings");
    revalidatePath("/plan");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function setPostcodeAction(raw: string): Promise<ActionResult> {
  const trimmed = raw.trim();
  // Empty is allowed (clears the setting); anything non-empty must be 4 digits.
  if (trimmed && !/^\d{4}$/.test(trimmed)) {
    return { ok: false, error: "Enter a 4-digit postcode (or leave blank)" };
  }
  try {
    await updatePostcode(trimmed);
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export type RefreshPricesResult =
  | {
      ok: true;
      totals: {
        requested: number;
        products: number;
        notes: number;
        updated: number;
        outOfStock: number;
      };
      durationMs: number;
      warnings?: string[];
    }
  | { ok: false; error: string };

export async function refreshPricesAction(): Promise<RefreshPricesResult> {
  const { refreshPrices } = await import("@/lib/price-refresh");
  const result = await refreshPrices();
  if (result.ok) {
    revalidatePath("/shopping");
    revalidatePath("/settings");
  }
  return result;
}
