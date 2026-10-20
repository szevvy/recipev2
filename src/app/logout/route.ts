import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
