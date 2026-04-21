"use client";

import { useEffect, useState, useRef, DragEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminHostelsApi, adminVariantsApi, Hostel, HostelMedia, RoomVariant } from "@/lib/api";
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

  // Drag-to-reorder state
  const [mediaItems, setMediaItems] = useState<HostelMedia[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  // Drag-to-upload state (GAP-M2-05)
  const [isDragOver, setIsDragOver] = useState(false);

  // Variant State
  const [variants, setVariants] = useState<RoomVariant[]>([]);
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [vName, setVName] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vPrice, setVPrice] = useState("");
  const [vMin, setVMin] = useState("1");
  const [vMax, setVMax] = useState("1");

  // Rooms State
  const [addingRoomsTo, setAddingRoomsTo] = useState<string | null>(null);
  const [roomLabels, setRoomLabels] = useState("");

  useEffect(() => {
    fetchHostel();
  }, [id]);

  const fetchHostel = async () => {
    try {
      const data = await adminHostelsApi.get(id);
      setHostel(data);
      setMediaItems([...data.media].sort((a,b) => a.display_order - b.display_order));
      setVariants(data.variants || []);
    } catch (err) {
      toast.error("Failed to load hostel data");
      router.push("/admin/hostels");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await doUploadFile(file);
  };

  const handleDropFile = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUploadFile(file);
  };

  const doUploadFile = async (file: File) => {
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
      await fetchHostel();
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

  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedIdx(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggedIdx === null || draggedIdx === index) return;
      const newItems = [...mediaItems];
      const item = newItems.splice(draggedIdx, 1)[0];
      newItems.splice(index, 0, item);
      setDraggedIdx(index);
      setMediaItems(newItems);
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setDraggedIdx(null);
      try {
          await adminHostelsApi.reorderMedia(id, mediaItems.map(m => m.id));
          toast.success("Media reordered");
          await fetchHostel();
      } catch {
          toast.error("Failed to save media order");
      }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await adminHostelsApi.createVariant(id, {
              name: vName, description: vDesc, total_price: vPrice,
              min_occupancy: parseInt(vMin), max_occupancy: parseInt(vMax)
          });
          toast.success("Variant created");
          setIsAddingVariant(false);
          setVName(""); setVDesc(""); setVPrice(""); setVMin("1"); setVMax("1");
          await fetchHostel();
      } catch {
          toast.error("Failed to create variant");
      }
  };

  const handleBulkRooms = async (variantId: string, e: React.FormEvent) => {
      e.preventDefault();
      try {
          const labelsArray = roomLabels.split(",").map(s => s.trim()).filter(Boolean);
          if (!labelsArray.length) return;
          await adminVariantsApi.createRoomsBulk(variantId, labelsArray);
          toast.success("Rooms generated");
          setAddingRoomsTo(null);
          setRoomLabels("");
          await fetchHostel();
      } catch {
          toast.error("Format error or duplicate room labels");
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
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
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
        
        {/* Main View */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Media Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Media Gallery</h2>
            
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all mb-8 cursor-pointer ${
                isDragOver ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : isUploading ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-gray-50 border-gray-200'
              }`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDropFile}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
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

            {mediaItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {mediaItems.map((media, idx) => (
                  <div 
                    key={media.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    className={`group relative aspect-square rounded-lg border bg-gray-100 overflow-hidden cursor-move ${draggedIdx === idx ? 'opacity-50' : 'opacity-100'}`}
                  >
                    {media.type === 'PHOTO' ? (
                      <img src={media.thumbnail ?? media.file} alt={media.caption || 'Hostel image'} className="w-full h-full object-cover pointer-events-none" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-800 pointer-events-none">
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

          {/* Variants Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6">Room Configuration</h2>
            
            {variants.length > 0 ? (
              <div className="space-y-6">
                {variants.map((variant) => (
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
                      <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium text-sm text-muted-foreground">Attached Rooms ({variant.rooms?.length || 0})</h4>
                          <button onClick={() => setAddingRoomsTo(addingRoomsTo === variant.id ? null : variant.id)} className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors">+ Add Physical Rooms</button>
                      </div>

                      {addingRoomsTo === variant.id && (
                          <form onSubmit={(e) => handleBulkRooms(variant.id, e)} className="mb-4 bg-white border p-4 rounded-lg shadow-sm border-indigo-100">
                              <label className="block text-sm font-medium mb-2 text-indigo-900">Room Labels (Comma Separated)</label>
                              <div className="flex gap-2">
                                  <input autoFocus required placeholder="e.g. A1, A2, 101" value={roomLabels} onChange={e=>setRoomLabels(e.target.value)} className="flex-1 text-sm border rounded px-3 h-10 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                                  <button type="submit" className="bg-indigo-600 text-white px-4 text-sm rounded cursor-pointer hover:bg-indigo-700 font-medium">Generate</button>
                              </div>
                          </form>
                      )}

                      {(variant.rooms || []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {variant.rooms.map((room: any) => (
                            <span key={room.id} className="bg-white border text-sm px-3 py-1 rounded-md shadow-sm text-gray-800">
                              {room.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-amber-600 bg-amber-50 px-3 py-2 border border-amber-100 rounded-md block text-center mt-2">No individual rooms instantiated. Residents cannot book this configuration until labels are added.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg border border-dashed mb-6">
                <p>No room configurations added yet.</p>
                <p className="text-sm mt-1">Configure pricing and capacity rules for the rooms in this hostel.</p>
              </div>
            )}
            
            <div className="mt-6 border-t pt-6">
                {!isAddingVariant ? (
                    <button 
                        onClick={() => setIsAddingVariant(true)} 
                        className="w-full h-10 inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-800 hover:bg-gray-200 px-4 rounded-md font-medium transition-colors border outline-none"
                    >
                        + Create New Variant Type
                    </button>
                ) : (
                    <form onSubmit={handleCreateVariant} className="bg-white border-2 border-indigo-100 p-5 rounded-xl space-y-4 shadow-sm animate-in fade-in">
                        <h3 className="font-bold text-indigo-900">Create Variant Type (e.g. "1-in-a-room")</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Variant Name</label>
                                <input required value={vName} onChange={e=>setVName(e.target.value)} className="w-full border text-sm rounded h-10 px-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Total Price (GHS) per year</label>
                                <input required type="number" value={vPrice} onChange={e=>setVPrice(e.target.value)} className="w-full border text-sm rounded h-10 px-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Minimum Occupancy</label>
                                <input required type="number" min="1" value={vMin} onChange={e=>setVMin(e.target.value)} className="w-full border text-sm rounded h-10 px-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Maximum Occupancy</label>
                                <input required type="number" min="1" value={vMax} onChange={e=>setVMax(e.target.value)} className="w-full border text-sm rounded h-10 px-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                            <input required value={vDesc} onChange={e=>setVDesc(e.target.value)} className="w-full border text-sm rounded h-10 px-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setIsAddingVariant(false)} className="px-5 h-9 border rounded-md text-sm bg-white font-medium hover:bg-gray-50">Cancel</button>
                            <button type="submit" className="bg-indigo-600 text-white px-5 h-9 rounded-md text-sm cursor-pointer hover:bg-indigo-700 font-medium shadow-sm">Save Configuration</button>
                        </div>
                    </form>
                )}
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
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Address</span>
                <p className="text-sm">{hostel.address_text}</p>
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
