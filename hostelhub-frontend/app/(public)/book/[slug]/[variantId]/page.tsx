"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  ApiError,
  bookingsApi,
  publicHostelsApi,
  type Hostel,
  type Room,
  type RoomVariant,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Step = 1 | 2 | 3;

export default function BookPage() {
  const { slug, variantId } = useParams() as { slug: string; variantId: string };
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [step, setStep] = useState<Step>(1);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Auth gate — bounce anon users to login with return path preserved.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const next = encodeURIComponent(`/book/${slug}/${variantId}`);
      router.replace(`/student/login?next=${next}`);
      return;
    }
    if (user.role !== "STUDENT") {
      toast.error("Only students can book rooms.");
      router.replace(`/hostels/${slug}`);
    }
  }, [authLoading, user, slug, variantId, router]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    publicHostelsApi
      .get(slug)
      .then((data) => {
        if (!cancelled) setHostel(data);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Could not load hostel.");
          router.replace("/hostels");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  const variant = useMemo<RoomVariant | null>(
    () => hostel?.variants.find((v) => v.id === variantId) ?? null,
    [hostel, variantId],
  );

  const selectedRoom = useMemo<Room | null>(
    () => variant?.rooms?.find((r) => r.id === selectedRoomId) ?? null,
    [variant, selectedRoomId],
  );

  // Once a room is picked, pre-seed occupancy from locked_k or min.
  useEffect(() => {
    if (!selectedRoom || !variant) return;
    if (selectedRoom.locked_k != null) {
      setOccupancy(selectedRoom.locked_k);
    } else {
      setOccupancy(variant.min_occupancy);
    }
  }, [selectedRoom, variant]);

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  if (!hostel || !variant) return null;

  const totalPrice = Number(variant.total_price);
  const pricePerSlot = +(totalPrice / occupancy).toFixed(2);

  async function handlePay() {
    if (!selectedRoom) return;
    setSubmitting(true);
    try {
      const res = await bookingsApi.create({
        room_id: selectedRoom.id,
        chosen_occupancy: occupancy,
      });
      // Send the student to Paystack. We'll come back to /student/bookings/[id].
      window.location.href = res.authorization_url;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not start your booking.";
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto h-full px-4 flex items-center gap-3">
          <Link
            href={`/hostels/${slug}`}
            className="w-9 h-9 -ml-1 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 leading-tight truncate">
              Book — {variant.name}
            </h1>
            <p className="text-xs text-gray-500 truncate">{hostel.name}</p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <StepIndicator step={step} />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-32">
        {step === 1 && (
          <StepRoomPicker
            variant={variant}
            selectedRoomId={selectedRoomId}
            onPick={setSelectedRoomId}
          />
        )}
        {step === 2 && selectedRoom && (
          <StepOccupancy
            variant={variant}
            room={selectedRoom}
            occupancy={occupancy}
            onChange={setOccupancy}
          />
        )}
        {step === 3 && selectedRoom && (
          <StepReview
            variant={variant}
            room={selectedRoom}
            occupancy={occupancy}
            pricePerSlot={pricePerSlot}
            hostelName={hostel.name}
          />
        )}
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {step === 1 && (
            <>
              <Link
                href={`/hostels/${slug}`}
                className="text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Cancel
              </Link>
              <div className="flex-1" />
              <button
                disabled={!selectedRoomId}
                onClick={() => setStep(2)}
                className="h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Back
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setStep(3)}
                className="h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                Review <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button
                onClick={() => setStep(2)}
                className="text-sm font-medium text-gray-500 hover:text-gray-800"
                disabled={submitting}
              >
                Back
              </button>
              <div className="flex-1" />
              <button
                onClick={handlePay}
                disabled={submitting}
                className="h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    Pay GH₵ {pricePerSlot.toLocaleString()} <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Pick a room ─────────────────────────────────────────────────────

function StepRoomPicker({
  variant,
  selectedRoomId,
  onPick,
}: {
  variant: RoomVariant;
  selectedRoomId: string | null;
  onPick: (id: string) => void;
}) {
  const rooms = variant.rooms ?? [];
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900">Pick a room</h2>
      <p className="text-sm text-gray-600 mt-1 mb-5">
        Rooms already taken are disabled. Rooms with "partial" are shared — you'll
        inherit whatever occupancy the first booker chose.
      </p>

      {rooms.length === 0 ? (
        <div className="rounded-xl bg-white ring-1 ring-gray-200 p-6 text-sm text-gray-500 text-center">
          This variant has no rooms yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {rooms.map((r) => {
            const disabled = r.status === "FULL" || r.status === "UNAVAILABLE";
            const selected = selectedRoomId === r.id;
            return (
              <button
                key={r.id}
                disabled={disabled}
                onClick={() => onPick(r.id)}
                className={`relative rounded-xl p-4 text-left ring-1 transition-all ${
                  disabled
                    ? "bg-gray-50 ring-gray-200 text-gray-400 cursor-not-allowed"
                    : selected
                    ? "bg-emerald-50 ring-emerald-400 text-emerald-900 shadow-sm"
                    : "bg-white ring-gray-200 hover:ring-emerald-300 text-gray-900"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="font-semibold">{r.label}</div>
                  {selected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <div className="mt-2 text-[11px] font-medium">
                  {r.status === "AVAILABLE" && (
                    <span className="text-emerald-700">Available</span>
                  )}
                  {r.status === "PARTIALLY_BOOKED" && r.locked_k != null && (
                    <span className="text-amber-700">
                      {r.locked_k}-way share · spots remain
                    </span>
                  )}
                  {r.status === "FULL" && <span className="text-gray-400">Full</span>}
                  {r.status === "UNAVAILABLE" && (
                    <span className="text-gray-400">Unavailable</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Step 2: Occupancy ───────────────────────────────────────────────────────

function StepOccupancy({
  variant,
  room,
  occupancy,
  onChange,
}: {
  variant: RoomVariant;
  room: Room;
  occupancy: number;
  onChange: (n: number) => void;
}) {
  const locked = room.locked_k != null;
  const range: number[] = [];
  for (let i = variant.min_occupancy; i <= variant.max_occupancy; i++) range.push(i);

  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900">Occupancy</h2>
      {locked ? (
        <div className="mt-4 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-5 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Room {room.label} is shared</p>
            <p className="text-sm text-amber-800 mt-1">
              Another student booked this room first and chose {room.locked_k}-way
              occupancy. You'll be their roommate at the same per-slot price.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600 mt-1">
          How many people will share this room? The price is split evenly — more
          people means each of you pays less.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {range.map((n) => {
          const isLockedPick = locked && n === room.locked_k;
          const selectable = !locked || isLockedPick;
          const selected = occupancy === n;
          return (
            <button
              key={n}
              disabled={!selectable}
              onClick={() => onChange(n)}
              className={`rounded-xl p-4 text-left ring-1 transition-all ${
                !selectable
                  ? "bg-gray-50 ring-gray-200 text-gray-400 cursor-not-allowed"
                  : selected
                  ? "bg-emerald-50 ring-emerald-400 shadow-sm"
                  : "bg-white ring-gray-200 hover:ring-emerald-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="font-semibold">
                  {n === 1 ? "Solo" : `${n}-way share`}
                </span>
              </div>
              <div className="mt-1.5 text-sm text-gray-600">
                GH₵ {(Number(variant.total_price) / n).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-xs text-gray-500"> / slot / year</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Step 3: Review ──────────────────────────────────────────────────────────

function StepReview({
  variant,
  room,
  occupancy,
  pricePerSlot,
  hostelName,
}: {
  variant: RoomVariant;
  room: Room;
  occupancy: number;
  pricePerSlot: number;
  hostelName: string;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Review &amp; pay</h2>
        <p className="text-sm text-gray-600 mt-1">
          Once you tap Pay, we'll hold this slot for 15 minutes while you finish on Paystack.
        </p>
      </div>

      <dl className="rounded-xl bg-white ring-1 ring-gray-200 divide-y divide-gray-100">
        <ReviewRow label="Hostel" value={hostelName} />
        <ReviewRow label="Variant" value={variant.name} />
        <ReviewRow label="Room" value={room.label} />
        <ReviewRow
          label="Occupancy"
          value={occupancy === 1 ? "Solo (1 person)" : `${occupancy}-way share`}
        />
        <ReviewRow
          label="Price per slot"
          value={`GH₵ ${pricePerSlot.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} / year`}
          emphasis
        />
      </dl>

      <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-900">
          Payment is handled by Paystack — card, MTN MoMo, Telecel, and AirtelTigo.
          Your slot is released automatically if you don't finish paying in 15 minutes.
        </p>
      </div>
    </section>
  );
}

function ReviewRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd
        className={`text-sm font-medium ${emphasis ? "text-emerald-700 font-semibold" : "text-gray-900"}`}
      >
        {value}
      </dd>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { n: Step; label: string }[] = [
    { n: 1, label: "Room" },
    { n: 2, label: "Occupancy" },
    { n: 3, label: "Review" },
  ];
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <li key={s.n} className="flex items-center gap-2 min-w-0">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                done
                  ? "bg-emerald-600 text-white"
                  : active
                  ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {done ? <Check className="w-3 h-3" /> : s.n}
            </span>
            <span
              className={`truncate ${active ? "font-semibold text-gray-900" : "text-gray-500"}`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-2 h-px w-6 bg-gray-200 hidden sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
