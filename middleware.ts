import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { users } from '@/src/db/schema';
import { SESSION_COOKIE, getSessionSecret, readSessionToken } from '@/src/lib/auth/session-token';
import { STAFF_COOKIE } from '@/src/lib/auth/staff-token';
import { readStaffSession } from '@/src/lib/auth/staff-accounts';

const isSellerRoute = (path: string) => path.startsWith('/dashboard/seller');
const isAdminRoute = (path: string) => path.startsWith('/admin');
// the admin area sections a moderator can't open
const ADMIN_ONLY = [
  '/admin/database',
  '/admin/banners',
  '/admin/journal',
  '/admin/categories',
  '/admin/techniques',
  '/admin/staff',
];
const isAdminOnlyRoute = (path: string) => ADMIN_ONLY.some((prefix) => path.startsWith(prefix));
const isAuthenticatedRoute = (path: string) =>
  ['/dashboard', '/become-seller', '/choose-role', '/favorites'].some((prefix) => path.startsWith(prefix));

// Role is read from our own `users` table, the authorization source of truth
// everywhere else in this project; the session cookie only carries the user id.
export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // The admin area is for staff signed in at /sanatadmin (login and password),
  // not for Telegram accounts. Some sections are for the admin only.
  if (isAdminRoute(path)) {
    const role = (await readStaffSession(req.cookies.get(STAFF_COOKIE)?.value))?.role;
    if (!role) return NextResponse.redirect(new URL('/sanatadmin', req.url));
    if (isAdminOnlyRoute(path) && role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/sellers', req.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticatedRoute(path) && !isSellerRoute(path)) {
    return NextResponse.next();
  }

  const userId = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value, getSessionSecret());
  const [user] = userId ? await getDb().select().from(users).where(eq(users.id, userId)) : [];
  if (!user) {
    // come back here after signing in
    const signIn = new URL('/sign-in', req.url);
    signIn.searchParams.set('next', path + req.nextUrl.search);
    return NextResponse.redirect(signIn);
  }

  if (isSellerRoute(path) && user.role !== 'seller') {
    return NextResponse.redirect(new URL('/become-seller/status', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // The postgres driver needs Node.js TCP sockets, which the edge runtime lacks.
  runtime: 'nodejs',
  matcher: ['/dashboard/:path*', '/become-seller/:path*', '/choose-role/:path*', '/admin/:path*', '/favorites'],
};
