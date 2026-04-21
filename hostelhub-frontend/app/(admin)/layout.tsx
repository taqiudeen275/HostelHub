import { AuthGuard } from "@/components/auth/auth-guard";
import { UserMenu } from "@/components/auth/user-menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="HOSTEL_ADMIN">
      <div className="min-h-screen bg-indigo-50/30">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center px-6 gap-4 border-b">
            <div className="font-bold text-indigo-700">HostelHub Partners</div>
            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground ml-8">
              <a href="/admin/dashboard" className="hover:text-foreground">Dashboard</a>
            </nav>
            <div className="flex-1" />
            <UserMenu loginHref="/admin/login" accent="indigo" />
          </div>
        </header>
        <main className="p-6 md:p-10">{children}</main>
      </div>
    </AuthGuard>
  );
}
