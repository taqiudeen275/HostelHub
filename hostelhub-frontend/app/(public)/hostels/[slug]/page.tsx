"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Expand,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Play,
  Users,
  Video,
} from "lucide-react";

import { type Hostel, type HostelMedia, publicHostelsApi } from "@/lib/api";
import { PhotoLightbox } from "@/components/hostels/photo-lightbox";

export default function PublicHostelDetailPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();

  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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
          toast.error("Failed to load hostel");
          router.push("/hostels");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  const photos = useMemo(
    () => hostel?.media?.filter((m) => m.type === "PHOTO") ?? [],
    [hostel]
  );
  const hostelVideo = useMemo(
    () => hostel?.media?.find((m) => m.type === "VIDEO") ?? null,
    [hostel]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  if (!hostel) return null;

  const prices = hostel.variants.map((v) => Number(v.total_price)).filter((n) => n > 0);
  const startingPrice = prices.length ? Math.min(...prices) : 0;
  const allRooms = hostel.variants.flatMap((v) => v.rooms ?? []);
  const availableRooms =
    allRooms.filter((r) => r.status === "AVAILABLE").length +
    allRooms.filter((r) => r.status === "PARTIALLY_BOOKED").length;

  const whatsappNumber = (() => {
    const src = hostel.owner_contact_whatsapp || hostel.owner_contact_phone || "";
    let digits = src.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = "233" + digits.slice(1);
    return digits;
  })();

  const mapHref =
    hostel.latitude && hostel.longitude
      ? `https://www.google.com/maps?q=${hostel.latitude},${hostel.longitude}`
      : `https://www.google.com/maps/search/${encodeURIComponent(
          hostel.address_text
        )}`;

  const genderTone =
    hostel.gender_policy === "MALE"
      ? "bg-sky-50 text-sky-700 ring-sky-200"
      : hostel.gender_policy === "FEMALE"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-violet-50 text-violet-700 ring-violet-200";

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky back bar */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center gap-3">
          <Link
            href="/hostels"
            className="w-9 h-9 -ml-1 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 leading-tight truncate">
              {hostel.name}
            </h1>
            <div className="flex items-center gap-1 text-xs text-gray-500 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{hostel.address_text}</span>
            </div>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-3">
            <a
              href={`tel:${hostel.owner_contact_phone}`}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg ring-1 ring-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium"
            >
              <Phone className="w-4 h-4" />
              Call
            </a>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                `Hi, I'm interested in ${hostel.name} on HostelHub.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Gallery */}
      <section className="max-w-6xl mx-auto px-4 pt-6">
        <GalleryHero
          photos={photos}
          onOpenLightbox={(idx) => {
            setLightboxIndex(idx);
            setLightboxOpen(true);
          }}
        />
      </section>

      {/* Title + quick stats */}
      <section className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              {hostel.name}
            </h2>
            <div className="flex items-center gap-1.5 text-gray-500 mt-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{hostel.address_text}</span>
            </div>
          </div>
          <span
            className={`shrink-0 text-[11px] uppercase tracking-wider font-semibold ring-1 rounded px-2 py-1 ${genderTone}`}
          >
            {hostel.gender_policy}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat
            label="Starting from"
            value={
              startingPrice > 0
                ? `GH₵ ${startingPrice.toLocaleString()}`
                : "—"
            }
            hint={startingPrice > 0 ? "per year" : undefined}
          />
          <Stat label="Room layouts" value={String(hostel.variants.length)} />
          <Stat label="Rooms total" value={String(allRooms.length)} />
          <Stat
            label="Currently open"
            value={String(availableRooms)}
            tone={availableRooms > 0 ? "positive" : "muted"}
          />
        </dl>
      </section>

      {/* Main grid */}
      <div className="max-w-6xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8">
        {/* Left column */}
        <div className="min-w-0 space-y-8">
          {/* Overview */}
          <section id="overview">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              About this property
            </h3>
            <div className="text-gray-700 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {hostel.description || (
                <span className="text-gray-400">
                  This hostel hasn't added a description yet.
                </span>
              )}
            </div>
          </section>

          {/* Hostel video walkthrough (if any) */}
          {hostelVideo && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-600" />
                Walk-through
              </h3>
              <div className="rounded-xl overflow-hidden ring-1 ring-gray-200 bg-black">
                <video
                  controls
                  preload="metadata"
                  className="w-full max-h-[420px] bg-black"
                >
                  <source src={hostelVideo.file} type="video/mp4" />
                </video>
              </div>
            </section>
          )}

          {/* Rooms */}
          <section id="rooms">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Rooms &amp; pricing
            </h3>
            {hostel.variants.length === 0 ? (
              <div className="rounded-xl bg-white ring-1 ring-gray-200 p-6 text-sm text-gray-500 text-center">
                No room layouts have been published yet.
              </div>
            ) : (
              <div className="space-y-3">
                {hostel.variants.map((v) => (
                  <VariantCard key={v.id} variant={v} hostelSlug={hostel.slug ?? slug} />
                ))}
              </div>
            )}
          </section>

          {/* Amenities */}
          {hostel.amenities && hostel.amenities.length > 0 && (
            <section id="amenities">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What's included
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hostel.amenities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg bg-white ring-1 ring-gray-200 px-3 py-2.5 text-sm text-gray-700"
                  >
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{a.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Location */}
          <section id="location">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Location
            </h3>
            <div className="rounded-xl bg-white ring-1 ring-gray-200 p-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {hostel.address_text}
                </p>
                {hostel.latitude && hostel.longitude ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Number(hostel.latitude).toFixed(5)},{" "}
                    {Number(hostel.longitude).toFixed(5)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Precise coordinates not provided by owner.
                  </p>
                )}
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Open in Google Maps
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Right sidebar — sticky contact */}
        <aside className="lg:sticky lg:top-20 self-start">
          <div className="rounded-xl bg-white ring-1 ring-gray-200 p-5">
            <div className="flex items-baseline justify-between mb-1">
              {startingPrice > 0 ? (
                <div>
                  <span className="text-2xl font-bold text-gray-900">
                    GH₵ {startingPrice.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500 font-normal"> / year</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Pricing coming soon</span>
              )}
              {availableRooms > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2 py-0.5">
                  {availableRooms} open
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Contact the owner directly to arrange a viewing or reserve a room.
            </p>

            <div className="space-y-2.5">
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                  `Hi, I'm interested in ${hostel.name} on HostelHub.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-11 rounded-lg font-semibold text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp owner
              </a>
              <a
                href={`tel:${hostel.owner_contact_phone}`}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-800 ring-1 ring-gray-200 h-11 rounded-lg font-semibold text-sm transition-colors"
              >
                <Phone className="w-4 h-4 text-gray-500" />
                Call {hostel.owner_contact_phone}
              </a>
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-600">
              <InfoLine label="Layouts" value={hostel.variants.length} icon={Users} />
              <InfoLine label="Rooms" value={allRooms.length} icon={ImageIcon} />
            </div>
          </div>
        </aside>
      </div>

      <PhotoLightbox
        media={hostel.media}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        initialIndex={lightboxIndex}
      />
    </div>
  );
}

