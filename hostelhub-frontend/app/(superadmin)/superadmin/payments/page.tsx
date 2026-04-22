"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

import {
  type Booking,
  ApiError,
  bookingsApi,
  paymentsApi,
} from "@/lib/api";

/**
 * Super admin view — lists every booking's latest payment, filtered by status.
 * Refund is manual (PRD §11.4): super admin enters a reason, Paystack call fires,
 * state transitions to REFUNDED.
 */
export default function SuperAdminPaymentsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<Booking | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await bookingsApi.list();
      setBookings(rows.filter((b) => !!b.latest_payment));
    } catch {
      toast.error("Could not load payments.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <p className="text-sm text-gray-400 mt-1">
          Platform-wide payment log. Refunds are processed through Paystack and logged here.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.08] p-10 text-center text-sm text-gray-400">
          No payments recorded yet.
        </div>
      ) : (
        <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.08] overflow-hidden">
          <table className="w-full text-sm text-gray-300">
            <thead className="bg-white/[0.02] text-left text-[10px] uppercase text-gray-500 font-bold tracking-widest">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Hostel · Room</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {bookings.map((b) => {
                const p = b.latest_payment!;
                const canRefund = p.status === "SUCCESS";
                return (
                  <tr key={b.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      {b.student.first_name} {b.student.last_name}
                      <div className="text-[11px] text-gray-500">{b.student.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {b.hostel.name}
                      <div className="text-[11px] text-gray-500">Room {b.room.label}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                      {p.paystack_reference}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      GH₵ {Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 ring-1 ${
                          p.status === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                            : p.status === "REFUNDED"
                            ? "bg-sky-500/10 text-sky-300 ring-sky-500/30"
                            : p.status === "FAILED"
                            ? "bg-red-500/10 text-red-300 ring-red-500/30"
                            : "bg-amber-500/10 text-amber-300 ring-amber-500/30"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canRefund && (
                        <button
                          onClick={() => setRefundTarget(b)}
                          className="h-8 px-3 rounded-lg ring-1 ring-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <RefreshCcw className="w-3.5 h-3.5" />
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {refundTarget && (
        <RefundDialog
          booking={refundTarget}
          onClose={() => setRefundTarget(null)}
          onDone={() => {
            setRefundTarget(null);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

function RefundDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking;
  onClose: () => void;
  onDone: () => void;
}) {
  const payment = booking.latest_payment!;
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await paymentsApi.refund(payment.id, reason);
      toast.success("Refund processed.");
      onDone();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Refund failed.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-[#0A0A0A] ring-1 ring-white/[0.1] p-6 text-gray-200">
        <h3 className="text-lg font-bold text-white">
          Refund GH₵ {Number(payment.amount).toLocaleString()}?
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          {booking.hostel.name} · Room {booking.room.label} ·{" "}
          {booking.student.first_name} {booking.student.last_name}
        </p>
        <label className="block mt-5">
          <span className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
            Reason
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this being refunded? (logged in audit trail)"
            className="mt-2 w-full rounded-lg bg-white/[0.03] ring-1 ring-white/[0.1] px-3 py-2 text-sm text-white focus:outline-none focus:ring-indigo-500"
          />
        </label>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            disabled={submitting}
            onClick={handleSubmit}
            className="h-10 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Process refund
          </button>
        </div>
      </div>
    </div>
  );
}
