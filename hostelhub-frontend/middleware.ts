import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES: Record<string, string> = {
  "/student": "STUDENT",
  "/admin": "HOSTEL_ADMIN",
  "/superadmin": "SUPER_ADMIN",
};

const PUBLIC_PATHS = [
  "/",
  "/hostels",
  "/student/login",
  "/admin/login",
  "/superadmin/login",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow static/api routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check which protected zone we're in
  const protectedPrefix = Object.keys(PROTECTED_ROUTES).find((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!protectedPrefix) {
    return NextResponse.next();
  }

  // For client-side navigation, token lives in localStorage (not cookies).
  // We check for a custom header that the frontend sets on navigations,
  // or fall back to redirecting to login — the auth context handles the rest.
  // 
  // Note: true cookie-based auth would go here in production.
  // For now, middleware just redirects unauthenticated-looking requests to login.
  const roleRequired = PROTECTED_ROUTES[protectedPrefix];

  // Build the login URL based on which zone is being accessed
  const loginPaths: Record<string, string> = {
    STUDENT: "/student/login",
    HOSTEL_ADMIN: "/admin/login",
    SUPER_ADMIN: "/superadmin/login",
  };

  const loginPath = loginPaths[roleRequired];
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
