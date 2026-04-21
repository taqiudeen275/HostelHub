"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminHostelsApi, adminVariantsApi, Hostel, RoomVariant } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Plus, Users, LayoutGrid, AlertCircle, Sparkles, Terminal, FilterX } from "lucide-react";

export default function VariantsDashboardPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Variant Creation State
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [vName, setVName] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vPrice, setVPrice] = useState("");
  const [vMin, setVMin] = useState("1");
  const [vMax, setVMax] = useState("1");
  const [isSubmittingVariant, setIsSubmittingVariant] = useState(false);

  // Smart Engine State
  const [addingRoomsTo, setAddingRoomsTo] = useState<string | null>(null);
  const [genMode, setGenMode] = useState<"SMART" | "MANUAL">("SMART");
  const [isGenerating, setIsGenerating] = useState(false);

  // Manual Mode State
  const [manualLabels, setManualLabels] = useState("");

  // Smart Mode State
  const [smartPrefix, setSmartPrefix] = useState("");
  const [smartStart, setSmartStart] = useState(1);
  const [smartCount, setSmartCount] = useState(10);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchHostel();
  }, [id]);

  const fetchHostel = async () => {
    try {
      const data = await adminHostelsApi.get(id);
      setHostel(data);
    } catch (err) {
      toast.error("Failed to load variants");
      router.push(`/admin/hostels/${id}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingVariant(true);
    try {
      await adminHostelsApi.createVariant(id, {
        name: vName, description: vDesc, total_price: vPrice,
        min_occupancy: parseInt(vMin), max_occupancy: parseInt(vMax)
      });
      toast.success("Variant created successfully");
      setIsAddingVariant(false);
      setVName(""); setVDesc(""); setVPrice(""); setVMin("1"); setVMax("1");
      await fetchHostel();
    } catch {
      toast.error("Failed to create variant");
    } finally {
      setIsSubmittingVariant(false);
    }
  };

  const projectedLabels = useMemo(() => {
     let c = Math.min(Math.max(1, smartCount), 200); // capped at 200 for UI sanity
     return Array.from({length: c}, (_, i) => {
         return {
             idx: i,
             label: `${smartPrefix}${smartStart + i}`,
             excluded: excludedIndices.has(i)
         };
     });
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
        await fetchHostel();
      } catch {
        toast.error("Constraint error or duplicate room labels detected.");
      } finally {
        setIsGenerating(false);
      }
  };

  const handleManualSubmit = (variantId: string, e: React.FormEvent) => {
      e.preventDefault();
      const arr = manualLabels.split(",").map(s => s.trim()).filter(Boolean);
      if (!arr.length) return;
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

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!hostel) return null;

  return (
    <div className="animate-in fade-in pb-12">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Rooms & Variants</h1>
          <p className="text-sm text-gray-500 mt-1">Configure pricing templates and map actual physical rooms.</p>
        </div>
        {!isAddingVariant && (
          <button onClick={() => setIsAddingVariant(true)} className="bg-black hover:bg-gray-800 text-white px-4 h-10 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Variant
          </button>
        )}
      </div>

      {isAddingVariant && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8 animate-in slide-in-from-top-4">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <h3 className="font-bold text-gray-900">Define Configuration Layout</h3>
                  <button onClick={() => setIsAddingVariant(false)} className="text-sm text-gray-500 hover:text-gray-900 font-medium">Cancel</button>
              </div>
              <form onSubmit={handleCreateVariant} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Variant Name</label>
                      <input required value={vName} onChange={e=>setVName(e.target.value)} placeholder="e.g. Standard 4-in-1" className="w-full text-sm border-gray-300 rounded-lg h-11 px-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border transition-all" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Total Price / Year (GHS)</label>
                      <div className="relative">
                          <span className="absolute left-4 top-3 text-gray-500 font-bold">GH₵</span>
                          <input required type="number" value={vPrice} onChange={e=>setVPrice(e.target.value)} placeholder="0.00" className="w-full text-sm border-gray-300 rounded-lg h-11 pl-12 pr-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border transition-all font-bold text-gray-900" />
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Min Occupancy</label>
                          <input required type="number" min="1" value={vMin} onChange={e=>setVMin(e.target.value)} className="w-full text-sm border-gray-300 rounded-lg h-11 px-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border transition-all" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Max Occupancy</label>
                          <input required type="number" min="1" value={vMax} onChange={e=>setVMax(e.target.value)} className="w-full text-sm border-gray-300 rounded-lg h-11 px-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border transition-all" />
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Description & Features</label>
                      <input required value={vDesc} onChange={e=>setVDesc(e.target.value)} placeholder="What defines this variant?..." className="w-full text-sm border-gray-300 rounded-lg h-11 px-4 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none border transition-all" />
                  </div>
                  <div className="md:col-span-2 pt-4 flex justify-end">
                      <button type="submit" disabled={isSubmittingVariant} className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-8 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                          {isSubmittingVariant ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Save Configuration'}
                      </button>
                  </div>
              </form>
          </div>
      )}

      {hostel.variants.length === 0 ? (
          <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-12 text-center flex flex-col items-center max-w-lg mx-auto mt-12">
              <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <LayoutGrid className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Variants Configured</h3>
              <p className="text-gray-500 mb-6 text-sm">Room variants define your pricing structures and occupancy rules. You need at least one variant to accept bookings.</p>
              <button onClick={() => setIsAddingVariant(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 h-11 rounded-lg text-sm font-bold transition-colors shadow-sm">
                  Create First Variant
              </button>
          </div>
      ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {hostel.variants.map(v => (
                  <div key={v.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col group">
                      {/* Variant Header info */}
                      <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-white to-gray-50/50">
                          <div className="flex justify-between items-start mb-3">
                              <div>
                                  <h3 className="text-lg font-extrabold text-gray-900 drop-shadow-sm">{v.name}</h3>
                                  <div className="flex items-center gap-2 mt-1 font-medium text-gray-500 text-sm">
                                      <Users className="w-4 h-4" />
                                      {v.min_occupancy === v.max_occupancy ? `${v.max_occupancy} in a room` : `${v.min_occupancy} - ${v.max_occupancy} in a room`}
                                  </div>
                              </div>
                              <div className="text-right">
                                  <span className="block text-2xl font-black text-indigo-600 tracking-tight">GH₵{v.total_price}</span>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Per Year</span>
                              </div>
                          </div>
                      </div>

                      {/* Rooms Section */}
                      <div className="p-6 flex-1 flex flex-col bg-gray-50/30">
                          <div className="flex justify-between items-center mb-4">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                  Allocated Rooms
                                  <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{v.rooms?.length || 0}</span>
                              </h4>
                              {addingRoomsTo !== v.id && (
                                  <button onClick={() => openGenerator(v.id)} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5" /> Room Builder
                                  </button>
                              )}
                          </div>

                          {addingRoomsTo === v.id && (
                              <div className="mb-6 bg-white border border-indigo-200 shadow-xl shadow-indigo-100/50 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                  <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 border-b border-indigo-700">
                                      <h5 className="font-bold text-white flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4" /> Smart Matrix Engine</h5>
                                      <button onClick={() => setAddingRoomsTo(null)} className="text-indigo-200 hover:text-white transition-colors bg-indigo-700/50 rounded-full p-1"><FilterX className="w-4 h-4" /></button>
                                  </div>
                                  
                                  {/* Mode Switcher */}
                                  <div className="flex border-b border-gray-100 divide-x divide-gray-100">
                                      <button onClick={()=>setGenMode('SMART')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${genMode === 'SMART' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-600 bg-gray-50'}`}>Pattern Sequence</button>
                                      <button onClick={()=>setGenMode('MANUAL')} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${genMode === 'MANUAL' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-600 bg-gray-50'}`}><Terminal className="w-3.5 h-3.5"/> Terminal</button>
                                  </div>

                                  <div className="p-5">
                                      {genMode === 'SMART' ? (
                                        <div className="space-y-5">
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
                                            
                                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Live Visual Projection</span>
                                                    <span className="text-xs text-gray-400 font-medium">Click a pill to exclude it</span>
                                                </div>
                                                
                                                <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar flex flex-wrap gap-2">
                                                    {projectedLabels.map(item => (
                                                        <button 
                                                            key={item.idx}
                                                            type="button"
                                                            onClick={() => {
                                                                const s = new Set(excludedIndices);
                                                                if (item.excluded) s.delete(item.idx);
                                                                else s.add(item.idx);
                                                                setExcludedIndices(s);
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all duration-200 transform hover:scale-105 active:scale-95 ${item.excluded ? 'bg-red-50 text-red-300 border-red-100 line-through opacity-60' : 'bg-white border-indigo-200 text-indigo-900 shadow-sm hover:border-red-300 hover:text-red-500'}`}
                                                        >
                                                            {item.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => handleSmartSubmit(v.id)} 
                                                disabled={isGenerating || projectedLabels.filter(x=>!x.excluded).length === 0}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white h-11 rounded-lg font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                                            >
                                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : `Commit ${projectedLabels.filter(x=>!x.excluded).length} Rooms Database`}
                                            </button>
                                        </div>
                                      ) : (
                                        <form onSubmit={(e) => handleManualSubmit(v.id, e)}>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Raw Terminal Input (Comma separated)</label>
                                            <textarea required placeholder="101, 102, 103" rows={3} value={manualLabels} onChange={e=>setManualLabels(e.target.value)} className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono resize-none mb-3" />
                                            <button type="submit" disabled={isGenerating} className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white h-11 rounded-lg font-bold text-sm shadow-sm transition-colors flex items-center justify-center">
                                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : `Execute Array`}
                                            </button>
                                        </form>
                                      )}
                                  </div>
                              </div>
                          )}

                          {v.rooms && v.rooms.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                                  {v.rooms.map((r: any) => (
                                      <div key={r.id} className="bg-white border border-gray-200 text-gray-700 shadow-sm px-2.5 py-1 rounded-md text-xs font-bold flex items-center justify-center min-w-[2.5rem] hover:border-indigo-300 transition-colors cursor-default hover:text-indigo-700">
                                          {r.label}
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3 mt-auto">
                                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                  <p className="text-sm text-amber-800 font-medium leading-relaxed">No physical rooms have been mapped to this variant yet. Generative commands await above.</p>
                              </div>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
}
