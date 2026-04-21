"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { UserMenu } from "@/components/auth/user-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Building, Users, Terminal } from "lucide-react";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Command Center", href: "/superadmin/dashboard", icon: LayoutDashboard },
    { name: "Approval Queue", href: "/superadmin/hostels", icon: Building },
    { name: "Access Network", href: "/superadmin/users", icon: Users },
    { name: "Audit Stream", href: "/superadmin/audit", icon: ShieldCheck },
  ];

  return (
    <AuthGuard requiredRole="SUPER_ADMIN">
      <div className="flex h-screen bg-black text-gray-300 font-sans selection:bg-indigo-500/30 overflow-hidden">
        
        {/* Dynamic Glowing Mesh Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] opacity-50 mixing-blend-screen mix-blend-screen" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[120px] opacity-30 mix-blend-screen" />
        </div>

        {/* Sidebar */}
        <aside className="w-64 bg-[#0A0A0A] border-r border-white/[0.08] hidden md:flex flex-col relative z-20 shrink-0">
            {/* Brand Header */}
            <div className="h-16 flex items-center px-6 border-b border-white/[0.08]">
                <Link href="/superadmin/dashboard" className="flex items-center gap-3 group">
                    <div className="w-6 h-6 bg-white rounded flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden relative">
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-50 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        <Terminal className="w-3.5 h-3.5 text-black" />
                    </div>
                    <span className="font-bold tracking-widest uppercase text-xs text-white opacity-90 group-hover:opacity-100 transition-opacity">SYS_ADMIN</span>
                </Link>
            </div>

            {/* Navigation */}
            <div className="p-4 flex-1">
                <nav className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3 ml-2">Subsystems</div>
                    {navItems.map(item => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link 
                                key={item.href} 
                                href={item.href} 
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all relative group ${
                                    isActive ? 'text-white bg-white/[0.04]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                                }`}
                            >
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-indigo-500 rounded-r-full shadow-[0_0_10px_2px_rgba(99,102,241,0.5)]" />
                                )}
                                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-indigo-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* User Pinned Profile */}
            <div className="p-4 border-t border-white/[0.08]">
                <UserMenu loginHref="/auth/superadmin" accent="slate" />
            </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 w-full h-14 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/[0.08] z-30 flex items-center justify-between px-4">
            <Link href="/superadmin/dashboard" className="flex items-center gap-2">
                <div className="w-5 h-5 bg-white rounded flex items-center justify-center"><Terminal className="w-3 h-3 text-black" /></div>
                <span className="font-bold tracking-widest uppercase text-[10px] text-white">SYS_ADMIN</span>
            </Link>
            <UserMenu loginHref="/auth/superadmin" accent="slate" />
        </div>

        {/* Dynamic Canvas */}
        <main className="flex-1 overflow-y-auto relative z-10 pt-14 pb-20 md:pt-0 md:pb-0">
            <div className="p-4 md:p-10 lg:p-12 max-w-7xl mx-auto w-full min-h-full">
                {children}
            </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/[0.08] z-40 flex items-center justify-around px-2 pb-safe">
            {navItems.map(item => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                    <Link 
                        key={item.href} 
                        href={item.href} 
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                            isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        <div className="relative">
                            <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : ''}`} />
                            {isActive && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full" />}
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80">{item.name.split(' ')[0]}</span>
                    </Link>
                );
            })}
        </div>
      </div>
    </AuthGuard>
  );
}
