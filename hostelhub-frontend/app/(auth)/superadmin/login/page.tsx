"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Command } from "lucide-react";

import { RedirectIfAuthed } from "@/components/auth/redirect-if-authed";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SuperAdminLoginPage() {
  return (
    <RedirectIfAuthed>
      <SuperAdminLoginForm />
    </RedirectIfAuthed>
  );
}

function SuperAdminLoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.superAdminLogin(email, password);
      login(res.tokens, res.user);
      
      toast.success("Super Admin authenticated");
      router.push("/superadmin/dashboard");
      
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
      setPassword(""); // clear password on error
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white mb-2">
          <Command className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Platform Admin
        </h1>
        <p className="text-muted-foreground text-sm">
          Sign in to manage the HostelHub platform, approve listings, and view metrics.
        </p>
      </div>

      {/* Auth Flow */}
      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground/80" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              disabled={isLoading}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all duration-200"
              placeholder="admin@hostelhub.dev"
              required
            />
          </div>

          <div className="space-y-1.5 pb-2">
            <label className="block text-sm font-medium text-foreground/80" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              disabled={isLoading}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background/60 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all duration-200"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 h-11 px-8 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Sign In to Platform"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
