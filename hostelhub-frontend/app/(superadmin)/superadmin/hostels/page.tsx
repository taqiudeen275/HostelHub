"use client";

import { useEffect, useState } from "react";
import { superAdminApi, authApi, User, api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Clock, Building, Globe, MapPin, Search, ArrowRightLeft, User as UserIcon } from "lucide-react";

export default function SuperAdminHostelsPage() {
  const [tab, setTab] = useState<'PENDING' | 'DIRECTORY'>('PENDING');
  const [hostels, setHostels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // States for Reassignment Modal
  const [reassigningHostel, setReassigningHostel] = useState<any | null>(null);
  const [targetPhone, setTargetPhone] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    authApi.me().then(setCurrentUser).catch(console.error);
  }, []);

  useEffect(() => {
    fetchHostels();
  }, [tab]);

  const fetchHostels = async () => {
      setIsLoading(true);
      try {
          const res = tab === 'PENDING' ? await superAdminApi.getPendingHostels() : await superAdminApi.getAllHostels();
          setHostels(res);
      } catch (err) {
          toast.error("Failed to fetch property network");
      } finally {
          setIsLoading(false);
      }
  };

  const fetchAdminUsers = async () => {
      try {
          // Fetch users and filter strictly to HOSTEL_ADMIN role for the combobox
          const users = await api.get<User[]>("/accounts/admin-users/");
          setAdminUsers(users.filter(u => u.role === 'HOSTEL_ADMIN'));
      } catch (err) {
          toast.error("Failed to fetch property managers");
      }
  };

  const executeAction = async (id: string, action: 'approve' | 'reject') => {
      if (action === 'reject' && !confirm("Warning: Purging this property will drop it from the platform. Proceed?")) return;
      try {
          if (action === 'approve') {
              await superAdminApi.approveHostel(id);
              toast.success("Property Approved and Synced to Public Matrix");
          } else {
              await superAdminApi.rejectHostel(id, "Rejected by Super Admin during routine moderation via Fast-Action");
              toast.success("Property Purged");
          }
          setHostels(prev => prev.filter(h => h.id !== id));
      } catch {
          toast.error(`Failed to execute ${action}`);
      }
  };

  const confirmReassignment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reassigningHostel || !targetPhone) return;
      setIsReassigning(true);
      try {
          await superAdminApi.reassignHostel(reassigningHostel.id, targetPhone);
          toast.success("Ownership Transferred Successfully. You are now permanently locked out of reassignment for this property.");
          setReassigningHostel(null);
          setTargetPhone("");
          setSearchQuery("");
          fetchHostels();
      } catch (err: any) {
          toast.error(err.response?.data?.error || "Failed to transfer ownership.");
      } finally {
          setIsReassigning(false);
      }
  };

  const filteredAdmins = adminUsers.filter(u => 
      u.phone.includes(searchQuery) || 
      (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
      <div className="animate-in fade-in pb-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-4 border-b border-white/[0.08] gap-4">
              <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <Building className="w-6 h-6 text-indigo-500" /> Property Network
                  </h1>
                  <p className="text-sm text-gray-400 mt-1">Global command center for reviewing and managing all active infrastructure.</p>
              </div>
              <a href="/superadmin/hostels/create" className="bg-indigo-600 text-white hover:bg-indigo-500 px-6 py-2.5 rounded-xl text-sm font-bold transition-all items-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] flex">
                  <span>+</span> Add Hostel on Behalf
              </a>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-4 mb-8">
              <button 
                  onClick={() => setTab('PENDING')} 
                  className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
                      tab === 'PENDING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'bg-[#0A0A0A] border-white/[0.08] text-gray-500 hover:text-gray-300'
                  }`}
              >
                  <Clock className="w-4 h-4" /> Moderation Queue
              </button>
              <button 
                  onClick={() => setTab('DIRECTORY')} 
                  className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
                      tab === 'DIRECTORY' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-[#0A0A0A] border-white/[0.08] text-gray-500 hover:text-gray-300'
                  }`}
              >
                  <Globe className="w-4 h-4" /> Global Directory
              </button>
          </div>

          {isLoading || !currentUser ? (
              <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : hostels.length === 0 ? (
              <div className="bg-[#0A0A0A] border border-white/[0.04] rounded-3xl p-16 text-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-green-500/5 blur-[100px] pointer-events-none" />
                  <div className="w-16 h-16 bg-green-600/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                      <div className="absolute inset-0 bg-green-500/20 rounded-2xl animate-pulse" />
                      <CheckCircle className="w-8 h-8 text-green-400 relative z-10" />
                  </div>
                  <h3 className="font-bold text-white text-xl mb-2">Inbox Zero</h3>
                  <p className="text-gray-500 text-sm">No properties found in this category.</p>
              </div>
          ) : (
              <div className="grid gap-6">
                  {hostels.map(h => (
                      <div key={h.id} className="bg-[#0A0A0A] border border-white/[0.08] hover:border-white/[0.15] transition-colors rounded-2xl p-6 flex flex-col md:flex-row gap-6 group">
                          {/* Property Info */}
                          <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">{h.name}</h3>
                                  {h.status === 'PENDING' ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                                          <Clock className="w-3" /> Pending Review
                                      </span>
                                  ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                                          <CheckCircle className="w-3" /> Active
                                      </span>
                                  )}
                              </div>
                              <p className="text-sm text-gray-400 font-medium flex items-center gap-1.5 opacity-80 mb-4 line-clamp-2">
                                  <MapPin className="w-3.5 h-3.5" /> {h.address_text || "Offline Configuration"}
                              </p>
                              
                              {/* Metadata Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                  <div className={`bg-black border p-3 rounded-xl border-l-2 ${h.owner === currentUser.id ? 'border-indigo-500/50 border-emerald-500 text-emerald-400' : 'border-white/[0.05] border-l-blue-500/50'}`}>
                                      <p className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-70">Assigned Owner</p>
                                      <p className="text-sm font-mono truncate">{h.owner === currentUser.id ? "SUPER ADMIN (YOU)" : h.owner_contact_phone || "UNASSIGNED"}</p>
                                  </div>
                                  <div className="bg-black border border-white/[0.05] p-3 rounded-xl border-l-2 border-l-purple-500/50">
                                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Rooms Generated</p>
                                      <p className="text-sm text-gray-300 font-mono">{h.variants?.reduce((sum:number, v:any)=>sum+(v.rooms?.length||0), 0)} Rooms</p>
                                  </div>
                              </div>
                          </div>

                          {/* Execution Panel */}
                          <div className="flex md:flex-col gap-3 justify-center shrink-0 border-t md:border-t-0 md:border-l border-white/[0.04] pt-4 md:pt-0 md:pl-6">
                              {tab === 'PENDING' ? (
                                  <>
                                      <button onClick={() => executeAction(h.id, 'approve')} className="flex-1 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-black border border-green-500/20 px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                                          <CheckCircle className="w-4 h-4" /> Approve
                                      </button>
                                      <button onClick={() => executeAction(h.id, 'reject')} className="flex-1 bg-[#0A0A0A] hover:bg-red-500/10 text-gray-500 hover:text-red-500 border border-white/[0.08] hover:border-red-500/30 px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                                          <XCircle className="w-4 h-4" /> Reject
                                      </button>
                                  </>
                              ) : (
                                  // Show Reassign button ONLY IF created_by_super_admin AND strictly owned by the super admin
                                  h.created_by_super_admin && h.owner === currentUser.id && (
                                      <button onClick={() => {
                                          setReassigningHostel(h);
                                          if (adminUsers.length === 0) fetchAdminUsers();
                                      }} className="w-full bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                          <ArrowRightLeft className="w-4 h-4" /> Transfer Ownership
                                      </button>
                                  )
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {/* Transfer Ownership Modal */}
          {reassigningHostel && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                  <div className="bg-[#0A0A0A] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-md overflow-visible relative">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-indigo-500 to-green-500" />
                      
                      <div className="p-8">
                          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-indigo-400"/> Transfer Protocol</h2>
                          <p className="text-sm text-gray-400 mb-6">You are permanently assigning <span className="font-bold text-white">{reassigningHostel.name}</span> to a property manager. <span className="text-red-400 font-bold block mt-1">Warning: Once transferred, you cannot reverse this action.</span></p>
                          
                          <form onSubmit={confirmReassignment}>
                              <div className="relative mb-8">
                                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Select Target Manager</label>
                                  
                                  {/* Combobox Search Input */}
                                  <div className="relative">
                                      <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                                      <input 
                                          autoFocus 
                                          placeholder="Search by name or +233..." 
                                          value={searchQuery}
                                          onChange={e => {
                                              setSearchQuery(e.target.value);
                                              setShowDropdown(true);
                                              if (e.target.value !== targetPhone) setTargetPhone(""); // Clear target if modified
                                          }}
                                          onFocus={() => setShowDropdown(true)}
                                          className="w-full bg-black border border-white/[0.1] rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 text-white font-mono" 
                                      />
                                  </div>

                                  {/* Dropdown Menu */}
                                  {showDropdown && searchQuery && (
                                      <div className="absolute z-10 w-full mt-1 bg-[#1A1A1A] border border-white/[0.1] rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                          {filteredAdmins.length === 0 ? (
                                              <div className="p-4 text-center text-gray-500 text-sm">No managers found matching "{searchQuery}"</div>
                                          ) : (
                                              filteredAdmins.map(u => (
                                                  <button 
                                                      key={u.id} type="button"
                                                      onClick={() => {
                                                          setTargetPhone(u.phone);
                                                          setSearchQuery(`${u.full_name || 'Unnamed'} (${u.phone})`);
                                                          setShowDropdown(false);
                                                      }}
                                                      className="w-full text-left p-3 hover:bg-indigo-500/10 border-b border-white/[0.02] last:border-0 flex items-center justify-between group transition-colors"
                                                  >
                                                      <div className="flex items-center gap-3">
                                                          <div className="bg-black p-1.5 rounded-full"><UserIcon className="w-4 h-4 text-indigo-400" /></div>
                                                          <div>
                                                              <h4 className="text-white text-sm font-bold">{u.full_name || "Unnamed Manager"}</h4>
                                                              <p className="text-xs text-gray-500 font-mono">{u.phone}</p>
                                                          </div>
                                                      </div>
                                                      <CheckCircle className={`w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity ${targetPhone === u.phone ? 'opacity-100 text-green-500' : ''}`} />
                                                  </button>
                                              ))
                                          )}
                                      </div>
                                  )}
                              </div>
                              
                              <div className="flex gap-3">
                                  <button type="button" onClick={() => { setReassigningHostel(null); setShowDropdown(false); setTargetPhone(""); setSearchQuery(""); }} className="flex-1 bg-white/[0.05] hover:bg-white/[0.1] text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors">Cancel</button>
                                  <button type="submit" disabled={isReassigning || !targetPhone} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                      {isReassigning ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Execute Transfer'}
                                  </button>
                              </div>
                          </form>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
}
