"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck, CheckCircle2, Clock, Loader2, LogOut, Phone, Search, XCircle,
} from "lucide-react";

import {
  type Booking,
  type BookingStatus,
  ApiError,
  bookingsApi,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STATUS_FILTERS: { label: string; value: BookingStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending payment", value: "PENDING_PAYMENT" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Checked in", value: "CHECKED_IN" },
  { label: "Checked out", value: "CHECKED_OUT" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function AdminGlobalBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await bookingsApi.list(filter !== "ALL" ? { status: filter } : undefined);
      setBookings(rows);
    } catch {
      toast.error("Could not load bookings.");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search filter
  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter(
      (b) =>
        b.student.first_name?.toLowerCase().includes(q) ||
        b.student.last_name?.toLowerCase().includes(q) ||
        b.student.phone?.includes(q) ||
        b.room.label?.toLowerCase().includes(q) ||
        b.variant.name?.toLowerCase().includes(q) ||
        b.hostel.name?.toLowerCase().includes(q)
    );
  }, [bookings, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          All Bookings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage student bookings across all your hostels.
        </p>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`h-8 px-3 rounded-full text-xs font-medium ring-1 transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-card text-foreground ring-border hover:ring-primary/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, hostel, room..."
            className="h-9 pl-9 pr-4 w-full sm:w-64 rounded-lg bg-card ring-1 ring-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Bookings list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No bookings found</p>
            <p className="text-sm mt-1">
              {searchQuery ? "Try adjusting your search." : "No bookings match this filter yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground tracking-wider border-b border-border bg-muted/30">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBookings.map((b) => (
                    <AdminBookingRow key={b.id} booking={b} onChange={fetchData} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredBookings.map((b) => (
              <AdminBookingCard key={b.id} booking={b} onChange={fetchData} />
            ))}
          </div>
        </>
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
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">
          {booking.student.first_name} {booking.student.last_name}
        </div>
        <a
          href={`tel:${booking.student.phone}`}
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
        >
          <Phone className="w-3 h-3" />
          {booking.student.phone}
        </a>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{booking.hostel.name}</div>
        <div className="text-xs text-muted-foreground">
          {booking.room.label} · {booking.variant.name}
        </div>
      </td>
      <td className="px-4 py-3">
        <SmallStatusPill status={booking.status} />
      </td>
      <td className="px-4 py-3 text-foreground font-semibold">
        GH₵ {Number(booking.price_paid).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {new Date(booking.created_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-2">
          {booking.status === "CONFIRMED" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => action(() => bookingsApi.checkIn(booking.id), "Checked in")}
              className="gap-1 h-8 text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Check in
            </Button>
          )}
          {booking.status === "CHECKED_IN" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => action(() => bookingsApi.checkOut(booking.id), "Checked out")}
              className="gap-1 h-8 text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              Check out
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AdminBookingCard({
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {booking.student.first_name} {booking.student.last_name}
            </p>
            <a
              href={`tel:${booking.student.phone}`}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
            >
              <Phone className="w-3 h-3" />
              {booking.student.phone}
            </a>
          </div>
          <SmallStatusPill status={booking.status} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="col-span-2">
            <span className="text-muted-foreground">Hostel</span>
            <p className="font-medium text-foreground">{booking.hostel.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Room</span>
            <p className="font-medium text-foreground">{booking.room.label}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Variant</span>
            <p className="font-medium text-foreground">{booking.variant.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Price</span>
            <p className="font-semibold text-foreground">
              GH₵ {Number(booking.price_paid).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Occupancy</span>
            <p className="font-medium text-foreground">
              {booking.chosen_occupancy_at_booking === 1
                ? "Solo"
                : `${booking.chosen_occupancy_at_booking}-way share`}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          {new Date(booking.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>

        {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && (
          <div className="mt-3 pt-3 border-t border-border">
            {booking.status === "CONFIRMED" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => action(() => bookingsApi.checkIn(booking.id), "Checked in")}
                className="w-full gap-1 h-9 text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Check in
              </Button>
            )}
            {booking.status === "CHECKED_IN" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => action(() => bookingsApi.checkOut(booking.id), "Checked out")}
                className="w-full gap-1 h-9 text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                Check out
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SmallStatusPill({ status }: { status: BookingStatus }) {
  const toneMap: Record<BookingStatus, string> = {
    PENDING_PAYMENT: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800",
    CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800",
    CHECKED_IN: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800",
    CHECKED_OUT: "bg-muted text-muted-foreground ring-border",
    CANCELLED: "bg-muted text-muted-foreground/60 ring-border",
    EXPIRED: "bg-muted text-muted-foreground/60 ring-border",
    REFUNDED: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800",
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