// ── helper components ─────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "muted";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "muted"
      ? "text-gray-400"
      : "text-gray-900";
  return (
    <div className="rounded-xl bg-white ring-1 ring-gray-200 px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
        {label}
      </dt>
      <dd className={`mt-1 text-lg font-semibold leading-tight ${toneClass}`}>
        {value}
      </dd>
      {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
    </div>
  );
}

function InfoLine({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-gray-400" />
      <span>
        <span className="font-semibold text-gray-900">{value}</span>{" "}
        <span className="text-gray-500">{label.toLowerCase()}</span>
      </span>
    </div>
  );
}

function GalleryHero({
  photos,
  onOpenLightbox,
}: {
  photos: HostelMedia[];
  onOpenLightbox: (idx: number) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="aspect-[16/9] sm:aspect-[21/9] rounded-xl bg-gray-100 ring-1 ring-gray-200 flex flex-col items-center justify-center text-gray-400">
        <ImageIcon className="w-8 h-8 mb-1" />
        <span className="text-sm">No photos yet</span>
      </div>
    );
  }

  const [hero, ...rest] = photos;
  const tiles = rest.slice(0, 4);
  const remaining = Math.max(0, photos.length - 5);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-xl overflow-hidden">
      {/* Hero tile */}
      <button
        type="button"
        onClick={() => onOpenLightbox(0)}
        className="sm:col-span-2 sm:row-span-2 relative group aspect-[4/3] sm:aspect-auto bg-gray-100 overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.medium || hero.file}
          alt={hero.caption ?? ""}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
        />
      </button>

      {/* Grid tiles */}
      {tiles.map((p, idx) => {
        const isLast = idx === tiles.length - 1 && remaining > 0;
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => onOpenLightbox(idx + 1)}
            className="relative group hidden sm:block aspect-square bg-gray-100 overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.medium || p.file}
              alt={p.caption ?? ""}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
            {isLast && (
              <div className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center font-semibold text-sm">
                <Expand className="w-5 h-5 mb-1" />
                +{remaining} more
              </div>
            )}
          </button>
        );
      })}

      {/* Mobile "show all" button */}
      <button
        type="button"
        onClick={() => onOpenLightbox(0)}
        className="sm:hidden mt-2 h-10 rounded-lg bg-white ring-1 ring-gray-200 text-sm font-medium text-gray-700 flex items-center justify-center gap-2"
      >
        <Expand className="w-4 h-4" />
        Show all {photos.length} photos
      </button>

      {/* Desktop "show all" floating button */}
      {photos.length > 1 && (
        <button
          type="button"
          onClick={() => onOpenLightbox(0)}
          className="hidden sm:flex absolute items-center gap-1.5 bg-white ring-1 ring-gray-200 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50"
          style={{ position: "relative", marginTop: "-36px", justifySelf: "end", marginRight: "8px" }}
        >
          <Expand className="w-3.5 h-3.5" />
          Show all {photos.length} photos
        </button>
      )}
    </div>
  );
}

