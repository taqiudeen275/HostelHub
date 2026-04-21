"use client";

import { useEffect, useState } from "react";
import { superAdminApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Search, Clock, Home, Building } from "lucide-react";

export default function SuperAdminHostelsPage() {
  const [hostels, setHostels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Rejection State
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchHostels();
  }, []);

  const fetchHostels = async () => {
      try {
          const res = await superAdminApi.getPendingHostels();
          setHostels(res);
      } catch (err) {
          toast.error("Failed to load queue");
      } finally {
          setIsLoading(false);
      }
  };

  const handleApprove = async (id: string) => {
      setIsProcessing(true);
      try {
          await superAdminApi.approveHostel(id);
          toast.success("Hostel Approved!");
          setHostels(prev => prev.filter(h => h.id !== id));
      } catch (err) {
          toast.error("Approval failed");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleReject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!rejectId) return;
      setIsProcessing(true);
      try {
          await superAdminApi.rejectHostel(rejectId, rejectReason);
          toast.success("Hostel Rejected.");
          setHostels(prev => prev.filter(h => h.id !== rejectId));
          setRejectId(null);
          setRejectReason("");
      } catch {
          toast.error("Rejection failed");
      } finally {
          setIsProcessing(false);
      }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
      <div className="animate-in fade-in pb-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <Building className="w-6 h-6 text-gray-500" /> Moderation Queue
                  </h1>
                  <p className="text-sm text-gray-400 mt-1">Review properties submitted by managers for platform entry.</p>
              </div>
          </div>

          {hostels.length === 0 ? (
              <div className="bg-[#0A0A0A] border border-white/[0.04] rounded-3xl p-16 text-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-green-500/5 blur-[100px] pointer-events-none" />
                  <div className="w-16 h-16 bg-green-600/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                      <div className="absolute inset-0 bg-green-500/20 rounded-2xl animate-pulse" />
                      <CheckCircle className="w-8 h-8 text-green-400 relative z-10" />
                  </div>
                  <h3 className="font-bold text-white text-xl mb-2">Inbox Zero</h3>
                  <p className="text-gray-500 text-sm">There are no pending properties requiring moderation.</p>
              </div>
          ) : (
              <div className="grid gap-6">
                  {hostels.map(h => (
                      <div key={h.id} className="bg-[#0A0A0A] border border-white/[0.08] hover:border-white/[0.15] transition-colors rounded-2xl p-6 flex flex-col md:flex-row gap-6 group">
                          {/* Property Info */}
                          <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">{h.name}</h3>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                                      <Clock className="w-3" /> Pending Review
                                  </span>
                              </div>
                              <p className="text-sm text-gray-400 mb-6 line-clamp-2 leading-relaxed">{h.description}</p>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                  <div>
                                      <div className="text-[10px] uppercase font-bold tracking-widest text-gray-600 mb-1.5">Location</div>
                                      <div className="text-xs text-gray-300 truncate font-mono">{h.address_text}</div>
                                  </div>
                                  <div>
                                      <div className="text-[10px] uppercase font-bold tracking-widest text-gray-600 mb-1.5">Policy</div>
                                      <div className="text-xs text-gray-300">{h.gender_policy}</div>
                                  </div>
                                  <div>
                                      <div className="text-[10px] uppercase font-bold tracking-widest text-gray-600 mb-1.5">Owner Tel</div>
                                      <div className="text-xs text-gray-300 font-mono text-indigo-400">{h.owner_contact_phone}</div>
                                  </div>
                                  <div>
                                      <div className="text-[10px] uppercase font-bold tracking-widest text-gray-600 mb-1.5">Media Uploads</div>
                                      <div className="text-xs text-gray-300">{h.media?.length || 0} Assets</div>
                                  </div>
                              </div>
                          </div>

                          {/* Action Panel */}
                          <div className="md:w-64 flex flex-col gap-3 justify-center border-t md:border-t-0 md:border-l border-white/[0.08] pt-6 md:pt-0 md:pl-6">
                              {rejectId === h.id ? (
                                  <form onSubmit={handleReject} className="animate-in fade-in slide-in-from-right-4">
                                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Provide Reason</p>
                                      <textarea autoFocus required value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Why is this rejected?..." className="w-full text-xs border-white/[0.1] bg-black text-white rounded p-3 focus:ring-1 focus:ring-red-500 border outline-none mb-3 resize-none custom-scrollbar" rows={2} />
                                      <div className="flex gap-2">
                                          <button type="submit" disabled={isProcessing} className="flex-1 bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-bold py-2 rounded-lg hover:bg-red-600/30 transition-colors disabled:opacity-50">Confirm Setup</button>
                                          <button type="button" onClick={() => setRejectId(null)} className="flex-[0.5] bg-white/[0.05] text-gray-400 border border-white/[0.1] text-xs font-bold py-2 rounded-lg hover:bg-white/[0.1] transition-colors">Cancel</button>
                                      </div>
                                  </form>
                              ) : (
                                  <>
                                      <button onClick={() => handleApprove(h.id)} disabled={isProcessing} className="w-full bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 py-3 rounded-xl font-bold flex justify-center gap-2 items-center transition-colors text-sm shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                                          <CheckCircle className="w-4 h-4" /> Final Approve
                                      </button>
                                      <button onClick={() => setRejectId(h.id)} disabled={isProcessing} className="w-full bg-red-500/5 text-red-500/80 hover:text-red-400 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 py-3 rounded-xl font-bold flex justify-center gap-2 items-center transition-colors text-sm">
                                          <XCircle className="w-4 h-4" /> Reject Listing
                                      </button>
                                  </>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
  );
}
