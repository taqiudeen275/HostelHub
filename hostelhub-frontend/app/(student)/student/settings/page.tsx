"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { authApi, type StudentProfile } from "@/lib/api";

export default function StudentSettingsPage() {
  const { user, refreshUser } = useAuth();
  const profile = user?.student_profile;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [toggles, setToggles] = useState({
    privacy_phone: profile?.privacy_phone || "ROOMMATES",
    privacy_full_name: profile?.privacy_full_name || "ROOMMATES",
    privacy_photo: profile?.privacy_photo || "HOSTELMATES",
  });

  if (!profile) return null;

  async function handleToggleChange(field: keyof typeof toggles, value: string) {
    setToggles(prev => ({ ...prev, [field]: value }));
    setIsLoading(true);
    setError("");

    try {
      await authApi.updatePrivacy({ [field]: value });
      await refreshUser();
      toast.success("Privacy settings updated");
    } catch (err: any) {
      setError(err.message || "Failed to update privacy");
      setToggles(prev => ({ ...prev, [field]: profile![field] })); // rollback
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings & Privacy</h1>
        <p className="text-muted-foreground mt-2">
          Manage your personal information and control who can see it.
        </p>
      </div>

      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 border-b">
          <h2 className="text-xl font-semibold mb-1">Privacy Controls</h2>
          <p className="text-sm text-muted-foreground">
            Choose what information is visible to other students. Hostel Admins can always see your full details to manage your booking.
          </p>

          {error && (
            <p className="mt-4 text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg">
              {error}
            </p>
          )}
        </div>

        <div className="divide-y">
          {[
            {
              id: "privacy_full_name" as const,
              label: "Full Name",
              description: "Whether other students can see your full first and last name.",
            },
            {
              id: "privacy_phone" as const,
              label: "Phone Number",
              description: "Whether other students can see your contact number.",
            },
            {
              id: "privacy_photo" as const,
              label: "Profile Photo",
              description: "Whether other students can see your uploaded profile picture.",
            },
          ].map((item) => (
            <div key={item.id} className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-foreground">{item.label}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
                  {item.description}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-3">
                {isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                <select
                  value={toggles[item.id]}
                  onChange={(e) => handleToggleChange(item.id, e.target.value)}
                  disabled={isLoading}
                  className="h-10 px-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all disabled:opacity-50"
                  aria-label={item.label}
                >
                  <option value="NOBODY">Nobody</option>
                  <option value="ROOMMATES">Roommates Only</option>
                  <option value="HOSTELMATES">Anyone in My Hostel</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
