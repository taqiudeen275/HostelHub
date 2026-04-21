"use client";

import { BarChart3, ClipboardCheck, ShieldCheck, Sparkles, Users } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

export default function SuperAdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>M1 placeholder — platform tools land from M3 onwards</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Platform control centre
        </h1>
        <p className="text-muted-foreground mt-2">
          Signed in as {user?.email}. Approvals, user management, and metrics are scaffolded below.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: ClipboardCheck,
            title: "Hostel approvals",
            description: "Review and approve new hostel submissions.",
            milestone: "M3",
          },
          {
            icon: Users,
            title: "Users",
            description: "Search, deactivate, and onboard hostel admins.",
            milestone: "M3",
          },
          {
            icon: BarChart3,
            title: "Platform metrics",
            description: "Bookings, revenue, active hostels, SMS usage.",
            milestone: "M6",
          },
          {
            icon: ShieldCheck,
            title: "Audit log",
            description: "Every sensitive action — approvals, deactivations, impersonations.",
            milestone: "M3",
          },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border bg-card p-6 opacity-75">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4">
              <card.icon className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold">{card.title}</h2>
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
