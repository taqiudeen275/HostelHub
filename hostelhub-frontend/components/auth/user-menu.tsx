"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings2, UserCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

interface UserMenuProps {
  settingsHref?: string;
  loginHref: string;
  accent?: "primary" | "indigo" | "slate";
}

const ACCENT_CLASSES: Record<NonNullable<UserMenuProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  indigo: "bg-indigo-100 text-indigo-700",
  slate: "bg-slate-200 text-slate-800",
};

export function UserMenu({
  settingsHref,
  loginHref,
  accent = "primary",
}: UserMenuProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const initials =
    `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.phone.slice(-2);

  const displayName = user.full_name || user.phone;

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success("Signed out");
      router.replace(loginHref);
    } catch {
      toast.error("Could not sign out — try again.");
      setIsLoggingOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${ACCENT_CLASSES[accent]}`}
          >
            {isLoggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              initials
            )}
          </div>
          <span className="hidden sm:inline text-sm font-medium text-foreground max-w-[140px] truncate">
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {user.phone}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {settingsHref && (
          <DropdownMenuItem onSelect={() => router.push(settingsHref)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Settings &amp; privacy
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleLogout();
          }}
          disabled={isLoggingOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
