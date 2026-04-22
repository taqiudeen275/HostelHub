"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Users,
} from "lucide-react";

import {
  type Booking,
  ApiError,
  bookingsApi,
  paymentsApi,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

export default function BookingDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameFromPaystack =
    searchParams?.get("reference") != null || searchParams?.get("trxref") != null;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchBooking(): Promise<Booking | null> {
    try {
      const b = await bookingsApi.get(id);
      setBooking(b);
      return b;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.error("Booking not found.");
        router.replace("/student/bookings");
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // If the user was just returned from Paystack, poke the payment endpoint
  // directly — that triggers a server-side Paystack verify even before the
  // webhook lands, so localhost dev works without ngrok.
  useEffect(() => {
    if (!cameFromPaystack || !booking?.latest_payment?.id) return;
    paymentsApi.get(booking.latest_payment.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameFromPaystack, booking?.latest_payment?.id]);

  // Poll the booking until it leaves PENDING_PAYMENT
  usePolling(fetchBooking, {
    enabled: booking?.status === "PENDING_PAYMENT",
    intervalMs: 2500,
    maxAttempts: 15,
    stopWhen: (b) => !!b && b.status !== "PENDING_PAYMENT",
  });

  if (isLoading || !booking) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/student/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          All bookings
        </Link>
      </div>

      {/* Status banner */}
      <StatusBanner booking={booking} cameFromPaystack={cameFromPaystack} />

      {/* Summary */}
      <div className="rounded-xl bg-white ring-1 ring-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          <Link
            href={`/hostels/${booking.hostel.slug}`}
            className="hover:text-emerald-700 transition-colors"
          >
            {booking.hostel.name}
          </Link>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Room {booking.room.label} · {booking.variant.name}
        </p>

        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Stat label="Occupancy" value={
            booking.chosen_occupancy_at_booking === 1
              ? "Solo"
              : `${booking.chosen_occupancy_at_booking}-way share`
          } />
          <Stat
            label="Price paid"
            value={`GH₵ ${Number(booking.price_paid).toLocaleString()}`}
          />
          <Stat
            label="Booked"
            value={new Date(booking.created_at).toLocaleDateString()}
          />
        </dl>
      </div>

      {/* Payment */}
      {booking.latest_payment && (
        <div className="rounded-xl bg-white ring-1 ring-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Payment
          </h2>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-gray-900 font-medium">
                {booking.latest_payment.paystack_reference}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Status: <span className="font-semibold">{booking.latest_payment.status}</span>
                {booking.latest_payment.channel && ` · via ${booking.latest_payment.channel}`}
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold rounded-full ring-1 px-2 py-0.5 ${
                booking.latest_payment.status === "SUCCESS"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : booking.latest_payment.status === "INITIATED"
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-gray-50 text-gray-600 ring-gray-200"
              }`}
            >
              {booking.latest_payment.status}
            </span>
          </div>
        </div>
      )}

      {/* Roommates stub (M5) */}
      {booking.chosen_occupancy_at_booking > 1 && (
        <div className="rounded-xl bg-white ring-1 ring-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Roommates
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Roommate cards with privacy-aware contact details land in Milestone M5.
            Until then, expect {booking.chosen_occupancy_at_booking - 1} other student
            {booking.chosen_occupancy_at_booking > 2 ? "s" : ""} in this room.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBanner({
  booking,
  cameFromPaystack,
}: {
  booking: Booking;
  cameFromPaystack: boolean;
}) {
  if (booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") {
    return (
      <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-5 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-emerald-900">Booking confirmed</p>
          <p className="text-sm text-emerald-800 mt-1">
            Your slot is secured. You'll get an SMS reminder a day before check-in.
          </p>
        </div>
      </div>
    );
  }
  if (booking.status === "PENDING_PAYMENT") {
    return (
      <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-5 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-900">
            {cameFromPaystack ? "Confirming your payment…" : "Payment still pending"}
          </p>
          <p className="text-sm text-amber-800 mt-1">
            {cameFromPaystack
              ? "Hang tight — we're checking with Paystack. This page will update automatically."
              : "Complete your Paystack payment to lock this slot before the 15-minute window closes."}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 ring-1 ring-gray-200 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}
