"use client";

import { useEffect, useState } from "react";
import { superAdminApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Terminal, AlertTriangle, PlayCircle, Key, Activity } from "lucide-react";

export default function SuperAdminAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
      try {
          const res = await superAdminApi.getAuditLogs();
          setLogs(res);
      } catch (err) {
          toast.error("Failed to fetch cryptographically secure audit trails");
      } finally {
          setIsLoading(false);
      }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
      <div className="animate-in fade-in pb-12 overflow-hidden max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">Immutable Audit Trails <ShieldCheck className="w-5 h-5 text-green-500 mb-1" /></h1>
                  <p className="text-sm text-gray-400 mt-1">Chronological log of all sensitive elevated actions taken on the infrastructure.</p>
              </div>
          </div>

          <div className="bg-[#050505] rounded-2xl border border-white/[0.1] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden font-mono text-sm relative">
              {/* Terminal Header */}
              <div className="bg-[#0A0A0A] border-b border-white/[0.08] px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                  </div>
                  <div className="ml-4 text-[10px] font-bold text-gray-600 flex items-center gap-2 tracking-widest uppercase">
                      <Terminal className="w-3.5 h-3.5" /> root@SYS_ADMIN:/var/log/secure
                  </div>
              </div>

              {/* Log Window */}
              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-4">
                  {logs.length === 0 ? (
                      <div className="text-gray-600 text-center py-10 opacity-50">&lt; NO_EVENTS_FOUND_IN_BLOCK /&gt;</div>
                  ) : (
                      logs.map((log) => {
                          const date = new Date(log.created_at);
                          const isWarning = log.action === 'REJECT' || log.action === 'DEACTIVATE';
                          const isCreate = log.action === 'CREATE_ON_BEHALF';
                          return (
                              <div key={log.id} className="flex gap-4 group hover:bg-white/[0.02] p-2 -mx-2 rounded transition-colors relative">
                                  {/* Hover gradient line */}
                                  <div className="absolute left-[-8px] top-0 bottom-0 w-[2px] bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                  {/* Timestamp column */}
                                  <div className="text-gray-600 shrink-0 w-32 border-r border-white/[0.08] pr-4 text-xs font-bold font-mono">
                                      {date.toISOString().split('T')[0]} <br/>
                                      <span className="text-indigo-900/80 group-hover:text-indigo-400 text-[10px] transition-colors">{date.toISOString().split('T')[1].split('.')[0]} UTC</span>
                                  </div>

                                  {/* Content column */}
                                  <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1.5 text-xs">
                                          <span className="text-gray-600 font-bold tracking-widest uppercase text-[10px]">ActorUID_{log.actor}:</span>
                                          <span className="text-emerald-400 font-bold">{log.actor_email || log.actor_phone || "SYSTEM_DAEMON"}</span>
                                      </div>
                                      
                                      <div className="flex items-start gap-2">
                                          <span className="text-gray-700 mt-0.5 font-bold">&gt;</span>
                                          <div>
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase mr-2 ${
                                                  isWarning ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 
                                                  isCreate ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                                                  'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                                              }`}>
                                                  {log.action}
                                              </span>
                                              <span className="text-gray-300 leading-relaxed font-sans text-xs">{log.notes}</span>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Decorator */}
                                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {isWarning ? <AlertTriangle className="w-4 h-4 text-red-500/50" /> : 
                                       isCreate ? <PlayCircle className="w-4 h-4 text-blue-500/50" /> : 
                                       <Activity className="w-4 h-4 text-green-500/50" />}
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>
          </div>
      </div>
  );
}
