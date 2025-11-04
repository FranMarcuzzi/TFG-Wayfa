import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedPaths = ['/dashboard', '/trip'];
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath) {
    const supabaseAuthToken = request.cookies.get('sb-access-token');

    if (!supabaseAuthToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  const authPaths = ['/login', '/register'];
  const isAuthPath = authPaths.includes(pathname);

  if (isAuthPath) {
    const supabaseAuthToken = request.cookies.get('sb-access-token');

    if (supabaseAuthToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
