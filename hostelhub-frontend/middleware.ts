import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES: Record<string, "STUDENT" | "HOSTEL_ADMIN" | "SUPER_ADMIN"> = {
  "/student": "STUDENT",
  "/admin": "HOSTEL_ADMIN",
  "/superadmin": "SUPER_ADMIN",
};

// Login routes are public within each zone — don't redirect them.
const PUBLIC_PATHS = [
  "/",
  "/hostels",
  "/student/login",
  "/admin/login",
  "/superadmin/login",
];

const LOGIN_PATHS: Record<string, string> = {
  STUDENT: "/student/login",
  HOSTEL_ADMIN: "/admin/login",
  SUPER_ADMIN: "/superadmin/login",
};

const AUTH_COOKIE = "hh_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths pass through.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Next internals, API, and files with extensions pass through.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const protectedPrefix = Object.keys(PROTECTED_PREFIXES).find((prefix) =>
    pathname.startsWith(prefix)
  );
  if (!protectedPrefix) {
    return NextResponse.next();
  }

  // We only check *presence* of the auth cookie here. Role enforcement happens
  // client-side in <AuthGuard> once the user is hydrated from /auth/me/.
  // This avoids decoding JWTs at the edge and still blocks unauth users.
  const hasAuth = request.cookies.get(AUTH_COOKIE)?.value === "1";
  if (hasAuth) {
    return NextResponse.next();
  }

  const roleRequired = PROTECTED_PREFIXES[protectedPrefix];
  const loginUrl = new URL(LOGIN_PATHS[roleRequired], request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
