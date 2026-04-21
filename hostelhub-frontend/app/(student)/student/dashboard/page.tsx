"use client";

import Link from "next/link";
import { ArrowRight, Building2, Settings2, Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.first_name || "there";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>M1 placeholder — real dashboard lands in M4</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome back, {firstName}.
        </h1>
        <p className="text-muted-foreground mt-2">
          You're signed in as a student. Booking and roommate features arrive in the next milestones.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/hostels"
          className="group rounded-2xl border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Building2 className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-lg">Browse hostels</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Find verified student accommodation near your campus.
          </p>
          <div className="flex items-center gap-1 mt-4 text-sm font-medium text-primary">
            Explore <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        <Link
          href="/student/settings"
          className="group rounded-2xl border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-muted text-foreground/70 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Settings2 className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-lg">Settings &amp; privacy</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control who can see your name, phone, and photo.
          </p>
          <div className="flex items-center gap-1 mt-4 text-sm font-medium text-foreground/80">
            Manage <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <div className="rounded-2xl border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">What's coming next</p>
        <ul className="space-y-1 list-disc pl-5">
          <li>Hostel browsing &amp; filtering (M3)</li>
          <li>Room booking with shared-occupancy pricing (M4)</li>
          <li>Paystack payment flow (M4)</li>
          <li>Roommate cards with privacy-aware fields (M5)</li>
        </ul>
      </div>
    </div>
  );
}
