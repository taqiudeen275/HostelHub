"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Search,
  XCircle,
} from "lucide-react";

import { CountdownTimer } from "@/components/auth/countdown-timer";
import {
  type Booking,
  type BookingStatus,
  bookingsApi,
  ApiError,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const ACTIVE_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CHECKED_IN",
];

export default function StudentBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await bookingsApi.list();
      setBookings(rows);
    } catch {
      toast.error("Failed to load your bookings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const active = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));
  const past = bookings.filter((b) => !ACTIVE_STATUSES.includes(b.status));

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            My Bookings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your reservations and manage your stays.
          </p>
        </div>
        <Button asChild className="gap-1.5 shrink-0 self-start sm:self-auto">
          <Link href="/hostels">
            <Search className="w-4 h-4" />
            Find hostels
          </Link>
        </Button>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <Tabs defaultValue="active">
          <TabsList variant="line" className="mb-6">
            <TabsTrigger value="active" className="gap-1.5">
              Active
              {active.length > 0 && (
                <Badge variant="default" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                  {active.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-1.5">
              Past
              {past.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                  {past.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {active.length === 0 ? (
              <EmptyTabState
                message="You have no active bookings right now."
                actionLabel="Browse hostels"
                actionHref="/hostels"
              />
            ) : (
              <div className="space-y-3">
                {active.map((b) => (
                  <BookingRow key={b.id} booking={b} onCancelled={fetchBookings} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {past.length === 0 ? (
              <EmptyTabState
                message="No past bookings to show."
              />
            ) : (
              <div className="space-y-3">
                {past.map((b) => (
                  <BookingRow key={b.id} booking={b} onCancelled={fetchBookings} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/* ── Empty states ── */

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No bookings yet</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
          Browse verified hostels near your campus and book your perfect accommodation.
        </p>
        <Button asChild size="lg" className="gap-1.5">
          <Link href="/hostels">
            <Search className="w-4 h-4" />
            Find a hostel
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyTabState({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 py-12 px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && actionHref && (
        <Button variant="outline" size="sm" asChild className="mt-4 gap-1.5">
          <Link href={actionHref}>
            {actionLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 py-5">
            <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Booking row ── */

function BookingRow({
  booking,
  onCancelled,
}: {
  booking: Booking;
  onCancelled: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  const isPending = booking.status === "PENDING_PAYMENT";
  const cancellable = isPending || booking.status === "CONFIRMED";

  async function handleCancel() {
    if (!confirm("Cancel this booking? Your slot will be released.")) return;
    setCancelling(true);
    try {
      await bookingsApi.cancel(booking.id);
      toast.success("Booking cancelled.");
      onCancelled();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not cancel.";
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  }

  const remainingSeconds = useExpirySeconds(booking.reservation_expires_at);

  return (
    <Card className="group hover:ring-primary/20 transition-all duration-200">
      <CardContent className="p-0">
        {/* Top section */}
        <div className="flex items-start gap-4 p-5 pb-0">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <Link
                  href={`/student/bookings/${booking.id}`}
                  className="font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {booking.hostel.name}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Room {booking.room.label} · {booking.variant.name} ·{" "}
                  {booking.chosen_occupancy_at_booking === 1
                    ? "Solo"
                    : `${booking.chosen_occupancy_at_booking}-way share`}
                </p>
              </div>
              <StatusPill status={booking.status} />
            </div>
          </div>
        </div>

        {/* Pending payment countdown */}
        {isPending && remainingSeconds > 0 && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-chart-1/5 border border-chart-1/20 px-3 py-2">
            <Clock className="w-3.5 h-3.5 text-chart-1 shrink-0" />
            <CountdownTimer
              seconds={remainingSeconds}
              label="Reservation expires in"
              onExpire={onCancelled}
              className="text-xs text-chart-1 font-medium"
            />
          </div>
        )}

        {/* Bottom section */}
        <div className="flex items-end justify-between gap-3 flex-wrap p-5 pt-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              Price
            </p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              GH₵ {Number(booking.price_paid).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isPending && booking.latest_payment?.paystack_reference && (
              <Button asChild size="sm" className="gap-1.5">
                <a href={`https://checkout.paystack.com/${booking.latest_payment.paystack_reference}`}>
                  <CreditCard className="w-3.5 h-3.5" />
                  Complete payment
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/student/bookings/${booking.id}`}>Details</Link>
            </Button>
            {cancellable && (
              <Button
                variant="destructive"
                size="sm"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? "Cancelling…" : "Cancel"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Status pill ── */

function StatusPill({ status }: { status: BookingStatus }) {
  const config: Record<
    BookingStatus,
    { label: string; variant: "default" | "secondary" | "outline" | "destructive"; Icon: typeof Clock }
  > = {
    PENDING_PAYMENT: {
      label: "Awaiting payment",
      variant: "outline",
      Icon: Clock,
    },
    CONFIRMED: {
      label: "Confirmed",
      variant: "default",
      Icon: CheckCircle2,
    },
    CHECKED_IN: {
      label: "Checked in",
      variant: "default",
      Icon: CheckCircle2,
    },
    CHECKED_OUT: {
      label: "Checked out",
      variant: "secondary",
      Icon: CheckCircle2,
    },
    CANCELLED: {
      label: "Cancelled",
      variant: "secondary",
      Icon: XCircle,
    },
    EXPIRED: {
      label: "Expired",
      variant: "secondary",
      Icon: AlertCircle,
    },
    REFUNDED: {
      label: "Refunded",
      variant: "outline",
      Icon: AlertCircle,
    },
  };
  const { label, variant, Icon } = config[status];
  return (
    <Badge variant={variant} className="gap-1 text-[10px] shrink-0">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

/* ── Hooks ── */

function useExpirySeconds(expiresAt: string | null): number {
  const [secs, setSecs] = useState(() => calcSeconds(expiresAt));
  useEffect(() => {
    setSecs(calcSeconds(expiresAt));
  }, [expiresAt]);
  return secs;
}

function calcSeconds(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}
