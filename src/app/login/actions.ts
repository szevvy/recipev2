"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import {
  AUTH_COOKIE,
  COOKIE_MAX_AGE_SECONDS,
  createSessionCookie,
} from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!password) return { error: "Enter the password." };

  const ok = await bcrypt.compare(password, serverEnv.APP_PASSWORD_HASH);
  if (!ok) return { error: "Wrong password." };

  const value = await createSessionCookie(serverEnv.AUTH_SECRET);
  const jar = await cookies();
  jar.set(AUTH_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  redirect(next.startsWith("/") ? next : "/");
}
