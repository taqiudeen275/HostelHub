"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminHostelsApi, Hostel } from "@/lib/api";
import { PlusCircle, Building, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MyHostelsPage() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminHostelsApi
      .list()
      .then((data) => setHostels(data))
      .catch(() => toast.error("Failed to load hostels"))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Hostels</h1>
        <Link
          href="/admin/hostels/create"
          className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md font-medium transition-colors"
        >
          <PlusCircle className="h-5 w-5" />
          Add Hostel
        </Link>
      </div>

      {hostels.length === 0 ? (
        <div className="rounded-xl border border-dashed flex flex-col items-center justify-center h-64 text-center p-8 bg-white/50">
          <Building className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h2 className="text-xl font-semibold mb-2">No hostels yet</h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            You haven't added any hostels. Add your first hostel to start receiving bookings.
          </p>
          <Link
            href="/admin/hostels/create"
            className="flex items-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-md font-medium transition-colors"
          >
            <PlusCircle className="h-5 w-5" />
            Add Your First Hostel
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {hostels.map((hostel) => (
            <div key={hostel.id} className="bg-white rounded-xl shadow-sm border p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-lg line-clamp-1 flex-1 pointer">
                  {hostel.name}
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 ${
                  hostel.status === 'APPROVED' ? "bg-green-100 text-green-700" :
                  hostel.status === 'PENDING' ? "bg-amber-100 text-amber-700" :
                  hostel.status === 'REJECTED' ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {hostel.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                {hostel.description}
              </p>
              <div className="pt-4 border-t flex justify-between items-center text-sm">
                <span className="text-muted-foreground truncate">{hostel.address_text}</span>
                <Link
                  href={`/admin/hostels/${hostel.id}`}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
