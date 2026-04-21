"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminHostelsApi, Hostel } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, MapPin, Users, Tag, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function HostelOverviewPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHostel();
  }, [id]);

  const fetchHostel = async () => {
    try {
      const data = await adminHostelsApi.get(id);
      setHostel(data);
    } catch (err) {
      toast.error("Failed to load hostel data");
      router.push("/admin/hostels");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!hostel) return null;

  return (
    <div className="animate-in fade-in pb-12">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 mb-2">Overview</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[180px] sm:max-w-none">{hostel.address_text}</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium text-xs border">
              {hostel.gender_policy} Only
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm ${
            hostel.status === 'APPROVED' ? "bg-green-500 text-white" :
            hostel.status === 'PENDING' ? "bg-amber-400 text-amber-950" :
            hostel.status === 'REJECTED' ? "bg-red-500 text-white" :
            "bg-gray-200 text-gray-800"
          }`}>
            {hostel.status}
          </span>
        </div>
      </div>

      {hostel.status === 'REJECTED' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                  <h3 className="font-bold text-red-900">Your property was rejected by moderation</h3>
                  <p className="text-red-700 text-sm mt-1">{hostel.rejection_reason}</p>
              </div>
          </div>
      )}

      {hostel.status === 'DRAFT' && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                      <h3 className="font-bold text-indigo-900">This property is a Draft</h3>
                      <p className="text-indigo-700 text-sm mt-1">You must upload at least 3 photos and create 1 room layout before submitting for review.</p>
                  </div>
              </div>
              <button 
                  onClick={async () => {
                      try {
                          await adminHostelsApi.submitForReview(id);
                          toast.success("Submitted successfully!");
                          fetchHostel();
                      } catch (err: any) {
                          toast.error(err.message || "Cannot submit yet.");
                      }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap transition-colors"
              >
                  Submit for Moderation
              </button>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Quick Stats Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 line-clamp-3 relative overflow-hidden group">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" /> Completion Status
            </h3>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Media Uploaded</span>
                    <span className={`font-bold ${hostel.media.length >= 3 ? 'text-green-600' : 'text-amber-600'}`}>
                        {hostel.media.length} items
                    </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Room Configurations</span>
                    <span className={`font-bold ${hostel.variants.length >= 1 ? 'text-green-600' : 'text-amber-600'}`}>
                        {hostel.variants.length} layouts
                    </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Physical Rooms</span>
                    <span className="font-bold text-gray-900">
                        {hostel.variants.reduce((acc, v) => acc + (v.rooms?.length || 0), 0)} generated
                    </span>
                </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
                <Link href={`/admin/hostels/${id}/media`} className="text-center text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg transition-colors">Manage Media</Link>
                <Link href={`/admin/hostels/${id}/variants`} className="text-center text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg transition-colors">Setup Rooms</Link>
            </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-400" /> Property Profile
            </h3>
            <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed mb-6">{hostel.description}</p>
            
            <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Amenities Detected</span>
                <div className="flex flex-wrap gap-2">
                    {hostel.amenities.map(a => (
                        <span key={a.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-medium border border-gray-200">{a.name}</span>
                    ))}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
