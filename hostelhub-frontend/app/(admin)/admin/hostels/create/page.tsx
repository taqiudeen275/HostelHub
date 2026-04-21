"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { adminHostelsApi, adminVariantsApi, Amenity, HostelMedia, RoomVariant } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Save, Check, UploadCloud, GripVertical, Plus } from "lucide-react";
import Link from "next/link";

export default function CreateHostelPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  // State
  const [hostelId, setHostelId] = useState<string | null>(null);
  
  // Step 1: Basic
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [genderPolicy, setGenderPolicy] = useState<"MALE" | "FEMALE" | "MIXED">("MIXED");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  
  // Step 2: Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<Set<number>>(new Set());

  // Step 3: Media
  const [mediaList, setMediaList] = useState<HostelMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4: Variants
  const [variants, setVariants] = useState<RoomVariant[]>([]);
  const [variantName, setVariantName] = useState("");
  const [variantDesc, setVariantDesc] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantMin, setVariantMin] = useState("1");
  const [variantMax, setVariantMax] = useState("1");
  
  // Step 5: Rooms
  const [selectedVariantForRooms, setSelectedVariantForRooms] = useState<string>("");
  const [roomLabels, setRoomLabels] = useState(""); // Comma separated

  useEffect(() => {
    adminHostelsApi.getAmenities().then(setAmenities).catch(console.error);
  }, []);

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const submitHostel = async () => {
    setIsSubmitting(true);
    try {
      if (hostelId) {
        // If already created, just update (mock logic here, usually we'd patch if we went back)
        setStep(3);
        setIsSubmitting(false);
        return;
      }
      
      const res = await adminHostelsApi.create({
        name, description, address_text: address,
        latitude: null, longitude: null, gender_policy: genderPolicy,
        owner_contact_phone: phone, owner_contact_whatsapp: whatsapp || null,
        amenity_ids: Array.from(selectedAmenities)
      });
      setHostelId(res.id);
      toast.success("Hostel structure saved! Let's add photos.");
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to create hostel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Step 3 Media Handlers ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !hostelId) return;

    setIsSubmitting(true);
    try {
      const newMedia = await adminHostelsApi.uploadMedia(hostelId, file, "", (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded * 100) / ev.total));
      });
      setMediaList([...mediaList, newMedia]);
      toast.success("Uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelId) return;
    setIsSubmitting(true);
    try {
      const res = await adminHostelsApi.createVariant(hostelId, {
        name: variantName,
        description: variantDesc,
        total_price: variantPrice,
        min_occupancy: parseInt(variantMin),
        max_occupancy: parseInt(variantMax)
      });
      setVariants([...variants, res]);
      toast.success("Variant created");
      setVariantName(""); setVariantDesc(""); setVariantPrice(""); setVariantMin("1"); setVariantMax("1");
    } catch (e: any) {
      toast.error("Failed to create variant");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkRooms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantForRooms || !roomLabels) return;
    setIsSubmitting(true);
    try {
      const labelsArray = roomLabels.split(",").map(s => s.trim()).filter(Boolean);
      await adminVariantsApi.createRoomsBulk(selectedVariantForRooms, labelsArray);
      toast.success(`${labelsArray.length} rooms generated!`);
      setRoomLabels("");
    } catch {
      toast.error("Failed to bulk generate rooms (Duplicate labels?)");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => step > 1 ? setStep((step - 1) as any) : router.push("/admin/hostels")} className="p-2 border rounded-md hover:bg-muted text-muted-foreground w-10 h-10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Add New Hostel</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 6</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
        
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-semibold border-b pb-2">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hostel Name *</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="w-full h-10 border rounded-md px-3" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea required rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded-md p-3" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address *</label>
                <input required value={address} onChange={e => setAddress(e.target.value)} className="w-full h-10 border rounded-md px-3" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium mb-1">Contact Phone *</label>
                    <input required value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-10 border rounded-md px-3" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">Gender Policy</label>
                    <select value={genderPolicy} onChange={e => setGenderPolicy(e.target.value as any)} className="w-full h-10 border rounded-md px-3">
                      <option value="MIXED">Mixed</option>
                      <option value="MALE">Male Only</option>
                      <option value="FEMALE">Female Only</option>
                    </select>
                 </div>
              </div>
            </div>
            <div className="flex justify-end pt-4"><button type="submit" className="flex items-center gap-2 bg-indigo-600 text-white px-6 h-10 rounded-md pointer">Next Step <ArrowRight className="w-4 h-4" /></button></div>
          </form>
        )}

        {/* Step 2: Amenities */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
             <h2 className="text-xl font-semibold border-b pb-2">Amenities</h2>
             <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {amenities.map(a => {
                const checked = selectedAmenities.has(a.id);
                return (
                  <button key={a.id} onClick={() => {
                    const next = new Set(selectedAmenities);
                    checked ? next.delete(a.id) : next.add(a.id);
                    setSelectedAmenities(next);
                  }} className={`p-4 border rounded-xl text-center ${checked ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : ''}`}>
                    {a.name}
                  </button>
                )
              })}
             </div>
             <div className="flex justify-end pt-4"><button disabled={isSubmitting} onClick={submitHostel} className="flex items-center gap-2 bg-indigo-600 text-white px-6 h-10 rounded-md pointer">{isSubmitting ? 'Saving...' : 'Create & Continue'} <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {/* Step 3: Photos */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-semibold border-b pb-2">Hostel Gallery</h2>
            <div className="border-2 border-dashed rounded-xl p-8 text-center" onClick={() => !isSubmitting && fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
              {isSubmitting ? (
                <div>Uploading... {uploadProgress}%</div>
              ) : (
                <div className="cursor-pointer text-indigo-600 flex flex-col items-center"><UploadCloud className="w-8 h-8 mb-2" /> Click to upload Media</div>
              )}
            </div>
            <div className="flex gap-4 overflow-x-auto py-2">
              {mediaList.map(m => (
                <div key={m.id} className="w-32 h-32 flex-shrink-0 border rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden relative">
                   {m.type === 'PHOTO' ? <img src={m.thumbnail || m.file} className="w-full h-full object-cover" /> : <span>Video</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4"><button onClick={() => setStep(4)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 h-10 rounded-md pointer">Next Step <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {/* Step 4: Variants */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in">
             <h2 className="text-xl font-semibold border-b pb-2">Room Configurations</h2>
             <form onSubmit={handleCreateVariant} className="bg-gray-50 border p-4 rounded-xl space-y-4">
                <h3 className="font-medium text-sm text-indigo-700">Add a Room Variant Type (e.g. "2 in a room")</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Name" value={variantName} onChange={e=>setVariantName(e.target.value)} className="border rounded h-10 px-3" />
                  <input required placeholder="Price (GHS)" type="number" value={variantPrice} onChange={e=>setVariantPrice(e.target.value)} className="border rounded h-10 px-3" />
                  <input required placeholder="Min Occupancy" type="number" min="1" value={variantMin} onChange={e=>setVariantMin(e.target.value)} className="border rounded h-10 px-3" />
                  <input required placeholder="Max Occupancy" type="number" min="1" value={variantMax} onChange={e=>setVariantMax(e.target.value)} className="border rounded h-10 px-3" />
                </div>
                <input required placeholder="Description" value={variantDesc} onChange={e=>setVariantDesc(e.target.value)} className="w-full border rounded h-10 px-3" />
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-black text-white px-4 h-10 rounded-md text-sm"><Plus className="w-4 h-4"/> Add Variant</button>
             </form>

             <div className="space-y-2">
               {variants.map(v => (
                 <div key={v.id} className="border p-3 rounded-lg flex justify-between items-center text-sm font-medium">
                   <span>{v.name}</span>
                   <span>GH₵{v.total_price} | Max: {v.max_occupancy}</span>
                 </div>
               ))}
             </div>

            <div className="flex justify-end pt-4"><button onClick={() => setStep(5)} disabled={variants.length === 0} className="flex items-center gap-2 bg-indigo-600 text-white px-6 h-10 rounded-md pointer disabled:opacity-50">Next Step <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {/* Step 5: Rooms */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in">
             <h2 className="text-xl font-semibold border-b pb-2">Bulk Generate Rooms</h2>
             <p className="text-sm text-muted-foreground">Now attach physical room labels to your configurations.</p>
             
             <form onSubmit={handleBulkRooms} className="space-y-4 border p-4 rounded-xl">
               <div>
                  <label className="block text-sm mb-1">Select Variant</label>
                  <select required value={selectedVariantForRooms} onChange={e=>setSelectedVariantForRooms(e.target.value)} className="w-full border rounded h-10 px-3">
                    <option value="">-- Choose --</option>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-sm mb-1">Room Labels (Comma Separated)</label>
                  <textarea required placeholder="e.g. A1, A2, 101, 102" value={roomLabels} onChange={e=>setRoomLabels(e.target.value)} className="w-full border rounded p-3" rows={3}></textarea>
               </div>
               <button type="submit" disabled={isSubmitting} className="bg-black text-white px-4 py-2 rounded-md font-medium text-sm">Generate Physical Rooms</button>
             </form>
             <div className="flex justify-end pt-4"><button onClick={() => setStep(6)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 h-10 rounded-md pointer">Review Setup <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div className="text-center space-y-6 py-12 animate-in fade-in">
             <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8" />
             </div>
             <div>
                <h2 className="text-2xl font-bold">Hostel Initialized!</h2>
                <p className="text-muted-foreground mt-2">Your hostel is currently Pending Approval.<br/>You can manage rooms and media from the main dashboard.</p>
             </div>
             <Link href="/admin/hostels" className="inline-flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-6 rounded-md font-medium transition-colors">
                Go to Dashboard
             </Link>
          </div>
        )}
      </div>
    </div>
  );
}
