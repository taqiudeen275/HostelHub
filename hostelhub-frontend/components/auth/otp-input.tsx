"use client";

import { useEffect, useRef } from "react";
import { OTPInput, SlotProps } from "input-otp";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

function Slot(props: SlotProps) {
  return (
    <div
      className={cn(
        "relative w-12 h-14 flex items-center justify-center",
        "border-2 rounded-xl bg-background/60 backdrop-blur-sm",
        "text-xl font-bold tracking-widest",
        "transition-all duration-200",
        props.isActive
          ? "border-primary ring-2 ring-primary/30 scale-105"
          : props.char
          ? "border-primary/50"
          : "border-border",
      )}
    >
      {props.char ?? (
        <span className="text-muted-foreground/30 text-sm">•</span>
      )}
      {props.hasFakeCaret && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-px h-6 bg-primary animate-pulse" />
        </span>
      )}
    </div>
  );
}

/**
 * 6-digit OTP input.
 * - Auto-submits when all 6 digits are entered
 * - Shows individual digit slots with active state animation
 */
export function OtpInput({ value, onChange, onComplete, disabled, error }: OtpInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground/80">
        Enter the 6-digit code
      </label>

      <div className="flex justify-center">
        <OTPInput
          value={value}
          onChange={onChange}
          onComplete={onComplete}
          maxLength={6}
          disabled={disabled}
          render={({ slots }) => (
            <div className="flex gap-2">
              {slots.map((slot, idx) => (
                <Slot key={idx} {...slot} />
              ))}
            </div>
          )}
        />
      </div>

      {error && (
        <p className="text-xs text-destructive text-center pt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
