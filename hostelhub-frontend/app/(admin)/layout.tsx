"use client";

import { useState, useEffect, useRef } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { UserMenu } from "@/components/auth/user-menu";
import { HostelSwitcher } from "@/components/admin/HostelSwitcher";
import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import {
  Building, Settings, LayoutDashboard, Grid, Image as ImageIcon,
  Menu, X, CalendarCheck, Wallet, MessageSquare,
} from "lucide-react";

// ── Shared nav items helper ───────────────────────────────────────────────
function NavLinks({
  contextualNav,
  globalNav,
  pathname,
  activeId,
  onNavigate,
}: {
  contextualNav: { name: string; href: string; icon: React.ElementType }[];
  globalNav: { name: string; href: string; icon: React.ElementType }[];
  pathname: string;
  activeId?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="p-4 space-y-8">
      {/* Hostel-specific links */}
      {activeId && contextualNav.length > 0 && (
        <div>
          <h4 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Hostel
          </h4>
          <div className="space-y-1">
            {contextualNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.name === "Overview" && pathname === `/admin/hostels/${activeId}`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 active:bg-gray-100"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-600" : "text-gray-400"}`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Global links */}
      <div>
        <h4 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Account
        </h4>
        <div className="space-y-1">
          {globalNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 active:bg-gray-100"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-600" : "text-gray-400"}`}
                />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ─── Main Layout ───────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Fullscreen exception: hostel creation wizard
  if (pathname === "/admin/hostels/create") {
    return (
      <AuthGuard requiredRole="HOSTEL_ADMIN">
        <div className="min-h-screen bg-gray-50/50">{children}</div>
      </AuthGuard>
    );
  }

  const activeId = params?.id as string | undefined;

  const globalNav = [
    { name: "My Hostels", href: "/admin/hostels", icon: LayoutDashboard },
    { name: "Global Settings", href: "/admin/settings", icon: Settings },
  ];

  const contextualNav = activeId
    ? [
        { name: "Overview", href: `/admin/hostels/${activeId}`, icon: Building },
        { name: "Bookings", href: `/admin/hostels/${activeId}/bookings`, icon: CalendarCheck },
        { name: "Finances", href: `/admin/hostels/${activeId}/finances`, icon: Wallet },
        { name: "SMS Broadcast", href: `/admin/hostels/${activeId}/sms`, icon: MessageSquare },
        { name: "Media Gallery", href: `/admin/hostels/${activeId}/media`, icon: ImageIcon },
        { name: "Rooms & Variants", href: `/admin/hostels/${activeId}/variants`, icon: Grid },
        { name: "Hostel Settings", href: `/admin/hostels/${activeId}/settings`, icon: Settings },
      ]
    : [];

  return (
    <AuthGuard requiredRole="HOSTEL_ADMIN">
      <div className="min-h-screen bg-gray-50 flex flex-col">

        {/* ── Sticky Header ───────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white h-14 flex items-center px-4 sm:px-6 gap-3 shrink-0 shadow-sm">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand + hostel switcher */}
          <div className="flex items-center gap-1 min-w-0">
            <Link
              href="/admin/hostels"
              className="font-bold text-gray-900 tracking-tight hover:text-indigo-600 transition-colors shrink-0"
            >
              HostelHub
            </Link>
            <span className="text-gray-300 font-light mx-1 shrink-0">/</span>
            <div className="min-w-0 flex-1">
              <HostelSwitcher />
            </div>
          </div>

          <div className="flex-1" />
          <UserMenu loginHref="/admin/login" accent="indigo" />
        </header>

        {/* ── Mobile Drawer Overlay ────────────────────────────────────────── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <div
              ref={drawerRef}
              className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-left-4 duration-200"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
                <span className="font-bold text-gray-900 tracking-tight">HostelHub</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <NavLinks
                  contextualNav={contextualNav}
                  globalNav={globalNav}
                  pathname={pathname}
                  activeId={activeId}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Body (sidebar + main) ──────────────────────────────────────── */}
        <div className="flex-1 flex min-w-0">
          {/* Desktop sidebar — hidden on mobile */}
          <aside className="w-56 border-r border-gray-200 bg-white hidden md:flex flex-col shrink-0">
            <NavLinks
              contextualNav={contextualNav}
              globalNav={globalNav}
              pathname={pathname}
              activeId={activeId}
            />
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto bg-gray-50 min-w-0">
            <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
