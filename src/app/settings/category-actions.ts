"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setCategoryColorAction(
  name: string,
  color: string | null,
): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("category_meta")
    .upsert({ name, color }, { onConflict: "name" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/shopping");
  return { ok: true };
}

export async function setCategoryOrderAction(
  ordered: string[],
): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const rows = ordered.map((name, idx) => ({ name, sort_order: idx }));
  // Upsert each — PostgREST allows an array upsert on conflict.
  const { error } = await supabase
    .from("category_meta")
    .upsert(rows, { onConflict: "name" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/shopping");
  return { ok: true };
}
