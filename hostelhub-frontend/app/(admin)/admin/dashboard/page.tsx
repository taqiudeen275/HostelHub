"use client";

import { Building2, ClipboardList, MessageSquare, Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const businessName = user?.hostel_admin_profile?.business_name || user?.full_name || "Partner";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>M1 placeholder — hostel management lands in M2</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome, {businessName}.
        </h1>
        <p className="text-muted-foreground mt-2">
          You're signed in as a hostel admin. The tools below come online over the next few weeks.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: Building2,
            title: "My Hostels",
            description: "Create listings, add rooms, upload photos and video walkthroughs.",
            milestone: "M2",
          },
          {
            icon: ClipboardList,
            title: "Bookings",
            description: "Track confirmed bookings, check students in and out.",
            milestone: "M4",
          },
          {
            icon: MessageSquare,
            title: "SMS Broadcasts",
            description: "Send announcements to all currently-booked students.",
            milestone: "M5",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border bg-card p-6 opacity-75"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-4">
              <card.icon className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-lg">{card.title}</h2>
              <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                {card.milestone}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
