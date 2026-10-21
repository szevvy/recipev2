"use server";

import { revalidatePath } from "next/cache";
import { updateWeekStart } from "@/lib/settings";
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
