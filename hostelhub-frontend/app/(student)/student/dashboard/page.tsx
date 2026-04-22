"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  MapPin,
  Navigation,
  Phone,
  Search,
  Settings2,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { bookingsApi, type Booking } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.first_name || "there";
  const initials =
    (user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      const rows = await bookingsApi.list();
      setBookings(rows);
    } catch {
      // Silent — dashboard is non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const activeBookings = bookings.filter((b) =>
    ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"].includes(b.status)
  );
  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;
  const pendingCount = bookings.filter((b) => b.status === "PENDING_PAYMENT").length;
  const totalSpent = bookings
    .filter((b) => ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(b.status))
    .reduce((sum, b) => sum + Number(b.price_paid), 0);

  const greeting = getGreeting();

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* ── Hero greeting ── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6 sm:p-8">
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-primary/5 blur-xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar size="lg" className="size-14 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
              {initials || "S"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome back, {firstName}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Here's what's happening with your accommodation.
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0 gap-2 self-start sm:self-center">
            <Link href="/hostels">
              <Search className="w-4 h-4" />
              Find hostels
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Stats cards ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          label="Active Bookings"
          value={isLoading ? null : activeBookings.length}
          icon={CalendarCheck}
          accentClass="text-primary bg-primary/10"
        />
        <StatsCard
          label="Confirmed"
          value={isLoading ? null : confirmedCount}
          icon={DoorOpen}
          accentClass="text-chart-3 bg-chart-3/10"
        />
        <StatsCard
          label="Pending Payment"
          value={isLoading ? null : pendingCount}
          icon={CreditCard}
          accentClass="text-chart-1 bg-chart-1/10"
        />
        <StatsCard
          label="Total Spent"
          value={isLoading ? null : `GH₵ ${totalSpent.toLocaleString()}`}
          icon={TrendingUp}
          accentClass="text-chart-5 bg-chart-5/10"
        />
      </section>

      {/* ── Active bookings & quick actions ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active bookings — 2 cols */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Active Bookings</h2>
            {activeBookings.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/student/bookings" className="gap-1.5">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeBookings.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <CalendarCheck className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">No active bookings</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-xs">
                  Find your perfect student accommodation from our verified hostels.
                </p>
                <Button asChild size="lg">
                  <Link href="/hostels" className="gap-1.5">
                    <Search className="w-4 h-4" />
                    Browse hostels
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeBookings.slice(0, 3).map((booking) => (
                <ActiveBookingCard key={booking.id} booking={booking} />
              ))}
              {activeBookings.length > 3 && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/student/bookings">
                    View {activeBookings.length - 3} more booking{activeBookings.length - 3 > 1 ? "s" : ""}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Quick actions — 1 col */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
          <div className="space-y-2">
            <QuickActionCard
              href="/hostels"
              icon={Building2}
              title="Browse Hostels"
              description="Find verified student accommodation near your campus"
              accentClass="bg-primary/10 text-primary"
            />
            <QuickActionCard
              href="/student/bookings"
              icon={CalendarCheck}
              title="My Bookings"
              description="Track reservations and manage your stays"
              accentClass="bg-chart-3/10 text-chart-3"
            />
            <QuickActionCard
              href="/student/settings"
              icon={Settings2}
              title="Settings & Privacy"
              description="Control who can see your name, phone, and photo"
              accentClass="bg-muted text-muted-foreground"
            />
          </div>

          {/* Tip card */}
          <Card className="bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Pro Tip</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Book with roommates to split costs! Shared-occupancy pricing divides the room price equally.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatsCard({
  label,
  value,
  icon: Icon,
  accentClass,
}: {
  label: string;
  value: string | number | null;
  icon: typeof CalendarCheck;
  accentClass: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex flex-col gap-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accentClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        {value === null ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {value}
          </p>
        )}
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </CardContent>
    </Card>
  );
}

function ActiveBookingCard({ booking }: { booking: Booking }) {
  const statusConfig: Record<
    string,
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    PENDING_PAYMENT: { label: "Awaiting Payment", variant: "outline" },
    CONFIRMED: { label: "Confirmed", variant: "default" },
    CHECKED_IN: { label: "Checked In", variant: "secondary" },
  };
  const config = statusConfig[booking.status] ?? {
    label: booking.status,
    variant: "outline" as const,
  };

  const hasCoords = booking.hostel.latitude && booking.hostel.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${booking.hostel.latitude},${booking.hostel.longitude}`
    : booking.hostel.address_text
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.hostel.address_text)}`
      : null;

  return (
    <Card className="group hover:ring-primary/30 hover:shadow-md transition-all duration-200">
      <CardContent className="p-0">
        {/* Top: hostel + status */}
        <Link href={`/student/bookings/${booking.id}`} className="flex items-start gap-4 p-4 pb-0">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {booking.hostel.name}
              </p>
              <Badge variant={config.variant} className="text-[10px] shrink-0">
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Room {booking.room.label} · {booking.variant.name} ·{" "}
              {booking.chosen_occupancy_at_booking === 1
                ? "Solo"
                : `${booking.chosen_occupancy_at_booking}-way share`}
            </p>
          </div>
        </Link>

        {/* Hostel info strip */}
        <div className="mx-4 mt-3 rounded-lg bg-muted/50 border px-3 py-2.5 space-y-1.5">
          {booking.hostel.address_text && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-1">{booking.hostel.address_text}</span>
            </div>
          )}
          {booking.hostel.owner_contact_phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <a
                href={`tel:${booking.hostel.owner_contact_phone}`}
                className="hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {booking.hostel.owner_contact_phone}
              </a>
            </div>
          )}
        </div>

        {/* Bottom: price + actions */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-bold text-foreground tabular-nums">
            GH₵ {Number(booking.price_paid).toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            {mapsUrl && (
              <Button variant="outline" size="xs" asChild className="gap-1">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Navigation className="w-3 h-3" />
                  Directions
                </a>
              </Button>
            )}
            <Button variant="ghost" size="xs" asChild className="gap-1">
              <Link href={`/student/bookings/${booking.id}`}>
                Details
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
  accentClass,
}: {
  href: string;
  icon: typeof Building2;
  title: string;
  description: string;
  accentClass: string;
}) {
  return (
    <Link href={href}>
      <Card className="group hover:ring-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
        <CardContent className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${accentClass}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
              {title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {description}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning ☀️";
  if (hour < 17) return "Good afternoon 🌤️";
  return "Good evening 🌙";
}
