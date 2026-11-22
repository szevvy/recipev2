import "server-only";
import { supabaseAdmin } from "./supabase";
import type { AppSettings, WeekStart } from "./types";

const DEFAULTS: AppSettings = {
  id: 1,
  week_starts_on: 1,
  postcode: null,
  updated_at: new Date(0).toISOString(),
};

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabaseAdmin()
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULTS;
  return data as unknown as AppSettings;
}

export async function updateWeekStart(day: WeekStart): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("app_settings")
    .update({ week_starts_on: day })
    .eq("id", 1);
  if (error) {
    const { error: insErr } = await supabase
      .from("app_settings")
      .insert({ id: 1, week_starts_on: day });
    if (insErr) throw new Error(insErr.message);
  }
}

// Normalises to a trimmed 4-digit AU postcode or null.
function normalisePostcode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;
  return trimmed;
}

export async function updatePostcode(raw: string): Promise<void> {
  const supabase = supabaseAdmin();
  const postcode = normalisePostcode(raw);
  const { error } = await supabase
    .from("app_settings")
    .update({ postcode })
    .eq("id", 1);
  if (error) {
    const { error: insErr } = await supabase
      .from("app_settings")
      .insert({ id: 1, postcode });
    if (insErr) throw new Error(insErr.message);
  }
}
