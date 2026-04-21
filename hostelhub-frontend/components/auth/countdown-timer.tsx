"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  seconds: number;
  onExpire?: () => void;
  label?: string;
  className?: string;
}

/**
 * Countdown timer — shows MM:SS, calls onExpire when done.
 * Used for both OTP expiry and resend cooldown.
 */
export function CountdownTimer({
  seconds: initialSeconds,
  onExpire,
  label,
  className,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [remaining, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const isUrgent = remaining <= 30;

  return (
    <span
      className={cn(
        "font-mono text-sm font-semibold tabular-nums transition-colors duration-300",
        isUrgent ? "text-destructive" : "text-muted-foreground",
        className
      )}
      aria-live="polite"
      aria-label={`${label ?? "Time remaining"}: ${display}`}
    >
      {display}
    </span>
  );
}
