"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminHostelsApi, Hostel, HostelMedia } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft, UploadCloud, Image as ImageIcon, Video, X } from "lucide-react";
import Link from "next/link";

export default function ManageHostelPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHostel();
  }, [id]);

  const fetchHostel = async () => {
    try {
      const data = await adminHostelsApi.get(id);
      setHostel(data);
    } catch (err) {
      toast.error("Failed to load hostel data");
      // router.push("/admin/hostels");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size client-side
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    
    if (file.size > maxSize) {
      toast.error(`File too large. Max size is ${isVideo ? '50MB' : '10MB'}.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await adminHostelsApi.uploadMedia(id, file, "", (progressEvent) => {
        if (progressEvent.lengthComputable) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      toast.success("Media uploaded successfully");
      await fetchHostel(); // refresh media list
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      await adminHostelsApi.deleteMedia(id, mediaId);
      toast.success("Media deleted");
      await fetchHostel();
    } catch {
      toast.error("Failed to delete media");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!hostel) return null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/admin/hostels" className="p-2 border rounded-md hover:bg-muted text-muted-foreground w-10 h-10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{hostel.name}</h1>
          <p className="text-sm text-muted-foreground">{hostel.address_text}</p>
        </div>
        <div className="ml-auto">
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            hostel.status === 'APPROVED' ? "bg-green-100 text-green-700" :
            hostel.status === 'PENDING' ? "bg-amber-100 text-amber-700" :
            hostel.status === 'REJECTED' ? "bg-red-100 text-red-700" :
            "bg-gray-100 text-gray-700"
          }`}>
            {hostel.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main View - Media */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Media Gallery</h2>
            
            {/* Uploader Box */}
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-8 ${isUploading ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-gray-50'}`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/*,video/*" 
                className="hidden" 
              />
              {isUploading ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p className="text-sm font-medium text-indigo-700">Uploading... {uploadProgress}%</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center cursor-pointer space-y-4">
                  <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium inline-block">Click to upload</p>
                    <p className="text-sm text-muted-foreground mt-1">Images (max 10MB) or Videos (max 50MB)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Gallery Grid */}
            {hostel.media.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {hostel.media.map(media => (
                  <div key={media.id} className="group relative aspect-square rounded-lg border bg-gray-100 overflow-hidden">
                    {media.type === 'PHOTO' ? (
                      <img src={media.thumbnail ?? media.file} alt={media.caption || 'Hostel image'} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-800">
                        <Video className="w-8 h-8 mb-2 opacity-80" />
                        <span className="text-xs uppercase tracking-widest font-medium opacity-80">Video</span>
                      </div>
                    )}
                    <button onClick={() => handleDeleteMedia(media.id)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10">
                      <X className="w-4 h-4" />
                    </button>
                    {media.type === 'PHOTO' && <div className="absolute top-2 left-2 bg-black/50 text-white rounded-md p-1 backdrop-blur-sm pointer-events-none"><ImageIcon className="w-3 h-3" /></div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>No media uploaded yet.</p>
              </div>
            )}

          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Room Variants & Rooms</h2>
            </div>
            
            {hostel.variants && hostel.variants.length > 0 ? (
              <div className="space-y-6">
                {hostel.variants.map((variant) => (
                  <div key={variant.id} className="border rounded-lg p-4 bg-gray-50/50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{variant.name}</h3>
                        <p className="text-sm text-muted-foreground">{variant.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="block font-bold text-lg text-indigo-700">GH₵ {variant.total_price}</span>
                        <span className="text-xs text-muted-foreground">per academic year</span>
                      </div>
                    </div>
                    
                    <div className="text-sm mb-4">
                      <span className="font-medium">Capacity:</span> {variant.min_occupancy === variant.max_occupancy ? variant.max_occupancy : `${variant.min_occupancy} - ${variant.max_occupancy}`} person(s)
                    </div>

                    <div className="pt-4 border-t">
                      <h4 className="font-medium text-sm mb-2 text-muted-foreground">Rooms ({variant.rooms.length})</h4>
                      {variant.rooms.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {variant.rooms.map(room => (
                            <span key={room.id} className="bg-white border text-sm px-3 py-1 rounded-md shadow-sm">
                              {room.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">No rooms generated for this variant yet.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
                <p>No room variants added yet.</p>
                <p className="text-sm mt-1">Room variants define the type of rooms available (e.g., "1-in-a-room").</p>
              </div>
            )}
            
            <div className="mt-6 text-center border-t pt-6">
              <button 
                onClick={() => toast.success("This would open the variant manager!")} 
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md font-medium transition-colors"
              >
                Manage Variant Configuration
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-lg mb-4">Hostel Details</h3>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Description</span>
                <p className="text-sm">{hostel.description}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Gender Policy</span>
                <p className="text-sm font-medium">{hostel.gender_policy}</p>
              </div>
              <div className="pt-4 border-t">
                <span className="text-sm text-muted-foreground block mb-2">Amenities</span>
                <div className="flex gap-2 flex-wrap">
                  {hostel.amenities.map(a => (
                    <span key={a.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-medium border border-indigo-100">
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
