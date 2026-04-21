"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/api";

const DASHBOARD_PATHS: Record<UserRole, string> = {
  STUDENT: "/student/dashboard",
  HOSTEL_ADMIN: "/admin/dashboard",
  SUPER_ADMIN: "/superadmin/dashboard",
};

/**
 * Wraps a login page. If the user is already authenticated, bounces them to
 * their role's dashboard (or to `?next=` if present and allowed). Otherwise
 * renders the children (the login form).
 */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoading || !user) return;
    const next = searchParams?.get("next");
    const target = next && next.startsWith("/") ? next : DASHBOARD_PATHS[user.role];
    router.replace(target);
  }, [isLoading, user, router, searchParams]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
