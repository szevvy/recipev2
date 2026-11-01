"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setCategoryColorAction(
  name: string,
  color: string | null,
): Promise<ActionResult> {
  const supabase = supabaseAdmin();

  // Check if a row already exists so we can preserve its sort_order.
  // Upserting with the default sort_order=0 would silently move freshly-coloured
  // categories to the top of the list.
  const { data: existing } = await supabase
    .from("category_meta")
    .select("name")
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("category_meta")
      .update({ color })
      .eq("name", name);
    if (error) return { ok: false, error: error.message };
  } else {
    // New row: place it at the end (max + 1) so order is preserved.
    const { data: maxRow } = await supabase
      .from("category_meta")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? -1) + 1;
    const { error } = await supabase
      .from("category_meta")
      .insert({ name, color, sort_order: nextOrder });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/shopping");
  return { ok: true };
}

export async function setCategoryOrderAction(
  ordered: string[],
): Promise<ActionResult> {
  const supabase = supabaseAdmin();
  const rows = ordered.map((name, idx) => ({ name, sort_order: idx }));
  const { error } = await supabase
    .from("category_meta")
    .upsert(rows, { onConflict: "name" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/shopping");
  return { ok: true };
}
