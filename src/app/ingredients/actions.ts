"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { parseIngredientForm } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => i.message).join(", ");
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

export async function createIngredientAction(fd: FormData): Promise<ActionResult> {
  try {
    const input = parseIngredientForm(fd);
    const { error } = await supabaseAdmin().from("ingredients").insert({
      name: input.name,
      default_unit: input.default_unit,
      group_name: input.group_name,
      is_staple: input.is_staple,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, error: `"${input.name}" already exists.` };
      return { ok: false, error: error.message };
    }
    revalidatePath("/ingredients");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function updateIngredientAction(id: string, fd: FormData): Promise<ActionResult> {
  try {
    const input = parseIngredientForm(fd);
    const { error } = await supabaseAdmin()
      .from("ingredients")
      .update({
        name: input.name,
        default_unit: input.default_unit,
        group_name: input.group_name,
        is_staple: input.is_staple,
      })
      .eq("id", id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: `"${input.name}" already exists.` };
      return { ok: false, error: error.message };
    }
    revalidatePath("/ingredients");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function deleteIngredientAction(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin().from("ingredients").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "This ingredient is used by one or more recipes." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/ingredients");
  return { ok: true };
}

export async function toggleStapleAction(id: string, isStaple: boolean): Promise<ActionResult> {
  const { error } = await supabaseAdmin()
    .from("ingredients")
    .update({ is_staple: isStaple })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ingredients");
  return { ok: true };
}
