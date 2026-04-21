"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (normalized: string) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * Ghana-aware phone input.
 * - Shows +233 prefix locked in
 * - User types the rest (0244… or 244… both work)
 * - Shows the E.164 preview below so the user can confirm
 */
export function PhoneInput({ value, onChange, disabled, error }: PhoneInputProps) {
  const [raw, setRaw] = useState(value.replace(/^\+233/, "0"));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value.replace(/\D/g, ""); // digits only
    setRaw(input);

    // Normalize to E.164 for parent
    let e164 = "";
    if (input.startsWith("0") && input.length >= 2) {
      e164 = "+233" + input.slice(1);
    } else if (input.startsWith("233") && input.length >= 4) {
      e164 = "+" + input;
    } else if (input.length >= 9) {
      e164 = "+233" + input;
    } else {
      e164 = input;
    }
    onChange(e164);
  }

  const preview = raw.startsWith("0") && raw.length === 10
    ? "+233" + raw.slice(1)
    : raw.length > 0
    ? "(enter your full number)"
    : "";

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground/80">
        Phone Number
      </label>
      <div
        className={cn(
          "flex items-center rounded-xl border bg-background/60 backdrop-blur-sm",
          "transition-all duration-200",
          "focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary",
          error ? "border-destructive" : "border-border",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Flag + country code prefix */}
        <div className="flex items-center gap-1.5 pl-4 pr-3 py-3 border-r border-border/60 shrink-0">
          <span className="text-lg leading-none" aria-hidden>🇬🇭</span>
          <span className="text-sm font-medium text-foreground/70">+233</span>
        </div>

        <input
          type="tel"
          inputMode="numeric"
          placeholder="0244 123 456"
          value={raw}
          onChange={handleChange}
          disabled={disabled}
          maxLength={12}
          className={cn(
            "flex-1 bg-transparent px-3 py-3 text-sm outline-none",
            "placeholder:text-muted-foreground",
            disabled && "cursor-not-allowed"
          )}
          aria-label="Phone number"
          aria-describedby={error ? "phone-error" : "phone-preview"}
        />
      </div>

      {/* E.164 preview */}
      {preview && !error && (
        <p id="phone-preview" className="text-xs text-muted-foreground pl-1">
          Will send to: <span className="font-mono font-medium">{preview}</span>
        </p>
      )}

      {error && (
        <p id="phone-error" className="text-xs text-destructive pl-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
