"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCircle2 } from "lucide-react";

import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function StudentOnboardingPage() {
  const router = useRouter();
  const { user, isLoading, refreshUser } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/student/login?next=/student/onboarding");
      return;
    }
    if (user.role !== "STUDENT") {
      router.replace("/");
      return;
    }
    if (user.is_onboarding_complete) {
      router.replace("/student/dashboard");
    }
  }, [isLoading, user, router]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [program, setProgram] = useState("");
  const [level, setLevel] = useState("100");
  const [gender, setGender] = useState("Female");
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setError("");

    if (!firstName || !lastName || !program) {
      setError("Please fill in all details to continue");
      return;
    }

    setIsSaving(true);
    try {
      await authApi.updateMe({
        first_name: firstName,
        last_name: lastName,
      });
      await authApi.updateStudentProfile({ program, level, gender });
      await refreshUser();

      toast.success("Profile saved!");
      router.push("/student/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
      setIsSaving(false);
    }
  }

  // While we figure out where to route them, render a spinner.
  if (isLoading || !user || user.is_onboarding_complete || user.role !== "STUDENT") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-100 text-orange-600 mb-2">
          <UserCircle2 className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Complete Profile
        </h1>
        <p className="text-muted-foreground text-sm">
          Just a few details before you can start booking rooms.
        </p>
      </div>

      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
                placeholder="Ama"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
                placeholder="Mensah"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground/80">Program of Study</label>
            <input
              type="text"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
              placeholder="e.g. Computer Science"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">Academic Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
              >
                <option value="100">Level 100</option>
                <option value="200">Level 200</option>
                <option value="300">Level 300</option>
                <option value="400">Level 400</option>
                <option value="MASTERS">Masters</option>
                <option value="PHD">PhD</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || !firstName || !lastName || !program}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save and Continue"}
            </button>
          </div>
        </form>
      </div>
      
      <p className="text-xs text-muted-foreground text-center px-4">
        Your privacy settings can be adjusted later from your dashboard. By default, your full name and phone number are only visible to your confirmed roommates.
      </p>
    </div>
  );
}
