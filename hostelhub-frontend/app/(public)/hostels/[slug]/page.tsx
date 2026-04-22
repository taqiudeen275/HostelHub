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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
      ? "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800"
      : hostel.gender_policy === "FEMALE"
      ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800"
      : "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky back bar */}
      <header className="sticky top-0 z-40 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center gap-3">
          <Link
            href="/hostels"
            className="w-9 h-9 -ml-1 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground leading-tight truncate">
              {hostel.name}
            </h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{hostel.address_text}</span>
            </div>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-3">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={`tel:${hostel.owner_contact_phone}`}>
                <Phone className="w-4 h-4" />
                Call
              </a>
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                  `Hi, I'm interested in ${hostel.name} on HostelHub.`
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            </Button>
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
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {hostel.name}
            </h2>
            <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
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
            <h3 className="text-lg font-semibold text-foreground mb-3">
              About this property
            </h3>
            <div className="text-muted-foreground text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {hostel.description || (
                <span className="text-muted-foreground/60">
                  This hostel hasn't added a description yet.
                </span>
              )}
            </div>
          </section>

          {/* Hostel video walkthrough (if any) */}
          {hostelVideo && (
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Walk-through
              </h3>
              <div className="rounded-xl overflow-hidden ring-1 ring-border bg-black">
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
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Rooms &amp; pricing
            </h3>
            {hostel.variants.length === 0 ? (
              <div className="rounded-xl bg-card ring-1 ring-border p-6 text-sm text-muted-foreground text-center">
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
              <h3 className="text-lg font-semibold text-foreground mb-3">
                What's included
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hostel.amenities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg bg-card ring-1 ring-border px-3 py-2.5 text-sm text-foreground"
                  >
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{a.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Location */}
          <section id="location">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Location
            </h3>
            <Card>
              <CardContent className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {hostel.address_text}
                  </p>
                  {hostel.latitude && hostel.longitude ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Number(hostel.latitude).toFixed(5)},{" "}
                      {Number(hostel.longitude).toFixed(5)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Precise coordinates not provided by owner.
                    </p>
                  )}
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Open in Google Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right sidebar — sticky contact */}
        <aside className="lg:sticky lg:top-20 self-start">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-baseline justify-between mb-1">
                {startingPrice > 0 ? (
                  <div>
                    <span className="text-2xl font-bold text-foreground">
                      GH₵ {startingPrice.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground font-normal"> / year</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Pricing coming soon</span>
                )}
                {availableRooms > 0 && (
                  <Badge variant="default" className="gap-1 text-[10px]">
                    {availableRooms} open
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                Contact the owner directly to arrange a viewing or reserve a room.
              </p>

              <div className="space-y-2.5">
                <Button asChild className="w-full gap-2">
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      `Hi, I'm interested in ${hostel.name} on HostelHub.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp owner
                  </a>
                </Button>
                <Button variant="outline" asChild className="w-full gap-2">
                  <a href={`tel:${hostel.owner_contact_phone}`}>
                    <Phone className="w-4 h-4" />
                    Call {hostel.owner_contact_phone}
                  </a>
                </Button>
              </div>

              <div className="mt-5 pt-5 border-t border-border grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <InfoLine label="Layouts" value={hostel.variants.length} icon={Users} />
                <InfoLine label="Rooms" value={allRooms.length} icon={ImageIcon} />
              </div>
            </CardContent>
          </Card>
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
      ? "text-primary"
      : tone === "muted"
      ? "text-muted-foreground/60"
      : "text-foreground";
  return (
    <div className="rounded-xl bg-card ring-1 ring-border px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </dt>
      <dd className={`mt-1 text-lg font-semibold leading-tight ${toneClass}`}>
        {value}
      </dd>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
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
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span>
        <span className="font-semibold text-foreground">{value}</span>{" "}
        <span className="text-muted-foreground">{label.toLowerCase()}</span>
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
      <div className="aspect-[16/9] sm:aspect-[21/9] rounded-xl bg-muted ring-1 ring-border flex flex-col items-center justify-center text-muted-foreground/50">
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
        className="sm:col-span-2 sm:row-span-2 relative group aspect-[4/3] sm:aspect-auto bg-muted overflow-hidden"
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
            className="relative group hidden sm:block aspect-square bg-muted overflow-hidden"
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
        className="sm:hidden mt-2 h-10 rounded-lg bg-card ring-1 ring-border text-sm font-medium text-foreground flex items-center justify-center gap-2"
      >
        <Expand className="w-4 h-4" />
        Show all {photos.length} photos
      </button>

      {/* Desktop "show all" floating button */}
      {photos.length > 1 && (
        <button
          type="button"
          onClick={() => onOpenLightbox(0)}
          className="hidden sm:flex absolute items-center gap-1.5 bg-card ring-1 ring-border text-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
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
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="font-semibold text-foreground">{variant.name}</h4>
            {variant.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {variant.description}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-foreground leading-tight">
              GH₵ {Number(variant.total_price).toLocaleString()}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Per year
            </div>
            {perSlot && (
              <div className="text-xs text-primary font-medium mt-1">
                Shared: GH₵ {Math.round(perSlot).toLocaleString()}/slot
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted ring-1 ring-border rounded px-2 py-1">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            {variant.min_occupancy === variant.max_occupancy
              ? `${variant.max_occupancy} per room`
              : `${variant.min_occupancy}–${variant.max_occupancy} per room`}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted ring-1 ring-border rounded px-2 py-1">
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
          </span>

          {available > 0 && (
            <AvailabilityPill tone="primary">
              {available} available
            </AvailabilityPill>
          )}
          {partial > 0 && (
            <AvailabilityPill tone="amber">
              {partial} partial
            </AvailabilityPill>
          )}
          {full > 0 && (
            <AvailabilityPill tone="muted">
              {full} full
            </AvailabilityPill>
          )}
        </div>

        {variant.features && variant.features.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-foreground">
            {variant.features.slice(0, 6).map((f, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center gap-3">
          {canBook ? (
            <Button asChild className="gap-1.5">
              <Link href={`/book/${hostelSlug}/${variant.id}`}>
                Book a room
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              Fully booked
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            15-minute hold while you pay
          </span>
        </div>
      </CardContent>

      {video && (
        <details className="border-t border-border">
          <summary className="cursor-pointer list-none px-5 py-3 flex items-center gap-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
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
    </Card>
  );
}

function AvailabilityPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "amber" | "muted";
}) {
  const classes =
    tone === "primary"
      ? "bg-primary/10 text-primary ring-primary/20"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800"
      : "bg-muted text-muted-foreground ring-border";
  const dot =
    tone === "primary"
      ? "bg-primary"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ring-1 rounded-full px-2 py-0.5 ${classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}
