import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Local-calendar date as `YYYY-MM-DD`.
 * `Date#toISOString()` is UTC — in KST (UTC+9) it reports *yesterday* between
 * 00:00 and 09:00, which mis-classified same-day matches as "scheduled" and
 * shifted calendar heatmaps by one day. Always use this for date keys.
 */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a `YYYY-MM-DD` key as a *local* date (the Date ctor parses it as UTC). */
export function parseLocalDate(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
