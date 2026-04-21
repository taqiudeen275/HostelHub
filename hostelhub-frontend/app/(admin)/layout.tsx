import { AuthGuard } from "@/components/auth/auth-guard";
import { UserMenu } from "@/components/auth/user-menu";
import Link from "next/link";
import { Building, Home, CalendarCheck, MessageSquare, Settings } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { name: "My Hostels", href: "/admin/hostels", icon: Building },
    { name: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
    { name: "SMS", href: "/admin/sms", icon: MessageSquare },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <AuthGuard requiredRole="HOSTEL_ADMIN">
      <div className="min-h-screen bg-indigo-50/30 flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-background/95 hidden md:block">
          <div className="flex h-14 items-center px-6 border-b">
            <Link href="/admin/dashboard" className="font-bold text-indigo-700 flex items-center gap-2">
              <Home className="w-5 h-5" />
              <span>Partner Panel</span>
            </Link>
          </div>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur flex h-14 items-center px-6 gap-4">
            <div className="md:hidden font-bold text-indigo-700">HostelHub Partners</div>
            <div className="flex-1" />
            <UserMenu loginHref="/admin/login" accent="indigo" />
          </header>
          <main className="flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
