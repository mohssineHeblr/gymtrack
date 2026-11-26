import type { Units } from "./types";

/** RFC4122 v4 UUID. Works in non-secure contexts (e.g. http on LAN) too. */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function cn(...classes: (string | false | null | undefined | 0)[]) {
  return classes.filter(Boolean).join(" ");
}

export const nowIso = () => new Date().toISOString();

/** Local date as YYYY-MM-DD */
export function toDateKey(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Monday-based start of week */
export function startOfWeek(d: Date = new Date()) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  return r;
}

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

const KG_TO_LB = 2.2046226218;

export function kgToDisplay(kg: number | null | undefined, units: Units): number | null {
  if (kg == null || Number.isNaN(kg)) return null;
  const v = units === "lbs" ? kg * KG_TO_LB : kg;
  return Math.round(v * 10) / 10;
}

export function displayToKg(value: number | null | undefined, units: Units): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const v = units === "lbs" ? value / KG_TO_LB : value;
  return Math.round(v * 1000) / 1000;
}

export function formatWeight(kg: number | null | undefined, units: Units, withUnit = true): string {
  const v = kgToDisplay(kg, units);
  if (v == null) return "—";
  return withUnit ? `${formatNumber(v)} ${units}` : formatNumber(v);
}

export function formatNumber(n: number, maxFraction = 1): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFraction });
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return formatNumber(Math.round(n));
}

export function formatDuration(totalSeconds: number, long = false): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (long) {
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  const date = typeof d === "string" ? (d.length === 10 ? fromDateKey(d) : new Date(d)) : d;
  return date.toLocaleDateString(undefined, opts);
}

export function formatTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function relativeDay(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  const diff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7 && diff > 0) return `${diff} days ago`;
  return formatDate(date, { weekday: "short", month: "short", day: "numeric" });
}

export function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Late night grind";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
