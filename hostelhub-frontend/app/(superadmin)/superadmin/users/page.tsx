"use client";

import { useEffect, useState } from "react";
import { superAdminApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ShieldAlert, UserX, Shield, Users as UsersIcon, CheckCircle2 } from "lucide-react";

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
      try {
          const res = await superAdminApi.getUsers();
          setUsers(res);
      } catch (err) {
          toast.error("Failed to fetch user directory");
      } finally {
          setIsLoading(false);
      }
  };

  const deactivateUser = async (id: string, role: string) => {
      if (role === 'SUPER_ADMIN') {
          toast.error("Cannot deactivate another Super Admin from this panel.");
          return;
      }
      if (!confirm("Are you sure you want to deactivate this user? They will instantly lose platform access.")) return;
      
      try {
          await superAdminApi.deactivateUser(id);
          toast.success("User deactivated successfully");
          setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: false } : u));
      } catch {
          toast.error("Failed to deactivate user");
      }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
      <div className="animate-in fade-in pb-12">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">Access Network</h1>
                  <p className="text-sm text-gray-400 mt-1">Global directory of all registered students, managers, and admins.</p>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <UsersIcon className="w-4 h-4" /> {users.length} Identities
              </div>
          </div>

          <div className="bg-[#0A0A0A] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden relative">
              {/* Subtle mesh background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/10 via-transparent to-blue-900/10 pointer-events-none" />
              
              <div className="overflow-x-auto relative z-10">
                  <table className="w-full text-sm text-left backdrop-blur-md">
                      <thead className="text-[10px] text-gray-500 uppercase tracking-widest bg-white/[0.02] border-b border-white/[0.08]">
                          <tr>
                              <th className="px-6 py-5 font-bold">Identity Target</th>
                              <th className="px-6 py-5 font-bold">Encrypted Contact</th>
                              <th className="px-6 py-5 font-bold">Policy Role</th>
                              <th className="px-6 py-5 font-bold">State</th>
                              <th className="px-6 py-5 font-bold text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                          {users.map((u) => (
                              <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                                  <td className="px-6 py-4">
                                      <div className="font-bold text-gray-200 group-hover:text-white transition-colors">{u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : "Unset Name"}</div>
                                      <div className="text-xs text-gray-600 font-mono mt-1 opacity-70">UID: {u.id.split('-')[0]}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="text-gray-300 font-medium font-mono">{u.phone}</div>
                                      <div className="text-gray-600 text-xs mt-0.5">{u.email || "No email"}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      {u.role === 'SUPER_ADMIN' && <span className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest"><Shield className="w-3 h-3"/> SYS_ROOT</span>}
                                      {u.role === 'HOSTEL_ADMIN' && <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest">OWNER_NODE</span>}
                                      {u.role === 'STUDENT' && <span className="inline-flex items-center gap-1 bg-white/[0.05] border border-white/[0.1] text-gray-300 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest">STUDENT</span>}
                                  </td>
                                  <td className="px-6 py-4">
                                      {u.is_active ? (
                                          <span className="flex items-center gap-1.5 text-green-400/90 font-bold text-xs"><CheckCircle2 className="w-3.5 h-3.5"/> Access Active</span>
                                      ) : (
                                          <span className="flex items-center gap-1.5 text-red-500/80 font-bold text-xs"><UserX className="w-3.5 h-3.5"/> Suspended</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      {u.is_active && u.role !== 'SUPER_ADMIN' ? (
                                          <button onClick={() => deactivateUser(u.id, u.role)} className="bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                              Revoke
                                          </button>
                                      ) : (
                                          <span className="text-gray-600 text-[10px] uppercase font-bold tracking-widest">Locked</span>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {users.length === 0 && (
                      <div className="p-12 text-center text-gray-500 border-t border-white/[0.04]">No user footprints detected...</div>
                  )}
              </div>
          </div>
      </div>
  );
}
