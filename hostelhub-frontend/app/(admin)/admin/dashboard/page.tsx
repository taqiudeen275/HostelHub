"use client";

import { useEffect, useState } from "react";
import { adminHostelsApi, Hostel } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Building2, Clock, CheckCircle, XCircle, Plus, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const displayName =
    user?.hostel_admin_profile?.business_name || user?.full_name || "Partner";

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminHostelsApi
      .list()
      .then(setHostels)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const stats = {
    total: hostels.length,
    pending: hostels.filter((h) => h.status === "PENDING").length,
    approved: hostels.filter((h) => h.status === "APPROVED").length,
    draft: hostels.filter((h) => h.status === "DRAFT").length,
    rejected: hostels.filter((h) => h.status === "REJECTED").length,
  };

  const cards = [
    { label: "Total Hostels", value: stats.total, icon: Building2, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hostel Admin Panel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {displayName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s a snapshot of your hostel portfolio.
          </p>
        </div>
        <Link
          href="/admin/hostels/create"
          className="inline-flex shrink-0 items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 rounded-md text-sm font-medium transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          Add Hostel
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              {isLoading ? (
                <div className="h-8 w-10 bg-gray-100 rounded-md animate-pulse" />
              ) : (
                <span className="text-3xl font-bold text-foreground">{card.value}</span>
              )}
              <span className="text-sm text-muted-foreground">{card.label}</span>
            </div>
          );
        })}
      </div>

      {/* Recent hostels list */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">My Hostels</h2>
          <Link
            href="/admin/hostels"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : hostels.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No hostels yet</p>
            <p className="text-sm mt-1">Get started by adding your first hostel listing.</p>
            <Link
              href="/admin/hostels/create"
              className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 h-9 px-4 rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Hostel
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {hostels.slice(0, 5).map((h) => (
              <Link
                key={h.id}
                href={`/admin/hostels/${h.id}`}
                className="flex items-center justify-between py-4 hover:bg-gray-50 px-2 -mx-2 rounded-lg transition-colors group gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{h.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{h.address_text}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    h.status === "APPROVED" ? "bg-green-100 text-green-700" :
                    h.status === "PENDING"  ? "bg-amber-100 text-amber-700" :
                    h.status === "REJECTED" ? "bg-red-100 text-red-600" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {h.status}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Manage Hostels", href: "/admin/hostels", desc: "View and edit your hostel listings" },
          { label: "Bookings", href: "/admin/bookings", desc: "Track and manage student bookings" },
          { label: "SMS Broadcasts", href: "/admin/sms", desc: "Send messages to your residents" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-white rounded-xl border shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
          >
            <p className="font-semibold text-sm group-hover:text-indigo-700 transition-colors flex items-center justify-between">
              {link.label}
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
