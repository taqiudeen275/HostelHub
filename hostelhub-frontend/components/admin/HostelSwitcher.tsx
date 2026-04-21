"use client";

import { useEffect, useState } from "react";
import { Hostel, adminHostelsApi } from "@/lib/api";
import { useParams, useRouter, usePathname } from "next/navigation";
import { ChevronDown, Plus, Building } from "lucide-react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function HostelSwitcher() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  // If we are on /admin/hostels/[id], we can parse id from params
  const activeId = params?.id as string | undefined;

  useEffect(() => {
    fetchHostels();
  }, []);

  const fetchHostels = async () => {
    try {
      const data = await adminHostelsApi.list();
      setHostels(data);
    } catch (err) {
      console.error("Failed to load hostels for switcher", err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeHostel = hostels.find(h => h.id === activeId);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".hostel-switcher")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
  }

  return (
    <div className="relative hostel-switcher">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-gray-100/50 px-3 py-1.5 rounded-lg transition-colors"
      >
        <span className="font-semibold text-gray-900 tracking-tight text-sm">
          {activeHostel ? activeHostel.name : "Select a Hostel..."}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden z-50">
          <div className="p-2 space-y-1">
            {hostels.length > 0 ? (
              hostels.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/admin/hostels/${h.id}`);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    activeId === h.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <Building className="w-4 h-4 shrink-0 text-gray-400" />
                  <span className="truncate">{h.name}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No hostels yet</div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-100 bg-gray-50">
            <Link 
              href="/admin/hostels/create"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-lg transition-colors font-medium"
            >
              <Plus className="w-4 h-4" /> Create New Hostel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
