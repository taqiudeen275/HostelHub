import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a GHS price */
export function formatGHS(amount: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Normalize a Ghanaian phone for display — +233244123456 → 0244 123 456 */
export function formatPhone(e164: string): string {
  if (!e164.startsWith("+233")) return e164;
  const local = "0" + e164.slice(4);
  return local.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3");
}
