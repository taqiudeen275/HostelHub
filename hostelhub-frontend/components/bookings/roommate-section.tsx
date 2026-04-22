"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Loader2,
  Phone,
  UserCircle2,
  UserPlus,
  Users,
} from "lucide-react";

import { bookingsApi, type RoommateCard, type RoommatesResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";


interface Props {
  bookingId: string;
  hostelSlug: string;
  /** Only render the section if this is > 1 (booking was shared). */
  chosenOccupancy: number;
}

export function RoommateSection({ bookingId, hostelSlug, chosenOccupancy }: Props) {
  const [data, setData] = useState<RoommatesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setErr(null);
    try {
      const res = await bookingsApi.roommates(bookingId);
      setData(res);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't load roommates.");
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (chosenOccupancy <= 1) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Roommates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : err ? (
          <p className="text-sm text-muted-foreground">{err}</p>
        ) : !data ? null : (
          <>
            {data.roommates.length === 0 && data.slots_open === 0 && (
              <p className="text-sm text-muted-foreground">
                You're the only occupant of this room so far.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {data.roommates.map((r) => (
                <RoommateCardView key={r.booking_id} roommate={r} />
              ))}
              {data.slots_open > 0 && (
                <OpenSlotCard
                  count={data.slots_open}
                  hostelSlug={hostelSlug}
                />
              )}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
              Contact details shown are those your roommates have chosen to share.
              Manage your own visibility in <Link className="underline" href="/student/settings">Settings &amp; privacy</Link>.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}


function RoommateCardView({ roommate }: { roommate: RoommateCard }) {
  const initials =
    `${roommate.first_name?.[0] ?? ""}${roommate.last_name?.[0] ?? ""}`.toUpperCase() ||
    "?";
  const displayName = roommate.full_name ?? roommate.first_name;

  return (
    <div className="rounded-xl ring-1 ring-border bg-card p-4 flex items-start gap-3">
      {roommate.profile_photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roommate.profile_photo}
          alt={displayName}
          className="w-11 h-11 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground truncate">{displayName}</p>
        {(roommate.program || roommate.level) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <GraduationCap className="w-3 h-3 shrink-0" />
            {[roommate.program, roommate.level && `L${roommate.level}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {roommate.phone && (
          <a
            href={`tel:${roommate.phone}`}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Phone className="w-3 h-3" />
            {roommate.phone}
          </a>
        )}
        {!roommate.phone && !roommate.full_name && (
          <p className="text-[11px] text-muted-foreground italic mt-1">
            Private profile
          </p>
        )}
      </div>
    </div>
  );
}


function OpenSlotCard({
  count,
  hostelSlug,
}: {
  count: number;
  hostelSlug: string;
}) {
  return (
    <div className="rounded-xl border-dashed border-2 border-border bg-muted/30 p-4 flex items-start gap-3">
      <div className="w-11 h-11 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
        <UserCircle2 className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {count} slot{count === 1 ? "" : "s"} still open
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Another student may still book this room.
        </p>
        <Button asChild variant="ghost" size="sm" className="mt-1.5 h-7 px-2 gap-1">
          <Link href={`/hostels/${hostelSlug}`}>
            <UserPlus className="w-3 h-3" />
            View hostel
          </Link>
        </Button>
      </div>
    </div>
  );
}
