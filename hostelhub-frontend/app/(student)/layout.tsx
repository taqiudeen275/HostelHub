"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  CalendarCheck,
  LayoutDashboard,
  Menu,
  Settings2,
  X,
} from "lucide-react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/bookings", label: "My Bookings", icon: CalendarCheck },
  { href: "/hostels", label: "Find Hostels", icon: Building2 },
  { href: "/student/settings", label: "Settings", icon: Settings2 },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AuthGuard requiredRole="STUDENT">
      <div className="min-h-screen bg-background">
        {/* ── Header ── */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 sm:px-6">
            {/* Logo */}
            <Link
              href="/student/dashboard"
              className="flex items-center gap-2 mr-6 shrink-0"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                H
              </div>
              <span className="font-bold text-foreground hidden sm:inline-block">
                HostelHub
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || (href !== "/student/dashboard" && pathname?.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex-1" />

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            <UserMenu
              loginHref="/student/login"
              settingsHref="/student/settings"
              accent="primary"
            />
          </div>

          {/* Mobile nav drawer */}
          {mobileOpen && (
            <div className="md:hidden border-t bg-background animate-in slide-in-from-top-2 duration-200">
              <nav className="flex flex-col gap-1 p-3">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href || (href !== "/student/dashboard" && pathname?.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </header>

        {/* ── Main content ── */}
        <main className="px-4 sm:px-6 py-6 md:py-8">{children}</main>
      </div>
    </AuthGuard>
  );
}
