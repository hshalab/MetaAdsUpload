import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Pages a non-admin (video editor / strategist without admin) may visit.
// Everything else redirects to /my-work. APIs guard themselves.
const EDITOR_PAGE_PREFIXES = ["/my-work", "/timer", "/review", "/e/", "/r/"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api")) return NextResponse.next();

  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  if (req.auth && role && role !== "admin") {
    const allowed = EDITOR_PAGE_PREFIXES.some(
      (p) => pathname === p || pathname === p.replace(/\/$/, "") || pathname.startsWith(p)
    );
    if (!allowed) {
      return NextResponse.redirect(new URL("/my-work", req.nextUrl));
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!login|register|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
