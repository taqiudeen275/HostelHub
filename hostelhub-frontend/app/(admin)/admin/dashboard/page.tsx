"use client";

import { useEffect, useState } from "react";
import { adminHostelsApi, bookingsApi, type AdminStats, type Booking, type Hostel } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Building2, Clock, CheckCircle, XCircle, Plus, ArrowRight,
  Sparkles, Wallet, Users, CalendarCheck, TrendingUp, Loader2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const displayName =
    user?.hostel_admin_profile?.business_name || user?.full_name || "Partner";

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminHostelsApi.list(),
      bookingsApi.adminStats(),
      bookingsApi.list(),
    ])
      .then(([h, s, b]) => {
        setHostels(h);
        setStats(s);
        setRecentBookings(b.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const t = stats?.totals;

  const kpiCards = [
    {
      label: "Total Revenue",
      value: t ? `GH₵ ${t.total_revenue.toLocaleString()}` : "—",
      sub: t ? `GH₵ ${t.this_month_revenue.toLocaleString()} this month` : "",
      icon: Wallet,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      label: "Total Bookings",
      value: t ? String(t.total_bookings) : "—",
      sub: t ? `${t.confirmed_bookings} confirmed` : "",
      icon: CalendarCheck,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950",
    },
    {
      label: "Rooms",
      value: t ? `${t.occupied_rooms} / ${t.total_rooms}` : "—",
      sub: "occupied / total",
      icon: Building2,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-950",
    },
    {
      label: "Pending Check-ins",
      value: t ? String(t.pending_checkins) : "—",
      sub: "confirmed, awaiting arrival",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium mb-3 dark:bg-indigo-950 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hostel Admin Panel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {displayName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s a snapshot of your hostel portfolio.
          </p>
        </div>
        <Button asChild className="gap-2 self-start">
          <Link href="/admin/hostels/create">
            <Plus className="w-4 h-4" />
            Add Hostel
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-5 flex flex-col gap-3">
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <span className="text-2xl font-bold text-foreground">{card.value}</span>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                  {card.sub && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{card.sub}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two-column: My Hostels + Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Hostels */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">My Hostels</h2>
              <Link
                href="/admin/hostels"
                className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : hostels.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No hostels yet</p>
                <p className="text-sm mt-1">Get started by adding your first hostel listing.</p>
                <Button asChild size="sm" className="mt-4 gap-2">
                  <Link href="/admin/hostels/create">
                    <Plus className="w-4 h-4" /> Create Hostel
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {hostels.slice(0, 5).map((h) => {
                  const hStat = stats?.hostels.find((hs) => hs.id === h.id);
                  return (
                    <Link
                      key={h.id}
                      href={`/admin/hostels/${h.id}`}
                      className="flex items-center justify-between py-3.5 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors group gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{h.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{h.address_text}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hStat && hStat.total_revenue > 0 && (
                          <span className="text-xs font-medium text-muted-foreground hidden sm:block">
                            GH₵ {hStat.total_revenue.toLocaleString()}
                          </span>
                        )}
                        <StatusBadge status={h.status} />
                        <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">Recent Bookings</h2>
              {hostels.length > 0 && (
                <Link
                  href={`/admin/hostels/${hostels[0]?.id}/bookings`}
                  className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No bookings yet</p>
                <p className="text-sm mt-1">Bookings will appear here once students start booking.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between py-3.5 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {b.student.first_name} {b.student.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.hostel.name} · {b.room.label} · {b.variant.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-foreground">
                        GH₵ {Number(b.price_paid).toLocaleString()}
                      </span>
                      <BookingStatusBadge status={b.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-hostel revenue breakdown */}
      {stats && stats.hostels.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Revenue by Hostel
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground tracking-wider border-b border-border">
                    <th className="pb-3 font-semibold">Hostel</th>
                    <th className="pb-3 font-semibold text-center">Rooms</th>
                    <th className="pb-3 font-semibold text-center">Bookings</th>
                    <th className="pb-3 font-semibold text-right">This Month</th>
                    <th className="pb-3 font-semibold text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.hostels.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3">
                        <Link
                          href={`/admin/hostels/${h.id}/finances`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {h.name}
                        </Link>
                      </td>
                      <td className="py-3 text-center text-muted-foreground">
                        {h.occupied_rooms}/{h.total_rooms}
                      </td>
                      <td className="py-3 text-center text-muted-foreground">
                        {h.total_bookings}
                      </td>
                      <td className="py-3 text-right font-medium text-foreground">
                        GH₵ {h.this_month_revenue.toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-bold text-foreground">
                        GH₵ {h.total_revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Manage Hostels", href: "/admin/hostels", desc: "View and edit your hostel listings" },
          {
            label: "All Bookings",
            href: hostels.length > 0 ? `/admin/hostels/${hostels[0]?.id}/bookings` : "/admin/hostels",
            desc: "Track and manage student bookings",
          },
          {
            label: "Finances",
            href: hostels.length > 0 ? `/admin/hostels/${hostels[0]?.id}/finances` : "/admin/hostels",
            desc: "View revenue and payment details",
          },
        ].map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="bg-card rounded-xl border border-border shadow-sm p-5 hover:border-primary/30 hover:shadow-md transition-all group"
          >
            <p className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center justify-between text-foreground">
              {link.label}
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "APPROVED"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "PENDING"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : status === "REJECTED"
      ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    PENDING_PAYMENT: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    CONFIRMED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    CHECKED_IN: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    CHECKED_OUT: "bg-muted text-muted-foreground",
    CANCELLED: "bg-muted text-muted-foreground/60",
    EXPIRED: "bg-muted text-muted-foreground/60",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tone[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace("_", " ").toLowerCase()}
    </span>
  );
}
