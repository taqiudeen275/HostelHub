"use client";

import React, { useEffect, useState, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { superAdminApi, adminHostelsApi, adminVariantsApi, Amenity, RoomVariant, HostelMedia } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Check, Building, Tag, Columns, ShieldAlert, Camera, UploadCloud, X } from "lucide-react";
import Link from "next/link";

const STEPS = [
  { id: 1, title: "Owner & Details", icon: Building },
  { id: 2, title: "Amenities", icon: Tag },
  { id: 3, title: "Gallery", icon: Camera },
  { id: 4, title: "Variants", icon: Columns },
  { id: 5, title: "Room Setup", icon: Check }
];

export default function SuperAdminCreateHostelWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Basics
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("MIXED");
  const [ownerContact, setOwnerContact] = useState("");

  // Step 2: Amenities
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [selectedAmens, setSelectedAmens] = useState<Set<number>>(new Set());

  // Step 3: Global Gallery
  const [mediaList, setMediaList] = useState<HostelMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 4: Variants
  const [variants, setVariants] = useState<RoomVariant[]>([]);
  const [vName, setVName] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vPrice, setVPrice] = useState("");
  const [vMin, setVMin] = useState("1");
  const [vMax, setVMax] = useState("1");

  // Step 5: Smart Generator
  const [addingRoomsTo, setAddingRoomsTo] = useState<string | null>(null);
  const [smartPrefix, setSmartPrefix] = useState("");
  const [smartStart, setSmartStart] = useState(1);
  const [smartCount, setSmartCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    adminHostelsApi.getAmenities().then(setAllAmenities).catch(console.error);
  }, []);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hostelId) {
       setStep(3);
       return;
    }
    
    setIsSubmitting(true);
    try {
        const res = await superAdminApi.createOnBehalf({
            name, description: desc, address_text: address,
            gender_policy: gender, owner_contact_phone: ownerContact,
            amenity_ids: Array.from(selectedAmens)
        });
        setHostelId(res.id);
        toast.success("Hostel and Owner Account created!");
        setStep(3);
    } catch (err: any) {
        toast.error(err.response?.data?.error || "Creation failed");
    } finally {
        setIsSubmitting(false);
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
      toast.success("Variant added");
      setVName(""); setVDesc(""); setVPrice(""); setVMin("1"); setVMax("1");
    } catch {
      toast.error("Failed to save layout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeRoomGeneration = async () => {
      if (!addingRoomsTo) return;
      setIsGenerating(true);
      try {
          const labels = Array.from({length: smartCount}, (_, i) => `${smartPrefix}${smartStart + i}`);
          await adminVariantsApi.createRoomsBulk(addingRoomsTo, labels);
          toast.success(`${labels.length} Rooms Generated!`);
          setAddingRoomsTo(null);
          setSmartPrefix(""); setSmartStart(1); setSmartCount(10);
          
          const hData = await adminHostelsApi.get(hostelId!);
          setVariants(hData.variants || []);
      } catch {
          toast.error("Duplicate room labels detected");
      } finally {
          setIsGenerating(false);
      }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-black text-gray-300 font-sans -m-6 md:-m-12 !min-h-0 overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-80 bg-[#0A0A0A] border-r border-white/[0.08] hidden md:flex flex-col shrink-0">
            <div className="p-8">
                <Link href="/superadmin/hostels" className="text-gray-500 hover:text-white transition-colors mb-10 flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                    <ArrowLeft className="w-4 h-4" /> Cancel Setup
                </Link>
                <h1 className="text-xl font-bold tracking-tight text-white mb-8">Create Hostel</h1>
                <nav className="space-y-6 relative before:absolute before:inset-y-0 before:left-3.5 before:w-[1px] before:bg-white/[0.08] before:z-0">
                    {STEPS.map((s) => {
                        const isActive = step === s.id;
                        const isCompleted = step > s.id;
                        const Icon = s.icon;
                        return (
                            <div key={s.id} className={`flex items-start gap-4 relative z-10 transition-opacity ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                                    isActive ? 'border-indigo-500 bg-[#0A0A0A] text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
                                    isCompleted ? 'border-green-500 bg-green-500/10 text-green-400' :
                                    'border-white/[0.1] bg-[#0A0A0A] text-gray-500'
                                }`}>
                                    <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="pt-0.5">
                                    <p className={`text-sm font-bold ${isActive ? 'text-white' : isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>{s.title}</p>
                                </div>
                            </div>
                        );
                    })}
                </nav>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-black">
            <div className="max-w-3xl mx-auto p-6 lg:p-12">
                
                {step === 1 && (
                    <form onSubmit={handleStep1Submit} className="animate-in fade-in slide-in-from-right-8 space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Basic Details & Credentials</h2>
                            <p className="text-sm text-gray-400 mt-2">Create the hostel record and define the target owner's access credentials.</p>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Hostel Name</label>
                                    <input required autoFocus value={name} onChange={e=>setName(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Public Representative Phone</label>
                                    <input required type="tel" value={ownerContact} onChange={e=>setOwnerContact(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 text-white font-mono" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Address / Location Reference</label>
                                    <input required value={address} onChange={e=>setAddress(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Allowed Demographics</label>
                                    <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 text-white">
                                        <option value="MIXED">Mixed (Any)</option><option value="MALE">Male Only</option><option value="FEMALE">Female Only</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">Marketing Description</label>
                                <textarea required rows={4} value={desc} onChange={e=>setDesc(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 text-white resize-none" />
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 border-t border-white/[0.08]">
                            <button type="submit" className="bg-white hover:bg-gray-200 text-black px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors">
                                Select Amenities <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleStep2Submit} className="animate-in fade-in slide-in-from-right-8 space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Amenities</h2>
                            <p className="text-sm text-gray-400 mt-2">Select the facilities provided.</p>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            {allAmenities.map(am => (
                                <button type="button" key={am.id} onClick={() => {
                                    const next = new Set(selectedAmens);
                                    if(next.has(am.id)) next.delete(am.id); else next.add(am.id);
                                    setSelectedAmens(next);
                                }} className={`px-4 py-3 rounded-xl text-left text-sm font-bold transition-all border ${
                                    selectedAmens.has(am.id) ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400" : "bg-[#0A0A0A] border-white/[0.08] text-gray-400"
                                }`}>
                                    {am.name}
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-between pt-6 border-t border-white/[0.08]">
                            <button type="button" onClick={() => setStep(1)} className="text-gray-400 font-bold px-6 py-3 hover:text-white transition-colors">Back</button>
                            <button type="submit" disabled={isSubmitting} className="bg-white text-black px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Target Hostel"}
                            </button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-8 space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Property Gallery</h2>
                            <p className="text-sm text-gray-400 mt-2">Upload images to complete the target hostel's profile.</p>
                        </div>

                        {mediaList.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {mediaList.map((m) => (
                                    <div key={m.id} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-white/[0.1] group">
                                        <img src={m.file} alt="Upload" className="w-full h-full object-cover" />
                                        <button onClick={async () => {
                                            if(!confirm("Delete this?")) return;
                                            try { await adminHostelsApi.deleteMedia(hostelId!, m.id); setMediaList(prev=>prev.filter(x=>x.id!==m.id)); toast.success("Deleted"); } catch { toast.error("Delete failed"); }
                                        }} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="w-4 h-4"/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if(f) doUpload(f); }}
                            className={`border-2 border-dashed rounded-3xl p-10 text-center transition-colors ${
                                isDragOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/[0.1] bg-[#0A0A0A]'
                            }`}
                        >
                            <input type="file" ref={fileInputRef} onChange={e=>e.target.files?.[0] && doUpload(e.target.files[0])} className="hidden" accept="image/*,video/*" />
                            <UploadCloud className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? 'text-indigo-400' : 'text-gray-600'}`} />
                            <h3 className="text-sm font-bold text-white mb-2">Drag and drop media</h3>
                            <p className="text-xs text-gray-500 mb-6">Support for JPG, PNG, WEBP, MP4 (Max 10MB/50MB)</p>
                            
                            {isSubmitting && uploadProgress > 0 ? (
                                <div className="w-full max-w-xs mx-auto">
                                    <div className="flex justify-between text-xs text-gray-400 mb-2"><span>Uploading...</span><span>{uploadProgress}%</span></div>
                                    <div className="h-1.5 bg-black rounded-full overflow-hidden border border-white/[0.05]"><div className="h-full bg-indigo-500 transition-all duration-300" style={{width: `${uploadProgress}%`}}/></div>
                                </div>
                            ) : (
                                <button onClick={()=>fileInputRef.current?.click()} type="button" className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors">Browse Files</button>
                            )}
                        </div>

                        <div className="flex justify-between pt-6 border-t border-white/[0.08]">
                            <button type="button" disabled={isSubmitting} onClick={() => setStep(4)} className="ml-auto bg-white text-black px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors">
                                Add Variants <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="animate-in fade-in slide-in-from-right-8 space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Room Variants</h2>
                            <p className="text-sm text-gray-400 mt-2">Add packages like "4 in a room".</p>
                        </div>

                        {variants.length > 0 && (
                            <div className="grid gap-4">
                                {variants.map(v => (
                                    <div key={v.id} className="bg-[#0A0A0A] border border-white/[0.1] rounded-2xl p-5 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-white">{v.name}</h4>
                                            <p className="text-xs text-gray-400 mt-1">GHS {v.total_price} • {v.rooms?.length || 0} Rooms Tracked</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleCreateVariant} className="bg-[#0A0A0A] border border-white/[0.08] rounded-3xl p-6 md:p-8 space-y-6">
                            <h3 className="text-sm font-bold text-white">Create New Package</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Package Name</label>
                                    <input required value={vName} onChange={e=>setVName(e.target.value)} placeholder="e.g. 2 in a room - Standard" className="w-full bg-black border border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:border-indigo-500 text-white" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Package Description/Features</label>
                                    <textarea required rows={2} value={vDesc} onChange={e=>setVDesc(e.target.value)} placeholder="e.g. Includes private balcony and AC." className="w-full bg-black border border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:border-indigo-500 text-white resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Price Total (GHS)</label>
                                    <input required type="number" step="0.01" value={vPrice} onChange={e=>setVPrice(e.target.value)} className="w-full bg-black border border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:border-indigo-500 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">Capacity</label>
                                    <div className="flex items-center gap-2">
                                        <input required type="number" min="1" value={vMin} onChange={e=>setVMin(e.target.value)} className="w-full bg-black border border-white/[0.1] rounded-xl px-3 py-3 text-sm focus:border-indigo-500 text-center text-white" />
                                        <span className="text-gray-500 text-sm">to</span>
                                        <input required type="number" min="1" value={vMax} onChange={e=>setVMax(e.target.value)} className="w-full bg-black border border-white/[0.1] rounded-xl px-3 py-3 text-sm focus:border-indigo-500 text-center text-white" />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <button type="submit" disabled={isSubmitting} className="w-full bg-white/[0.05] border border-white/[0.1] text-white py-3 rounded-xl font-bold hover:bg-white/[0.1] transition-colors mt-2">
                                        {isSubmitting ? "Saving..." : "Add Variant"}
                                    </button>
                                </div>
                            </div>
                        </form>

                        <div className="flex justify-between pt-6 border-t border-white/[0.08]">
                            <button type="button" onClick={() => setStep(3)} className="text-gray-400 font-bold px-6 py-3 hover:text-white transition-colors">Back</button>
                            <button type="button" onClick={() => {
                                if (variants.length === 0 && !confirm("You haven't added any variants. Are you sure you want to skip?")) return;
                                setStep(5);
                            }} className="bg-white text-black px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors">
                                Add Rooms <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div className="animate-in fade-in slide-in-from-right-8 space-y-8 pb-32">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Smart Room Setup</h2>
                            <p className="text-sm text-gray-400 mt-2">Generate actual room numbers directly into packages so they are ready.</p>
                        </div>

                        {variants.length === 0 ? (
                            <div className="bg-[#0A0A0A] p-8 rounded-2xl text-center border border-white/[0.1] text-gray-400 text-sm">
                                No variants created yet. Go back to step 4.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {variants.map(v => (
                                    <div key={v.id} className="bg-[#0A0A0A] border border-white/[0.08] rounded-3xl p-6">
                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h3 className="font-bold text-white">{v.name}</h3>
                                                <span className="text-xs text-gray-500">{v.rooms?.length || 0} Registered Rooms</span>
                                            </div>
                                            {addingRoomsTo === v.id ? (
                                                <button onClick={()=>setAddingRoomsTo(null)} className="text-xs font-bold text-gray-400 hover:text-white bg-white/[0.1] px-4 py-2 rounded-lg">Cancel generator</button>
                                            ) : (
                                                <button onClick={()=>setAddingRoomsTo(v.id)} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-lg">Generate Rooms</button>
                                            )}
                                        </div>

                                        {addingRoomsTo === v.id ? (
                                            <div className="bg-black border border-indigo-500/30 rounded-2xl p-6 mb-4">
                                                <div className="grid grid-cols-3 gap-4 mb-4">
                                                    <div><label className="block text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-widest">Prefix (e.g. Block-A-)</label><input value={smartPrefix} onChange={e=>setSmartPrefix(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/[0.1] rounded-lg p-2 text-white text-sm" /></div>
                                                    <div><label className="block text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-widest">Starting No.</label><input type="number" min="1" value={smartStart} onChange={e=>setSmartStart(parseInt(e.target.value))} className="w-full bg-[#0A0A0A] border border-white/[0.1] rounded-lg p-2 text-white text-sm" /></div>
                                                    <div><label className="block text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-widest">Count to add</label><input type="number" min="1" max="100" value={smartCount} onChange={e=>setSmartCount(parseInt(e.target.value))} className="w-full bg-[#0A0A0A] border border-white/[0.1] rounded-lg p-2 text-white text-sm" /></div>
                                                </div>
                                                <button onClick={executeRoomGeneration} disabled={isGenerating} className="w-full bg-indigo-500 text-white font-bold py-3 rounded-xl hover:bg-indigo-600 transition-colors">
                                                    {isGenerating ? "Executing..." : `Generate ${smartCount} Rooms Now`}
                                                </button>
                                            </div>
                                        ) : (
                                            v.rooms && v.rooms.length > 0 && (
                                                <div className="flex flex-wrap gap-2 text-sm max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                                    {v.rooms.slice(0, 50).map(r => <span key={r.id} className="bg-black border border-white/[0.05] text-gray-400 px-2 py-1 rounded-md text-xs">{r.label}</span>)}
                                                    {v.rooms.length > 50 && <span className="text-gray-500 text-xs px-2 py-1">+{v.rooms.length - 50} more...</span>}
                                                </div>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between pt-6 mt-12 border-t border-white/[0.08]">
                            <button type="button" onClick={() => setStep(4)} className="text-gray-400 font-bold px-6 py-3 hover:text-white transition-colors">Back</button>
                            <Link href={`/superadmin/hostels`} className="bg-green-500 hover:bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-none px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all">
                                <Check className="w-4 h-4" /> Finish Setup & Close
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
