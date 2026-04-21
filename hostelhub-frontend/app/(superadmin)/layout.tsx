import { AuthGuard } from "@/components/auth/auth-guard";
import { UserMenu } from "@/components/auth/user-menu";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="SUPER_ADMIN">
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-50 w-full border-b bg-slate-900 text-white">
          <div className="flex h-14 items-center px-6 gap-4">
            <div className="font-bold">HostelHub Platform Admin</div>
            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-300 ml-8">
              <a href="/superadmin/dashboard" className="hover:text-white">Dashboard</a>
            </nav>
            <div className="flex-1" />
            <UserMenu loginHref="/superadmin/login" accent="slate" />
          </div>
        </header>
        <main className="p-6 md:p-10">{children}</main>
      </div>
    </AuthGuard>
  );
}