function VariantCard({
  variant,
  hostelSlug,
}: {
  variant: Hostel["variants"][number];
  hostelSlug: string;
}) {
  const rooms = variant.rooms ?? [];
  const canBook = rooms.some(
    (r) => r.status === "AVAILABLE" || r.status === "PARTIALLY_BOOKED"
  );
  const available = rooms.filter((r) => r.status === "AVAILABLE").length;
  const partial = rooms.filter((r) => r.status === "PARTIALLY_BOOKED").length;
  const full = rooms.filter((r) => r.status === "FULL").length;
  const video = variant.media?.find((m) => m.type === "VIDEO");
  const perSlot =
    variant.max_occupancy > 1
      ? Number(variant.total_price) / variant.max_occupancy
      : null;

  return (
    <div className="rounded-xl bg-white ring-1 ring-gray-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-900">{variant.name}</h4>
            {variant.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {variant.description}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-gray-900 leading-tight">
              GH₵ {Number(variant.total_price).toLocaleString()}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
              Per year
            </div>
            {perSlot && (
              <div className="text-xs text-emerald-700 font-medium mt-1">
                Shared: GH₵ {Math.round(perSlot).toLocaleString()}/slot
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-50 ring-1 ring-gray-200 rounded px-2 py-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            {variant.min_occupancy === variant.max_occupancy
              ? `${variant.max_occupancy} per room`
              : `${variant.min_occupancy}–${variant.max_occupancy} per room`}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-50 ring-1 ring-gray-200 rounded px-2 py-1">
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
          </span>

          {available > 0 && (
            <AvailabilityPill tone="emerald">
              {available} available
            </AvailabilityPill>
          )}
          {partial > 0 && (
            <AvailabilityPill tone="amber">
              {partial} partial
            </AvailabilityPill>
          )}
          {full > 0 && (
            <AvailabilityPill tone="gray">
              {full} full
            </AvailabilityPill>
          )}
        </div>

        {variant.features && variant.features.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-gray-700">
            {variant.features.slice(0, 6).map((f, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center gap-3">
          {canBook ? (
            <Link
              href={`/book/${hostelSlug}/${variant.id}`}
              className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              Book a room
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <span className="h-10 px-4 rounded-lg bg-gray-100 text-gray-400 text-sm font-semibold inline-flex items-center">
              Fully booked
            </span>
          )}
          <span className="text-xs text-gray-500">
            15-minute hold while you pay
          </span>
        </div>
      </div>

      {video && (
        <details className="border-t border-gray-100">
          <summary className="cursor-pointer list-none px-5 py-3 flex items-center gap-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50/50 transition-colors">
            <Play className="w-4 h-4" />
            Watch walkthrough
          </summary>
          <div className="px-5 pb-5">
            <video controls preload="metadata" className="w-full max-h-[360px] bg-black rounded-lg">
              <source src={video.file} type="video/mp4" />
            </video>
          </div>
        </details>
      )}
    </div>
  );
}

function AvailabilityPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "emerald" | "amber" | "gray";
}) {
  const classes =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-gray-50 text-gray-600 ring-gray-200";
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-gray-400";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ring-1 rounded-full px-2 py-0.5 ${classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}
