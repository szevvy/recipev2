"use server";

import { headers } from "next/headers";
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
  | { ok: true; runId: string; requested: number }
  | { ok: false; error: string };

// Fires the Apify run and returns immediately. The dataset comes back
// asynchronously via /api/apify/webhook, which writes to
// ingredient_prices. UI should poll bootstrap to see when the row-
// level fetched_at updates.
export async function refreshPricesAction(): Promise<RefreshPricesResult> {
  const secret = process.env.APIFY_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, error: "APIFY_WEBHOOK_SECRET env var not set" };
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) {
    return { ok: false, error: "Cannot determine host for webhook URL" };
  }
  const webhookUrl = `${proto}://${host}/api/apify/webhook?token=${encodeURIComponent(secret)}`;
  const { kickoffPriceRefresh } = await import("@/lib/price-refresh");
  const result = await kickoffPriceRefresh(webhookUrl);
  return result;
}
