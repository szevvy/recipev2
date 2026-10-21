import "server-only";
import { supabaseAdmin } from "./supabase";
import type { AppSettings, WeekStart } from "./types";

const DEFAULTS: AppSettings = {
  id: 1,
  week_starts_on: 1,
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
