"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck, CreditCard, Loader2, TrendingUp, Wallet,
} from "lucide-react";

import {
  type AdminStats,
  type Booking,
  type PaymentBrief,
  bookingsApi,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminHostelFinancesPage() {
  const { id: hostelId } = useParams() as { id: string };
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, b] = await Promise.all([
        bookingsApi.adminStats(hostelId),
        // Filter bookings server-side if possible, or just fetch all and filter
        // We need bookings to extract recent payments
        bookingsApi.list(),
      ]);
      setStats(s);
      setBookings(b.filter((booking) => booking.hostel.id === hostelId));
    } catch {
      toast.error("Could not load financial data.");
    } finally {
      setIsLoading(false);
    }
  }, [hostelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hostelStats = stats?.hostels.find((h) => h.id === hostelId);

  // Extract recent successful payments from bookings
  const recentPayments = useMemo(() => {
    const payments: (PaymentBrief & { booking: Booking })[] = [];
    bookings.forEach((b) => {
      if (b.payments) {
        b.payments.forEach((p) => {
          if (p.status === "SUCCESS" || p.status === "SUCCESSFUL") {
            payments.push({ ...p, booking: b });
          }
        });
      }
    });
    // Sort by verified_at descending
    return payments
      .sort((a, b) => {
        const timeA = a.verified_at ? new Date(a.verified_at).getTime() : 0;
        const timeB = b.verified_at ? new Date(b.verified_at).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 10); // Show top 10 recent payments
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hostelStats) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No financial data found</p>
          <p className="text-sm mt-1">
            Could not find financial statistics for this hostel.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Finances {hostelStats.name ? `· ${hostelStats.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your revenue, view bookings by room variant, and track recent payments.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue"
          value={`GH₵ ${hostelStats.total_revenue.toLocaleString()}`}
          icon={Wallet}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950"
        />
        <StatCard
          label="This Month"
          value={`GH₵ ${hostelStats.this_month_revenue.toLocaleString()}`}
          icon={TrendingUp}
          color="text-sky-600 dark:text-sky-400"
          bg="bg-sky-50 dark:bg-sky-950"
        />
        <StatCard
          label="Confirmed Bookings"
          value={String(hostelStats.confirmed_bookings)}
          icon={CalendarCheck}
          color="text-indigo-600 dark:text-indigo-400"
          bg="bg-indigo-50 dark:bg-indigo-950"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Variant */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Revenue by Variant
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="text-left text-xs uppercase text-muted-foreground tracking-wider border-b border-border">
                    <th className="px-4 py-3 font-semibold">Variant</th>
                    <th className="px-4 py-3 font-semibold text-center">Bookings</th>
                    <th className="px-4 py-3 font-semibold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hostelStats.variants.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        No variants found for this hostel.
                      </td>
                    </tr>
                  ) : (
                    hostelStats.variants.map((v) => (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{v.name}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {v.bookings_count}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          GH₵ {v.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Recent Successful Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="text-left text-xs uppercase text-muted-foreground tracking-wider border-b border-border">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No successful payments found yet.
                      </td>
                    </tr>
                  ) : (
                    recentPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {p.booking.student.first_name} {p.booking.student.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.booking.room.label}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {p.paystack_reference}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {p.verified_at
                            ? new Date(p.verified_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          +GH₵ {Number(p.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-foreground leading-tight mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
