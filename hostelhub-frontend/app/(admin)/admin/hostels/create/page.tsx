"use client";

import React, { useEffect, useState, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { adminHostelsApi, adminVariantsApi, Amenity, HostelMedia, RoomVariant } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Check, UploadCloud, Plus, X, Building, Tag, Camera, Columns, Sparkles } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api"; // for raw POSTs if needed

const STEPS = [
  { id: 1, title: "Basic Information", icon: Building },
  { id: 2, title: "Amenities", icon: Tag },
  { id: 3, title: "Gallery", icon: Camera },
  { id: 4, title: "Room Setup", icon: Columns },
  { id: 5, title: "Review", icon: Check }
];

export default function PremiumCreateHostelWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Basics
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("MIXED");
  const [phone, setPhone] = useState("");

  // Step 2: Amenities
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [selectedAmens, setSelectedAmens] = useState<number[]>([]);
  const [customAmenity, setCustomAmenity] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Step 3: Media
  const [mediaList, setMediaList] = useState<HostelMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4: Variants
  const [variants, setVariants] = useState<RoomVariant[]>([]);
  const [vName, setVName] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vPrice, setVPrice] = useState("");
  const [vMin, setVMin] = useState("1");
  const [vMax, setVMax] = useState("1");
  // Smart Engine State
  const [addingRoomsTo, setAddingRoomsTo] = useState<string | null>(null);
  const [genMode, setGenMode] = useState<"SMART" | "MANUAL">("SMART");
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualLabels, setManualLabels] = useState("");
  const [smartPrefix, setSmartPrefix] = useState("");
  const [smartStart, setSmartStart] = useState(1);
  const [smartCount, setSmartCount] = useState(10);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    adminHostelsApi.getAmenities().then(setAllAmenities).catch(console.error);
  }, []);

  const projectedLabels = React.useMemo(() => {
     let c = Math.min(Math.max(1, smartCount), 200);
     return Array.from({length: c}, (_, i) => ({
         idx: i,
         label: `${smartPrefix}${smartStart + i}`,
         excluded: excludedIndices.has(i)
     }));
  }, [smartPrefix, smartStart, smartCount, excludedIndices]);

  const commitRooms = async (variantId: string, labels: string[]) => {
      setIsGenerating(true);
      try {
        if (!labels.length) return;
        await adminVariantsApi.createRoomsBulk(variantId, labels);
        toast.success(`${labels.length} Rooms Generated!`);
        setAddingRoomsTo(null);
        setManualLabels("");
        setSmartPrefix("");
        setSmartStart(1);
        setSmartCount(10);
        setExcludedIndices(new Set());
        const hData = await adminHostelsApi.get(hostelId!);
        setVariants(hData.variants || []);
      } catch {
        toast.error("Constraint error or duplicate room labels detected.");
      } finally {
        setIsGenerating(false);
      }
  };

  const handleManualSubmit = (variantId: string, e: React.FormEvent) => {
      e.preventDefault();
      const arr = manualLabels.split(",").map(s => s.trim()).filter(Boolean);
      commitRooms(variantId, arr);
  };

  const handleSmartSubmit = (variantId: string) => {
      const arr = projectedLabels.filter(x => !x.excluded).map(x => x.label);
      commitRooms(variantId, arr);
  };

  const openGenerator = (vid: string) => {
      setAddingRoomsTo(vid);
      setExcludedIndices(new Set());
      setSmartCount(10);
  };

  // --- Handlers ---
  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!hostelId) {
        const res = await adminHostelsApi.create({
          name, description: desc, address_text: address,
          latitude: 0, longitude: 0, gender_policy: gender, owner_contact_phone: phone
        });
        setHostelId(res.id);
      } else {
        await adminHostelsApi.update(hostelId, {
          name, description: desc, address_text: address,
          gender_policy: gender, owner_contact_phone: phone
        });
      }
      setStep(2);
    } catch {
      toast.error("Failed to save basics");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAmenities = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelId) return;
    setIsSubmitting(true);
    try {
      await adminHostelsApi.update(hostelId, { amenity_ids: selectedAmens });
      setStep(3);
    } catch {
      toast.error("Failed to update amenities");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomAmenity = async () => {
    if (!customAmenity.trim()) return;
    setIsAddingCustom(true);
    try {
      const res = await api.post<Amenity>('/amenities/', { name: customAmenity.trim() });
      setAllAmenities(prev => [...prev.filter(a => a.id !== res.id), res].sort((a,b)=>a.name.localeCompare(b.name)));
      setSelectedAmens(prev => [...prev, res.id]);
      setCustomAmenity("");
      toast.success("Custom amenity added");
    } catch {
      toast.error("Failed to add amenity. It might already exist.");
    } finally {
      setIsAddingCustom(false);
    }
  };

  const doUpload = async (file: File) => {
    if (!hostelId) return;
    setIsSubmitting(true);
    try {
      const newMedia = await adminHostelsApi.uploadMedia(hostelId, file, "", (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded * 100) / ev.total));
      });
      setMediaList(prev => [...prev, newMedia]);
      toast.success("Uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelId) return;
    setIsSubmitting(true);
    try {
      const res = await adminHostelsApi.createVariant(hostelId, {
        name: vName, description: vDesc, total_price: vPrice,
        min_occupancy: parseInt(vMin), max_occupancy: parseInt(vMax)
      });
      setVariants([...variants, res]);
      toast.success("Room layout added");
      setVName(""); setVDesc(""); setVPrice(""); setVMin("1"); setVMax("1");
    } catch {
      toast.error("Failed to save layout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkRooms = async (variantId: string, e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const labelsArray = roomLabels.split(",").map(s => s.trim()).filter(Boolean);
      if (!labelsArray.length) return;
      await adminVariantsApi.createRoomsBulk(variantId, labelsArray);
      toast.success("Rooms generated successfully!");
      setAddingRoomsTo(null);
      setRoomLabels("");
      const hData = await adminHostelsApi.get(hostelId!);
      setVariants(hData.variants || []);
    } catch {
      toast.error("Format error or duplicate room labels detected");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar Navigation */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 hidden md:flex flex-col">
        <div className="p-8">
            <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-900 transition-colors mb-10 flex items-center gap-2 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Exit Setup
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-8">New Property Setup</h1>
            <nav className="space-y-6 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:border-l before:border-gray-200 before:z-0">
                {STEPS.map((s) => {
                    const isActive = step === s.id;
                    const isCompleted = step > s.id;
                    const Icon = s.icon;
                    return (
                        <div key={s.id} className={`flex items-start gap-4 relative z-10 transition-opacity ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors duration-300 ${isCompleted ? 'bg-indigo-600 border-indigo-600' : isActive ? 'bg-white border-indigo-600' : 'bg-white border-gray-300'}`}>
                                {isCompleted ? <Check className="w-4 h-4 text-white" /> : <span className={`text-xs font-bold ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>{s.id}</span>}
                            </div>
                            <div className="pt-1">
                                <h3 className={`text-sm font-bold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{s.title}</h3>
                            </div>
                        </div>
                    )
                })}
            </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-12 md:py-24">
            
            {/* Step 1: Basics */}
            {step === 1 && (
                <div className="animate-in slide-in-from-right-4 fade-in duration-500">
                    <div className="mb-8">
                        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Property Details</h2>
                        <p className="text-gray-500 mt-2">Let's start with the basics of your hostel.</p>
                    </div>
                    <form onSubmit={handleCreateDraft} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Hostel Name</label>
                            <input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Pentagon Hostel" className="w-full text-base border-gray-300 rounded-lg h-12 px-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all outline-none border" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Description</label>
                            <textarea required value={desc} onChange={e=>setDesc(e.target.value)} rows={4} placeholder="Describe the vibe, location, and key features..." className="w-full text-base border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all outline-none border resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Physical Address</label>
                            <input required value={address} onChange={e=>setAddress(e.target.value)} placeholder="e.g. 123 University Campus Area" className="w-full text-base border-gray-300 rounded-lg h-12 px-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all outline-none border" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Gender Policy</label>
                                <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full text-base border-gray-300 rounded-lg h-12 px-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all outline-none border bg-white">
                                    <option value="MIXED">Mixed / Co-ed</option>
                                    <option value="MALE">Male Only</option>
                                    <option value="FEMALE">Female Only</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">Manager's Phone</label>
                                <input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+233..." className="w-full text-base border-gray-300 rounded-lg h-12 px-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all outline-none border" />
                            </div>
                        </div>
                        <div className="pt-6 border-t border-gray-100 flex justify-end">
                            <button type="submit" disabled={isSubmitting} className="bg-black hover:bg-gray-800 text-white h-12 px-8 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Step 2: Amenities */}
            {step === 2 && (
                <div className="animate-in slide-in-from-right-4 fade-in duration-500">
                    <div className="mb-8">
                        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Amenities & Features</h2>
                        <p className="text-gray-500 mt-2">What does your property offer to students?</p>
                    </div>
                    <form onSubmit={handleUpdateAmenities}>
                        
                        {/* Custom Amenity Adder */}
                        <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-600" /> Missing something?</h4>
                            <div className="flex gap-3">
                                <input value={customAmenity} onChange={e=>setCustomAmenity(e.target.value)} placeholder="e.g. Swimming Pool" className="flex-1 text-sm border-gray-300 rounded-md h-10 px-3 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all outline-none border" />
                                <button type="button" onClick={handleAddCustomAmenity} disabled={!customAmenity.trim() || isAddingCustom} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 h-10 px-4 rounded-md font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {isAddingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Custom
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
                            {allAmenities.map(am => {
                                const isSel = selectedAmens.includes(am.id);
                                return (
                                    <button
                                        key={am.id}
                                        type="button"
                                        onClick={() => setSelectedAmens(prev => isSel ? prev.filter(x=>x!==am.id) : [...prev, am.id])}
                                        className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all text-left flex flex-col justify-center ${isSel ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm' : 'border-gray-100 bg-white text-gray-600 hover:border-gray-300'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border mb-3 flex items-center justify-center transition-colors ${isSel ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                                            {isSel && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        {am.name}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pt-6 border-t border-gray-100 flex justify-between">
                            <button type="button" onClick={()=>setStep(1)} className="text-gray-500 hover:text-gray-900 font-medium px-4 h-12 flex items-center transition-colors">Back</button>
                            <button type="submit" disabled={isSubmitting} className="bg-black hover:bg-gray-800 text-white h-12 px-8 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Step 3: Photos */}
            {step === 3 && (
                <div className="animate-in slide-in-from-right-4 fade-in duration-500">
                    <div className="mb-8">
                        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Gallery</h2>
                        <p className="text-gray-500 mt-2">Upload at least <strong className="text-indigo-600">3 high-quality photos</strong> of your property.</p>
                    </div>

                    <div
                        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer mb-8 relative overflow-hidden group ${
                            isDragOver ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                        } ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
                        
                        {isSubmitting ? (
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                                <div className="text-sm font-bold text-gray-900">Uploading {uploadProgress}%</div>
                                <div className="w-full max-w-xs h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-600 transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-600 transition-transform group-hover:-translate-y-1">
                                <div className="w-16 h-16 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center mb-4 text-indigo-600 group-hover:shadow-md transition-shadow">
                                    <UploadCloud className="w-8 h-8" />
                                </div>
                                <span className="font-bold text-lg text-gray-900 mb-1">{isDragOver ? 'Drop file here' : 'Click or drag files to upload'}</span>
                                <span className="text-sm text-gray-500">Supported formats: JPG, PNG, MP4</span>
                            </div>
                        )}
                    </div>

                    {mediaList.length > 0 && (
                        <div className="grid grid-cols-3 gap-4 mb-10">
                            {mediaList.map(m => (
                                <div key={m.id} className="aspect-square rounded-xl border border-gray-200 bg-gray-100 overflow-hidden relative group">
                                    {m.type === 'PHOTO' ? (
                                        <img src={m.thumbnail || m.file} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-gray-900 tracking-widest uppercase">Video</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                        <button type="button" onClick={()=>setStep(2)} className="text-gray-500 hover:text-gray-900 font-medium px-4 h-12 flex items-center transition-colors">Back</button>
                        
                        <div className="flex items-center gap-6">
                            <span className="text-sm text-gray-500 font-medium">
                                {mediaList.filter(m=>m.type==='PHOTO').length}/3 required
                            </span>
                            <button 
                                onClick={() => setStep(4)} 
                                disabled={mediaList.filter(m=>m.type==='PHOTO').length < 3}
                                className="bg-black hover:bg-gray-800 text-white h-12 px-8 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Variants & Rooms */}
            {step === 4 && (
                <div className="animate-in slide-in-from-right-4 fade-in duration-500">
                    <div className="mb-8 flex items-start justify-between">
                        <div>
                            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Room Configurations</h2>
                            <p className="text-gray-500 mt-2">Define the layouts and pricing options available.</p>
                        </div>
                    </div>

                    <div className="space-y-6 mb-10">
                        {variants.length === 0 ? (
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-8 text-center text-indigo-900">
                                <Columns className="w-10 h-10 mx-auto text-indigo-400 mb-4 opacity-50" />
                                <h3 className="font-bold text-lg mb-1">No Rooms Configured</h3>
                                <p className="text-sm">Create your first room type below.</p>
                            </div>
                        ) : (
                            variants.map(v => (
                                <div key={v.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-extrabold text-gray-900 text-lg">{v.name}</h4>
                                            <p className="text-sm text-gray-500">{v.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block font-black text-xl text-indigo-600">GH₵ {v.total_price}</span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50/50 rounded-lg border border-gray-100 p-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">Physical Rooms ({v.rooms?.length || 0})</h5>
                                            {addingRoomsTo !== v.id && (
                                                <button onClick={() => openGenerator(v.id)} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Room Builder</button>
                                            )}
                                        </div>
                                        
                                        {addingRoomsTo === v.id && (
                                            <div className="mb-4 bg-white border border-indigo-200 shadow-xl shadow-indigo-100/50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 border-b border-indigo-700">
                                                    <h5 className="font-bold text-white flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4" /> Smart Matrix Engine</h5>
                                                    <button onClick={() => setAddingRoomsTo(null)} className="text-indigo-200 hover:text-white transition-colors bg-indigo-700/50 rounded-full p-1"><X className="w-4 h-4" /></button>
                                                </div>
                                                
                                                <div className="flex border-b border-gray-100 divide-x divide-gray-100">
                                                    <button type="button" onClick={()=>setGenMode('SMART')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${genMode === 'SMART' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-600 bg-gray-50'}`}>Pattern Sequence</button>
                                                    <button type="button" onClick={()=>setGenMode('MANUAL')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${genMode === 'MANUAL' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-600 bg-gray-50'}`}>Terminal Mode</button>
                                                </div>

                                                <div className="p-5">
                                                    {genMode === 'SMART' ? (
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-4 gap-3">
                                                                <div className="col-span-2">
                                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Prefix</label>
                                                                    <input value={smartPrefix} onChange={e=>setSmartPrefix(e.target.value)} placeholder="e.g. Block A-" className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Start #</label>
                                                                    <input type="number" min="0" value={smartStart} onChange={e=>setSmartStart(parseInt(e.target.value) || 0)} className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Count</label>
                                                                    <input type="number" min="1" max="200" value={smartCount} onChange={e=>setSmartCount(parseInt(e.target.value) || 1)} className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                                                                </div>
                                                            </div>
                                                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Live Projection</span><span className="text-xs text-gray-400">Click a pill to exclude</span>
                                                                </div>
                                                                <div className="max-h-32 overflow-y-auto flex flex-wrap gap-2">
                                                                    {projectedLabels.map(item => (
                                                                        <button key={item.idx} type="button" onClick={() => { const s = new Set(excludedIndices); item.excluded ? s.delete(item.idx) : s.add(item.idx); setExcludedIndices(s); }} className={`px-2 py-1 rounded text-xs font-bold border transition-all ${item.excluded ? 'bg-red-50 text-red-300 border-red-100 line-through opacity-60' : 'bg-white border-indigo-200 text-indigo-900'}`}>{item.label}</button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <button type="button" onClick={() => handleSmartSubmit(v.id)} disabled={isGenerating || projectedLabels.filter(x=>!x.excluded).length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-10 rounded-lg font-bold text-sm disabled:opacity-50 flex justify-center items-center gap-2">{isGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Commit Rooms'}</button>
                                                        </div>
                                                    ) : (
                                                        <form onSubmit={(e) => handleManualSubmit(v.id, e)}>
                                                            <textarea required placeholder="101, 102, 103" rows={3} value={manualLabels} onChange={e=>setManualLabels(e.target.value)} className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 outline-none font-mono mb-3" />
                                                            <button type="submit" disabled={isGenerating} className="w-full bg-gray-900 text-white h-10 rounded-lg font-bold text-sm disabled:opacity-50">Execute Array</button>
                                                        </form>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {(v.rooms || []).map((r: any) => (
                                                <span key={r.id} className="bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded shadow-sm text-xs font-bold">{r.label}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Add Variant Form */}
                        <form onSubmit={handleCreateVariant} className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-6 relative group">
                            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-600" /> Create New Configuration</h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Identifier (e.g. "Single Deluxe")</label>
                                    <input required value={vName} onChange={e=>setVName(e.target.value)} className="w-full text-sm border-gray-300 rounded-md h-10 px-3 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Total Price (GHS) / year</label>
                                    <input required type="number" value={vPrice} onChange={e=>setVPrice(e.target.value)} className="w-full text-sm border-gray-300 rounded-md h-10 px-3 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Min Occupancy</label>
                                    <input required type="number" min="1" value={vMin} onChange={e=>setVMin(e.target.value)} className="w-full text-sm border-gray-300 rounded-md h-10 px-3 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Max Occupancy</label>
                                    <input required type="number" min="1" value={vMax} onChange={e=>setVMax(e.target.value)} className="w-full text-sm border-gray-300 rounded-md h-10 px-3 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">What's included in this layout?</label>
                                    <input required value={vDesc} onChange={e=>setVDesc(e.target.value)} placeholder="AC, Private Bath, King Bed..." className="w-full text-sm border-gray-300 rounded-md h-10 px-3 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border" />
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-gray-900 text-white h-10 rounded-md font-bold text-sm hover:bg-black disabled:opacity-50 transition-colors">
                                Save Configuration
                            </button>
                        </form>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                        <button type="button" onClick={()=>setStep(3)} className="text-gray-500 hover:text-gray-900 font-medium px-4 h-12 flex items-center transition-colors">Back</button>
                        <button 
                            disabled={variants.length === 0}
                            onClick={() => setStep(5)} 
                            className="bg-black hover:bg-gray-800 text-white h-12 px-8 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            Continue <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
                <div className="animate-in slide-in-from-right-4 fade-in duration-500 text-center py-10">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 ring-8 ring-green-50">
                        <Check className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Ready for Validation</h2>
                    <p className="text-gray-500 mb-10 max-w-md mx-auto">Your property profile is complete. Submit it now to the moderation queue for Super Admin approval.</p>
                    
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 text-left max-w-md mx-auto mb-10 space-y-3">
                        <div className="flex justify-between items-center text-sm border-b border-gray-200 pb-2">
                            <span className="text-gray-500 font-medium">Property Name</span>
                            <span className="font-bold text-gray-900">{name}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-gray-200 pb-2">
                            <span className="text-gray-500 font-medium">Uploaded Media</span>
                            <span className="font-bold text-gray-900">{mediaList.length} items</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">Configurations</span>
                            <span className="font-bold text-gray-900">{variants.length} layouts</span>
                        </div>
                    </div>

                    <button
                        disabled={isSubmitting}
                        onClick={async () => {
                            if (!hostelId) return;
                            setIsSubmitting(true);
                            try {
                                await adminHostelsApi.submitForReview(hostelId);
                                toast.success('Submitted for approval!');
                                router.push('/admin/dashboard');
                            } catch (err: any) {
                                toast.error(err.message || 'Failure.');
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white h-14 w-full max-w-md mx-auto rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 text-lg"
                    >
                        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Submit to Moderation</>}
                    </button>
                    
                    <button onClick={()=>setStep(4)} className="text-gray-500 hover:text-gray-900 font-medium mt-6">Go back to edit</button>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}
