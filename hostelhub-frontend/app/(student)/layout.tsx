import { AuthGuard } from "@/components/auth/auth-guard";
import { UserMenu } from "@/components/auth/user-menu";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="STUDENT">
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-6 gap-4 border-b">
            <div className="font-bold">HostelHub</div>
            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground ml-8">
              <a href="/student/dashboard" className="hover:text-foreground">Dashboard</a>
              <a href="/student/bookings" className="hover:text-foreground">My Bookings</a>
              <a href="/hostels" className="hover:text-foreground">Find Hostels</a>
              <a href="/student/settings" className="hover:text-foreground">Settings</a>
            </nav>
            <div className="flex-1" />
            <UserMenu
              loginHref="/student/login"
              settingsHref="/student/settings"
              accent="primary"
            />
          </div>
        </header>

        <main className="p-6 md:p-10">{children}</main>
      </div>
    </AuthGuard>
  );
}
