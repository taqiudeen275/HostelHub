"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/api";

const LOGIN_PATHS: Record<UserRole, string> = {
  STUDENT: "/student/login",
  HOSTEL_ADMIN: "/admin/login",
  SUPER_ADMIN: "/superadmin/login",
};

const DASHBOARD_PATHS: Record<UserRole, string> = {
  STUDENT: "/student/dashboard",
  HOSTEL_ADMIN: "/admin/dashboard",
  SUPER_ADMIN: "/superadmin/dashboard",
};

interface AuthGuardProps {
  requiredRole: UserRole;
  children: React.ReactNode;
  /** Allow students to stay here even if onboarding is incomplete (e.g. the onboarding page itself). */
  allowIncompleteOnboarding?: boolean;
}

/**
 * Client-side gate for role-scoped route groups.
 * - Redirects unauthenticated users to the zone's login page (preserving `next`).
 * - Redirects users with the wrong role to their own dashboard.
 * - Bounces new students to /student/onboarding until they complete it.
 */
export function AuthGuard({
  requiredRole,
  children,
  allowIncompleteOnboarding = false,
}: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      const loginPath = LOGIN_PATHS[requiredRole];
      const next = encodeURIComponent(pathname || "/");
      router.replace(`${loginPath}?next=${next}`);
      return;
    }

    if (user.role !== requiredRole) {
      router.replace(DASHBOARD_PATHS[user.role]);
      return;
    }

    if (
      requiredRole === "STUDENT" &&
      !user.is_onboarding_complete &&
      !allowIncompleteOnboarding
    ) {
      router.replace("/student/onboarding");
    }
  }, [isLoading, user, requiredRole, router, pathname, allowIncompleteOnboarding]);

  if (isLoading || !user || user.role !== requiredRole) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (
    requiredRole === "STUDENT" &&
    !user.is_onboarding_complete &&
    !allowIncompleteOnboarding
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
