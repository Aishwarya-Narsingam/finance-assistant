import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware just handles server-side redirects for the root path.
// Auth protection is handled client-side by auth-context.tsx since
// tokens are stored in localStorage (not cookies).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only handle the root path to avoid interfering with client-side auth
  if (pathname === '/') {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match only the root path to minimize middleware interference
     */
    '/',
  ],
};
