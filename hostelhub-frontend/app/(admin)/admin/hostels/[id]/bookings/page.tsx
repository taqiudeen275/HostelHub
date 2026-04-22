"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, LogOut, XCircle } from "lucide-react";

import {
  type Booking,
  type BookingStatus,
  ApiError,
  bookingsApi,
} from "@/lib/api";

const STATUS_FILTERS: { label: string; value: BookingStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending payment", value: "PENDING_PAYMENT" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Checked in", value: "CHECKED_IN" },
  { label: "Checked out", value: "CHECKED_OUT" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function AdminHostelBookingsPage() {
  const { id: hostelId } = useParams() as { id: string };
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | "ALL">("ALL");

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== "ALL") params.status = filter;
      const rows = await bookingsApi.list(params);
      setBookings(rows.filter((b) => b.hostel.id === hostelId));
    } catch {
      toast.error("Could not load bookings.");
    } finally {
      setIsLoading(false);
    }
  }, [filter, hostelId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const hostel = useMemo(() => bookings[0]?.hostel, [bookings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bookings {hostel?.name ? `· ${hostel.name}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage student bookings for this hostel — check people in, check them out, see payment status.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`h-8 px-3 rounded-full text-xs font-medium ring-1 transition-colors ${
              filter === f.value
                ? "bg-indigo-600 text-white ring-indigo-600"
                : "bg-white text-gray-700 ring-gray-200 hover:ring-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl bg-white ring-1 ring-gray-200 p-10 text-center text-sm text-gray-500">
          No bookings in this filter yet.
        </div>
      ) : (
        <div className="rounded-xl bg-white ring-1 ring-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <AdminBookingRow key={b.id} booking={b} onChange={fetch} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminBookingRow({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function action(fn: () => Promise<unknown>, successMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      onChange();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Action failed.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">
          {booking.student.first_name} {booking.student.last_name}
        </div>
        <div className="text-xs text-gray-500">{booking.student.phone}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{booking.room.label}</div>
        <div className="text-xs text-gray-500">
          {booking.variant.name} ·{" "}
          {booking.chosen_occupancy_at_booking === 1
            ? "Solo"
            : `${booking.chosen_occupancy_at_booking}-way`}
        </div>
      </td>
      <td className="px-4 py-3">
        <SmallStatusPill status={booking.status} />
      </td>
      <td className="px-4 py-3 text-gray-700 font-medium">
        GH₵ {Number(booking.price_paid).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-2">
          {booking.status === "CONFIRMED" && (
            <button
              disabled={busy}
              onClick={() => action(() => bookingsApi.checkIn(booking.id), "Checked in")}
              className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Check in
            </button>
          )}
          {booking.status === "CHECKED_IN" && (
            <button
              disabled={busy}
              onClick={() => action(() => bookingsApi.checkOut(booking.id), "Checked out")}
              className="h-8 px-3 rounded-lg ring-1 ring-gray-200 text-gray-700 hover:ring-gray-300 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Check out
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function SmallStatusPill({ status }: { status: BookingStatus }) {
  const toneMap: Record<BookingStatus, string> = {
    PENDING_PAYMENT: "bg-amber-50 text-amber-700 ring-amber-200",
    CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    CHECKED_IN: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    CHECKED_OUT: "bg-gray-50 text-gray-700 ring-gray-200",
    CANCELLED: "bg-gray-50 text-gray-500 ring-gray-200",
    EXPIRED: "bg-gray-50 text-gray-500 ring-gray-200",
    REFUNDED: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  const IconMap: Record<BookingStatus, typeof Clock> = {
    PENDING_PAYMENT: Clock,
    CONFIRMED: CheckCircle2,
    CHECKED_IN: CheckCircle2,
    CHECKED_OUT: CheckCircle2,
    CANCELLED: XCircle,
    EXPIRED: XCircle,
    REFUNDED: XCircle,
  };
  const Icon = IconMap[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ring-1 rounded-full px-2 py-0.5 ${toneMap[status]}`}
    >
      <Icon className="w-3 h-3" />
      {status.replace("_", " ").toLowerCase()}
    </span>
  );
}
