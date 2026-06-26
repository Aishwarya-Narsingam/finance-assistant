import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Root path is the landing page - no auth needed
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Auth routes and onboarding don't need protection
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
