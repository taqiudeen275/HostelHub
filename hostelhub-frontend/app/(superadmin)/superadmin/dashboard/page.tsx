"use client";

import { useAuth } from "@/lib/auth-context";
import { Building, Users, ShieldCheck, ArrowUpRight, Cpu, ActivitySquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SuperAdminDashboardPage() {
  const { user } = useAuth();
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => setTime(new Date().toUTCString());
    updateTime();
    const int = setInterval(updateTime, 1000);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="animate-in fade-in duration-700 space-y-6">
      <div className="flex items-center justify-between col-span-full mb-2">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">System Overview</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-min">
        
        {/* Main Greeting / Status Bento */}
        <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-[#111] to-[#0A0A0A] border border-white/[0.08] rounded-3xl p-8 relative overflow-hidden group">
            {/* Ambient Lighting */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]" />
            <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse text-xs" />
                    <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Global Platform Operational</span>
                </div>
                
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-wide">
                    Authentication verified for {user?.email}
                </h2>
                <p className="text-gray-400 text-sm max-w-lg leading-relaxed mb-8">
                    You have elevated root access to the entire HostelHub subsystem. Your actions override manager policies and execute natively against the global database. 
                </p>

                <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                    <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-lg border border-white/[0.04]"><Cpu className="w-3.5 h-3.5" /> SYS_LOAD: 2.1%</div>
                    <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-lg border border-white/[0.04] hidden sm:flex"><ActivitySquare className="w-3.5 h-3.5" /> {time}</div>
                </div>
            </div>
        </div>

        {/* Audit Mini Bento */}
        <div className="col-span-1 bg-[#0A0A0A] border border-white/[0.08] rounded-3xl p-6 relative group hover:border-white/[0.15] transition-colors flex flex-col">
            <div className="flex justify-between items-start mb-auto">
                <div className="w-10 h-10 bg-white/[0.03] rounded-xl flex items-center justify-center border border-white/[0.05]">
                    <ShieldCheck className="w-5 h-5 text-gray-400" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
            </div>
            
            <div className="mt-8">
                <h3 className="text-white font-bold text-lg mb-1">Audit Stream</h3>
                <p className="text-xs text-gray-500 mb-6 line-clamp-2">Cryptographic trails of all sensitive platform actions.</p>
                <Link href="/superadmin/audit" className="inline-flex items-center justify-center w-full bg-white text-black py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-gray-200">
                    Open Logs
                </Link>
            </div>
        </div>

        {/* Feature Bento: Approvals */}
        <Link href="/superadmin/hostels" className="col-span-1 border border-white/[0.08] rounded-3xl overflow-hidden group bg-[#0A0A0A] hover:bg-[#0c0c0c] transition-colors">
            <div className="h-40 bg-gradient-to-br from-blue-900/20 to-transparent p-6 flex flex-col justify-between border-b border-white/[0.04] relative">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Building className="w-6 h-6 text-blue-400 mb-auto" />
                <div>
                    <div className="text-3xl font-black text-white tracking-tighter">Queue</div>
                </div>
            </div>
            <div className="p-6">
                <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-blue-400 transition-colors">Moderation Queue</h3>
                <p className="text-xs text-gray-500">Review pending host property submissions before they enter the public marketplace.</p>
            </div>
        </Link>
        
        {/* Feature Bento: Users */}
        <Link href="/superadmin/users" className="col-span-1 border border-white/[0.08] rounded-3xl overflow-hidden group bg-[#0A0A0A] hover:bg-[#0c0c0c] transition-colors">
            <div className="h-40 bg-gradient-to-br from-indigo-900/20 to-transparent p-6 flex flex-col justify-between border-b border-white/[0.04] relative">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Users className="w-6 h-6 text-indigo-400 mb-auto" />
                <div>
                    <div className="text-3xl font-black text-white tracking-tighter">IAM</div>
                </div>
            </div>
            <div className="p-6">
                <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-indigo-400 transition-colors">Access Network</h3>
                <p className="text-xs text-gray-500">Global identity and access management for admins, managers, and students.</p>
            </div>
        </Link>

        {/* Empty Scaffold Bento */}
        <div className="col-span-1 border border-dashed border-white/[0.1] rounded-3xl p-6 flex flex-col items-center justify-center text-center opacity-40">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Metrics Engine</div>
            <div className="text-[10px] text-gray-600">Reserved for Milestone 6 Data Aggregation</div>
        </div>

      </div>
    </div>
  );
}
