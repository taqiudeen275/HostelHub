"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowRight, ShieldCheck, Building2 } from "lucide-react";

import { PhoneInput } from "@/components/auth/phone-input";
import { OtpInput } from "@/components/auth/otp-input";
import { CountdownTimer } from "@/components/auth/countdown-timer";
import { RedirectIfAuthed } from "@/components/auth/redirect-if-authed";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Step = "phone" | "otp";

export default function AdminLoginPage() {
  return (
    <RedirectIfAuthed>
      <AdminLoginForm />
    </RedirectIfAuthed>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get("next") || "/admin/dashboard";
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError("");

    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.requestOtp(phone);
      setCooldown(res.resend_cooldown_seconds);
      setStep("otp");
      toast.success("Code sent to your phone");
    } catch (err: any) {
      setError(err.message || "Failed to send code");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    if (isLoading) return;
    setError("");
    setIsLoading(true);

    try {
      const res = await authApi.verifyOtp(phone, code, "HOSTEL_ADMIN");
      login(res.tokens, res.user);
      
      toast.success("Welcome back!");
      router.push(nextPath);
      
    } catch (err: any) {
      setError(err.message || "Invalid code");
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    
    setIsLoading(true);
    try {
      const res = await authApi.requestOtp(phone);
      setCooldown(res.resend_cooldown_seconds);
      toast.success("New code sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 mb-2">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {step === "phone" ? "Partner sign in or sign up" : "Verify Number"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {step === "phone"
            ? "Enter your phone number. If you're a new partner, we'll create your account and walk you through listing your first hostel."
            : `We sent a 6-digit code to `}
          {step === "otp" && <span className="font-medium text-foreground">{phone}</span>}
        </p>
      </div>

      {/* Auth Flow */}
      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8">
        {step === "phone" ? (
          <form onSubmit={handleRequestOtp} className="space-y-6">
            <PhoneInput
              value={phone}
              onChange={(val) => { setPhone(val); setError(""); }}
              disabled={isLoading}
              error={error}
            />

            <button
              type="submit"
              disabled={isLoading || phone.length < 10}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 h-11 px-8 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Continue to Dashboard
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <OtpInput
              value={otp}
              onChange={(val) => { setOtp(val); setError(""); }}
              onComplete={handleVerifyOtp}
              disabled={isLoading}
              error={error}
            />

            {isLoading && (
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-4 text-sm text-center pt-2">
              <button
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                disabled={isLoading}
              >
                Wrong number?
              </button>
              
              <div className="h-px w-full max-w-[200px] bg-border" />
              
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Didn't receive the code?</span>
                {cooldown > 0 ? (
                  <CountdownTimer
                    seconds={cooldown}
                    onExpire={() => setCooldown(0)}
                    label="Resend in"
                    className="w-12 inline-block text-left"
                  />
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={isLoading}
                    className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Resend
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4">
        <ShieldCheck className="w-4 h-4" />
        <span>HostelHub Partners Portal</span>
      </div>
    </div>
  );
}
