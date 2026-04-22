"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Phone,
  User as UserIcon,
  Image as ImageIcon,
  Shield,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { authApi, type StudentProfile } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PRIVACY_OPTIONS = [
  { value: "NOBODY", label: "Nobody", icon: EyeOff, description: "Only you" },
  { value: "ROOMMATES", label: "Roommates", icon: Lock, description: "Roommates only" },
  { value: "HOSTELMATES", label: "Hostelmates", icon: Eye, description: "Anyone in hostel" },
] as const;

export default function StudentSettingsPage() {
  const { user, refreshUser } = useAuth();
  const profile = user?.student_profile;

  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [toggles, setToggles] = useState({
    privacy_phone: profile?.privacy_phone || "ROOMMATES",
    privacy_full_name: profile?.privacy_full_name || "ROOMMATES",
    privacy_photo: profile?.privacy_photo || "HOSTELMATES",
  });

  if (!profile) return null;

  async function handleToggleChange(field: keyof typeof toggles, value: string) {
    setToggles(prev => ({ ...prev, [field]: value }));
    setIsLoading(field);
    setError("");

    try {
      await authApi.updatePrivacy({ [field]: value });
      await refreshUser();
      toast.success("Privacy settings updated");
    } catch (err: any) {
      setError(err.message || "Failed to update privacy");
      setToggles(prev => ({ ...prev, [field]: profile![field] })); // rollback
    } finally {
      setIsLoading(null);
    }
  }

  const PRIVACY_FIELDS = [
    {
      id: "privacy_full_name" as const,
      label: "Full Name",
      description: "Whether other students can see your full first and last name.",
      icon: UserIcon,
    },
    {
      id: "privacy_phone" as const,
      label: "Phone Number",
      description: "Whether other students can see your contact number.",
      icon: Phone,
    },
    {
      id: "privacy_photo" as const,
      label: "Profile Photo",
      description: "Whether other students can see your uploaded profile picture.",
      icon: ImageIcon,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Settings & Privacy
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your personal information and control who can see it.
        </p>
      </div>

      {/* ── Profile summary ── */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex items-center gap-4 py-5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-lg">
            {(user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "") || "S"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              {user?.full_name || "Student"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user?.phone}
              {profile.program && ` · ${profile.program}`}
              {profile.level && ` · Level ${profile.level}`}
            </p>
          </div>
          <Badge variant="secondary">Student</Badge>
        </CardContent>
      </Card>

      {/* ── Privacy controls ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Privacy Controls</CardTitle>
          </div>
          <CardDescription>
            Choose what information is visible to other students. Hostel Admins can always see your full details to manage your booking.
          </CardDescription>

          {error && (
            <div className="mt-3 text-sm text-destructive font-medium bg-destructive/5 border border-destructive/20 p-3 rounded-lg">
              {error}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {PRIVACY_FIELDS.map((item, i) => {
            const Icon = item.icon;
            const isFieldLoading = isLoading === item.id;
            return (
              <div key={item.id}>
                {i > 0 && <Separator />}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground text-sm">{item.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isFieldLoading && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                    <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
                      {PRIVACY_OPTIONS.map((opt) => {
                        const active = toggles[item.id] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleToggleChange(item.id, opt.value)}
                            disabled={isLoading !== null}
                            className={`
                              inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all
                              disabled:opacity-50 disabled:cursor-not-allowed
                              ${
                                active
                                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                            `}
                            aria-label={`Set ${item.label} visibility to ${opt.label}`}
                          >
                            <opt.icon className="w-3 h-3" />
                            <span className="hidden sm:inline">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Account info ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-muted/50 border px-3.5 py-3">
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Phone
              </dt>
              <dd className="font-medium text-foreground">{user?.phone || "—"}</dd>
            </div>
            <div className="rounded-lg bg-muted/50 border px-3.5 py-3">
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Gender
              </dt>
              <dd className="font-medium text-foreground capitalize">
                {profile.gender?.toLowerCase() || "—"}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/50 border px-3.5 py-3">
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Program
              </dt>
              <dd className="font-medium text-foreground">{profile.program || "—"}</dd>
            </div>
            <div className="rounded-lg bg-muted/50 border px-3.5 py-3">
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Member since
              </dt>
              <dd className="font-medium text-foreground">
                {user?.date_joined
                  ? new Date(user.date_joined).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
