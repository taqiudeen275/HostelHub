"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { HostelMedia } from "@/lib/api";

interface PhotoLightboxProps {
  media: HostelMedia[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
}

export function PhotoLightbox({
  media,
  open,
  onOpenChange,
  initialIndex = 0,
}: PhotoLightboxProps) {
  const photos = useMemo(
    () => media.filter((m) => m.type === "PHOTO"),
    [media]
  );
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setIndex(Math.min(initialIndex, photos.length - 1));
  }, [open, initialIndex, photos.length]);

  const next = useCallback(
    () => setIndex((i) => (i + 1) % Math.max(photos.length, 1)),
    [photos.length]
  );
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + photos.length) % Math.max(photos.length, 1)),
    [photos.length]
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev]);

  if (photos.length === 0) return null;
  const current = photos[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-[95vw] p-0 bg-black/95 border-none"
        showCloseButton={false}
      >
        <button
          aria-label="Close"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center h-[85vh] relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.id}
            src={current.file}
            alt={current.caption ?? ""}
            className="max-w-full max-h-full object-contain select-none"
          />
          {photos.length > 1 && (
            <>
              <button
                aria-label="Previous photo"
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                aria-label="Next photo"
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
            {index + 1} / {photos.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
