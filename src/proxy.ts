import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySessionCookie } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return new NextResponse("AUTH_SECRET not configured", { status: 500 });
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const ok = await verifySessionCookie(secret, cookie);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Protect everything except /login, Next internals, and static assets.
    "/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
