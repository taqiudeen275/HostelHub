"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

import { CountdownTimer } from "@/components/auth/countdown-timer";
import {
  type Booking,
  type BookingStatus,
  bookingsApi,
  ApiError,
} from "@/lib/api";

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
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          My bookings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Track your active reservations and revisit past ones.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <BookingSection
            title="Active"
            bookings={active}
            onCancelled={fetchBookings}
            emptyMessage="You have no active bookings right now."
          />
          {past.length > 0 && (
            <BookingSection
              title="Past"
              bookings={past}
              onCancelled={fetchBookings}
            />
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-10 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
        <ArrowRight className="w-5 h-5" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">
        No bookings yet
      </h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Browse verified hostels near your campus to get started.
      </p>
      <Link
        href="/hostels"
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
      >
        Find a hostel
      </Link>
    </div>
  );
}

function BookingSection({
  title,
  bookings,
  onCancelled,
  emptyMessage,
}: {
  title: string;
  bookings: Booking[];
  onCancelled: () => void;
  emptyMessage?: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {title}
      </h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} onCancelled={onCancelled} />
          ))}
        </div>
      )}
    </section>
  );
}

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
    <div className="rounded-xl bg-white ring-1 ring-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <Link
            href={`/student/bookings/${booking.id}`}
            className="font-semibold text-gray-900 hover:text-emerald-700 transition-colors"
          >
            {booking.hostel.name}
          </Link>
          <p className="text-sm text-gray-500 mt-0.5">
            Room {booking.room.label} · {booking.variant.name} ·{" "}
            {booking.chosen_occupancy_at_booking === 1
              ? "Solo"
              : `${booking.chosen_occupancy_at_booking}-way share`}
          </p>
        </div>
        <StatusPill status={booking.status} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Price
          </div>
          <div className="text-lg font-bold text-gray-900">
            GH₵ {Number(booking.price_paid).toLocaleString()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPending && remainingSeconds > 0 && (
            <CountdownTimer
              seconds={remainingSeconds}
              label="Expires in"
              onExpire={onCancelled}
              className="text-xs text-amber-700 font-medium"
            />
          )}
          {isPending && booking.latest_payment?.paystack_reference && (
            <a
              href={`https://checkout.paystack.com/${booking.latest_payment.paystack_reference}`}
              className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              Complete payment
            </a>
          )}
          <Link
            href={`/student/bookings/${booking.id}`}
            className="h-9 px-3 rounded-lg ring-1 ring-gray-200 text-gray-700 hover:ring-gray-300 text-xs font-semibold inline-flex items-center gap-1"
          >
            Details
          </Link>
          {cancellable && (
            <button
              disabled={cancelling}
              onClick={handleCancel}
              className="h-9 px-3 rounded-lg ring-1 ring-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
            >
              {cancelling ? "…" : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: BookingStatus }) {
  const config: Record<
    BookingStatus,
    { label: string; classes: string; Icon: typeof Clock }
  > = {
    PENDING_PAYMENT: {
      label: "Awaiting payment",
      classes: "bg-amber-50 text-amber-700 ring-amber-200",
      Icon: Clock,
    },
    CONFIRMED: {
      label: "Confirmed",
      classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      Icon: CheckCircle2,
    },
    CHECKED_IN: {
      label: "Checked in",
      classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      Icon: CheckCircle2,
    },
    CHECKED_OUT: {
      label: "Checked out",
      classes: "bg-gray-50 text-gray-700 ring-gray-200",
      Icon: CheckCircle2,
    },
    CANCELLED: {
      label: "Cancelled",
      classes: "bg-gray-50 text-gray-600 ring-gray-200",
      Icon: XCircle,
    },
    EXPIRED: {
      label: "Expired",
      classes: "bg-gray-50 text-gray-500 ring-gray-200",
      Icon: AlertCircle,
    },
    REFUNDED: {
      label: "Refunded",
      classes: "bg-sky-50 text-sky-700 ring-sky-200",
      Icon: AlertCircle,
    },
  };
  const { label, classes, Icon } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ring-1 rounded-full px-2 py-0.5 ${classes}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

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
