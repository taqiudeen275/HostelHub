"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";

import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function AdminOnboardingPage() {
  const router = useRouter();
  const { user, isLoading, refreshUser } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/admin/login?next=/admin/onboarding");
      return;
    }
    if (user.role !== "HOSTEL_ADMIN") {
      router.replace("/");
      return;
    }
    if (user.is_onboarding_complete) {
      router.replace("/admin/dashboard");
    }
  }, [isLoading, user, router]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setError("");

    if (!firstName || !lastName || !businessName) {
      setError("Please fill in all required fields to continue");
      return;
    }

    setIsSaving(true);
    try {
      await authApi.updateMe({ first_name: firstName, last_name: lastName });
      await authApi.updateAdminProfile({
        business_name: businessName,
        whatsapp_number: whatsappNumber,
      });
      await refreshUser();

      toast.success("Profile saved! Let's set up your first hostel.");
      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
      setIsSaving(false);
    }
  }

  // Show spinner while routing resolves
  if (isLoading || !user || user.is_onboarding_complete || user.role !== "HOSTEL_ADMIN") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 mb-2">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Set Up Your Partner Account
        </h1>
        <p className="text-muted-foreground text-sm">
          A few details about you and your business before you list your first hostel.
        </p>
      </div>

      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none"
                placeholder="Akosua"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">
                Last Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none"
                placeholder="Owusu"
                required
              />
            </div>
          </div>

          {/* Business name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground/80">
              Business / Hostel Brand Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none"
              placeholder="e.g. Owusu Premier Hostels"
              required
            />
            <p className="text-xs text-muted-foreground">
              This is your trading name — it can differ from individual hostel names.
            </p>
          </div>

          {/* WhatsApp (optional) */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground/80">
              WhatsApp Number{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none"
              placeholder="e.g. 0244123456"
            />
            <p className="text-xs text-muted-foreground">
              Students will be able to contact you directly via WhatsApp from the hostel listing.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || !firstName || !lastName || !businessName}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 h-11 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Save and Go to Dashboard"
              )}
            </button>
          </div>
        </form>
      </div>

      <p className="text-xs text-muted-foreground text-center px-4">
        You can update these details any time from your account settings.
      </p>
    </div>
  );
}
