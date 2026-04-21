"use client";

import Link from "next/link";
import { Image as ImageIcon, MapPin, Users, Wifi } from "lucide-react";

import type { Hostel } from "@/lib/api";

interface HostelCardProps {
  hostel: Hostel;
  href?: string;
}

export function HostelCard({ hostel, href }: HostelCardProps) {
  const target = href ?? `/hostels/${hostel.slug}`;

  const mainPhoto = hostel.media?.find((m) => m.type === "PHOTO");
  const photoCount = hostel.media?.filter((m) => m.type === "PHOTO").length ?? 0;

  const prices = (hostel.variants ?? [])
    .map((v) => Number(v.total_price))
    .filter((p) => p > 0);
  const startingPrice = prices.length ? Math.min(...prices) : 0;

  const sharedPerSlot = (hostel.variants ?? [])
    .filter((v) => v.max_occupancy > 1)
    .map((v) => Number(v.total_price) / v.max_occupancy)
    .filter((p) => p > 0);
  const fromSlotPrice = sharedPerSlot.length ? Math.min(...sharedPerSlot) : 0;

  const allRooms = (hostel.variants ?? []).flatMap((v) => v.rooms ?? []);
  const availableRooms = allRooms.filter((r) => r.status === "AVAILABLE").length;
  const partialRooms = allRooms.filter((r) => r.status === "PARTIALLY_BOOKED").length;
  const totalRooms = allRooms.length;
  const isSoldOut = totalRooms > 0 && availableRooms === 0 && partialRooms === 0;

  const topAmenities = (hostel.amenities ?? []).slice(0, 3);
  const extraAmenities = Math.max(0, (hostel.amenities?.length ?? 0) - 3);

  const genderTone =
    hostel.gender_policy === "MALE"
      ? "bg-sky-50 text-sky-700 ring-sky-200"
      : hostel.gender_policy === "FEMALE"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-violet-50 text-violet-700 ring-violet-200";

  return (
    <Link
      href={target}
      className="group grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-0 rounded-xl bg-white ring-1 ring-gray-200 hover:ring-emerald-300 hover:shadow-[0_8px_20px_-12px_rgba(16,185,129,0.25)] transition-all overflow-hidden"
    >
      {/* Photo */}
      <div className="relative bg-gray-100 aspect-[4/3] sm:aspect-auto sm:min-h-[180px] overflow-hidden">
        {mainPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainPhoto.thumbnail || mainPhoto.file}
            alt={hostel.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-300">
            <ImageIcon className="w-8 h-8" />
            <span className="text-xs">No photo</span>
          </div>
        )}
        {photoCount > 1 && (
          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[11px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
            {photoCount} photos
          </span>
        )}
        {isSoldOut && (
          <span className="absolute top-2 right-2 bg-gray-900/85 text-white text-[11px] font-semibold px-2 py-0.5 rounded backdrop-blur-sm">
            Fully booked
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex flex-col gap-2 min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 line-clamp-1 flex-1 min-w-0 group-hover:text-emerald-700 transition-colors">
            {hostel.name}
          </h3>
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider font-semibold ring-1 rounded px-1.5 py-0.5 ${genderTone}`}
          >
            {hostel.gender_policy}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-500 text-sm min-w-0">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="line-clamp-1">{hostel.address_text}</span>
        </div>

        {topAmenities.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {topAmenities.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 ring-1 ring-gray-200 rounded px-1.5 py-0.5"
              >
                <Wifi className="w-3 h-3 text-gray-400" />
                {a.name}
              </span>
            ))}
            {extraAmenities > 0 && (
              <span className="text-[11px] font-medium text-gray-500">
                +{extraAmenities} more
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-end justify-between gap-3">
          <div className="flex flex-col min-w-0">
            {startingPrice > 0 ? (
              <>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                  From
                </span>
                <span className="text-lg font-bold text-gray-900 leading-none">
                  GH₵ {startingPrice.toLocaleString()}
                  <span className="text-xs font-normal text-gray-500">/yr</span>
                </span>
                {fromSlotPrice > 0 && fromSlotPrice < startingPrice && (
                  <span className="text-[11px] text-emerald-700 font-medium mt-0.5">
                    Shared from GH₵ {Math.round(fromSlotPrice).toLocaleString()}/yr
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-gray-400">Pricing coming soon</span>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {totalRooms > 0 ? (
              availableRooms + partialRooms > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {availableRooms + partialRooms} open
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-50 ring-1 ring-gray-200 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Full
                </span>
              )
            ) : null}
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <Users className="w-3 h-3" />
              {hostel.variants?.length || 0} layouts
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
