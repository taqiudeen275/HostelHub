"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorOpen,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Users,
} from "lucide-react";

import {
  type Booking,
  ApiError,
  bookingsApi,
  paymentsApi,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { RoommateSection } from "@/components/bookings/roommate-section";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

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
    let cancelled = false;
    (async () => {
      try {
        await paymentsApi.get(booking.latest_payment!.id);
        if (!cancelled) await fetchBooking();
      } catch {
        // Verification attempt failed — polling will retry
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameFromPaystack, booking?.latest_payment?.id]);

  // Poll: verify payment with Paystack, then re-fetch booking until it leaves PENDING_PAYMENT
  const fetchWithVerify = async (): Promise<Booking | null> => {
    // Poke the payment endpoint first — that triggers server-side Paystack verify
    if (booking?.latest_payment?.id) {
      await paymentsApi.get(booking.latest_payment.id).catch(() => {});
    }
    return fetchBooking();
  };

  usePolling(fetchWithVerify, {
    enabled: booking?.status === "PENDING_PAYMENT",
    intervalMs: 2500,
    maxAttempts: 15,
    stopWhen: (b) => !!b && b.status !== "PENDING_PAYMENT",
  });

  if (isLoading || !booking) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* ── Back link ── */}
      <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
        <Link href="/student/bookings">
          <ArrowLeft className="w-4 h-4" />
          All bookings
        </Link>
      </Button>

      {/* ── Status banner ── */}
      <StatusBanner booking={booking} cameFromPaystack={cameFromPaystack} />

      {/* ── Hostel summary ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl">
                <Link
                  href={`/hostels/${booking.hostel.slug}`}
                  className="hover:text-primary transition-colors"
                >
                  {booking.hostel.name}
                </Link>
              </CardTitle>
              <CardDescription className="mt-0.5">
                Room {booking.room.label} · {booking.variant.name}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBlock
              label="Occupancy"
              value={
                booking.chosen_occupancy_at_booking === 1
                  ? "Solo"
                  : `${booking.chosen_occupancy_at_booking}-way share`
              }
              icon={<Users className="w-3.5 h-3.5" />}
            />
            <StatBlock
              label="Price paid"
              value={`GH₵ ${Number(booking.price_paid).toLocaleString()}`}
              icon={<CreditCard className="w-3.5 h-3.5" />}
            />
            <StatBlock
              label="Booked on"
              value={new Date(booking.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              icon={<Clock className="w-3.5 h-3.5" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Hostel location & contact ── */}
      {(booking.hostel.address_text || booking.hostel.owner_contact_phone) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Location & Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {booking.hostel.address_text && (
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-foreground">{booking.hostel.address_text}</span>
              </div>
            )}
            {booking.hostel.owner_contact_phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <a
                  href={`tel:${booking.hostel.owner_contact_phone}`}
                  className="text-foreground hover:text-primary transition-colors"
                >
                  {booking.hostel.owner_contact_phone}
                </a>
              </div>
            )}
            {(() => {
              const hasCoords = booking.hostel.latitude && booking.hostel.longitude;
              const mapsUrl = hasCoords
                ? `https://www.google.com/maps/dir/?api=1&destination=${booking.hostel.latitude},${booking.hostel.longitude}`
                : booking.hostel.address_text
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.hostel.address_text)}`
                  : null;
              if (!mapsUrl) return null;
              return (
                <Button variant="outline" size="sm" asChild className="gap-1.5 mt-1">
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation className="w-3.5 h-3.5" />
                    Get Directions
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                </Button>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* ── Payment info ── */}
      {booking.latest_payment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground font-mono">
                  {booking.latest_payment.paystack_reference}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Status:{" "}
                  <span className="font-semibold">{booking.latest_payment.status}</span>
                  {booking.latest_payment.channel &&
                    ` · via ${booking.latest_payment.channel}`}
                </p>
              </div>
              <PaymentStatusBadge status={booking.latest_payment.status} />
            </div>

            {booking.status === "PENDING_PAYMENT" &&
              booking.latest_payment.paystack_reference && (
                <div className="mt-4">
                  <Button asChild className="gap-1.5 w-full sm:w-auto">
                    <a
                      href={`https://checkout.paystack.com/${booking.latest_payment.paystack_reference}`}
                    >
                      <CreditCard className="w-4 h-4" />
                      Complete payment
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  </Button>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* ── Roommates ── */}
      <RoommateSection
        bookingId={booking.id}
        hostelSlug={booking.hostel.slug}
        chosenOccupancy={booking.chosen_occupancy_at_booking}
      />

    </div>
  );
}

/* ── Sub-components ── */

function StatusBanner({
  booking,
  cameFromPaystack,
}: {
  booking: Booking;
  cameFromPaystack: boolean;
}) {
  if (booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") {
    return (
      <Card className="border-chart-3/30 bg-chart-3/5">
        <CardContent className="flex items-start gap-3 py-5">
          <div className="w-9 h-9 rounded-lg bg-chart-3/10 text-chart-3 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Booking {booking.status === "CHECKED_IN" ? "active" : "confirmed"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Your slot is secured. You'll get an SMS reminder a day before check-in.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (booking.status === "PENDING_PAYMENT") {
    return (
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardContent className="py-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-chart-1/10 text-chart-1 flex items-center justify-center shrink-0 mt-0.5">
              {cameFromPaystack ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {cameFromPaystack ? "Confirming your payment…" : "Payment still pending"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {cameFromPaystack
                  ? "Hang tight — we're checking with Paystack. This page will update automatically."
                  : "Complete your Paystack payment to lock this slot before the 15-minute window closes."}
              </p>
            </div>
          </div>
          {cameFromPaystack && (
            <Progress value={undefined} className="mt-4 h-1.5 animate-pulse" />
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

function PaymentStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
    SUCCESS: { variant: "default", label: "Success" },
    INITIATED: { variant: "outline", label: "Initiated" },
    FAILED: { variant: "destructive", label: "Failed" },
    REFUNDED: { variant: "secondary", label: "Refunded" },
  };
  const config = variants[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function StatBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/50 border px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <dt className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </dt>
      </div>
      <dd className="text-sm font-bold text-foreground">{value}</dd>
    </div>
  );
}
