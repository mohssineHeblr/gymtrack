"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  className,
  children,
  onClick,
  as = "div",
  id,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  as?: "div" | "button";
  id?: string;
}) {
  const Comp = onClick ? "button" : as;
  return (
    <Comp
      id={id}
      onClick={onClick}
      className={cn(
        "block w-full rounded-3xl border border-line bg-surface p-4 text-left",
        onClick && "tap cursor-pointer",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "tap inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-[15px]",
        size === "lg" && "h-14 px-6 text-base",
        variant === "primary" && "bg-accent text-accent-ink shadow-[0_8px_30px_-8px_var(--accent)]",
        variant === "secondary" && "bg-surface-2 text-fg",
        variant === "ghost" && "bg-transparent text-fg",
        variant === "danger" && "bg-danger/15 text-danger",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  className,
  children,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        "tap inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
export function PageHeader({
  title,
  subtitle,
  back,
  action,
  large = true,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: boolean | string;
  action?: ReactNode;
  large?: boolean;
}) {
  const router = useRouter();
  return (
    <header className="pt-safe sticky top-0 z-30 -mx-4 mb-2 px-4 pb-3 glass">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {back && (
            <IconButton
              label="Back"
              onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
              className="-ml-1 bg-transparent"
            >
              <ChevronLeft className="h-6 w-6" />
            </IconButton>
          )}
          {!large && <h1 className="truncate text-lg font-bold">{title}</h1>}
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {large && (
        <div className="mt-1">
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet (bottom modal)
// ---------------------------------------------------------------------------
let openSheets = 0;
function lockScroll() {
  openSheets++;
  document.body.style.overflow = "hidden";
}
function unlockScroll() {
  openSheets = Math.max(0, openSheets - 1);
  if (openSheets === 0) document.body.style.overflow = "";
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  full,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Lock page scroll while any sheet is open. A shared counter (instead of saving/restoring the
  // previous value) keeps nested sheets from leaving the page stuck at overflow:hidden.
  useEffect(() => {
    if (!open) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative flex w-full max-w-lg animate-sheet-up flex-col rounded-t-[28px] border-t border-line bg-surface",
          full ? "h-[92dvh]" : "max-h-[88dvh]",
        )}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-surface-3" />
          <h3 className="mt-2 text-lg font-bold">{title}</h3>
          <IconButton label="Close" onClick={onClose} className="mt-2 h-8 w-8">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------
export function Field({ label, hint, children, group }: { label: string; hint?: string; children: ReactNode; group?: boolean }) {
  const Comp = group ? "div" : "label";
  return (
    <Comp className="block" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-subtle">{hint}</span>}
    </Comp>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-fg outline-none placeholder:text-subtle focus:border-accent/60",
        className,
      )}
    />
  );
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(
        "min-h-24 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-fg outline-none placeholder:text-subtle focus:border-accent/60",
        className,
      )}
    />
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cn("h-12 w-full appearance-none rounded-2xl border border-line bg-surface-2 px-4 text-fg outline-none", className)}
    >
      {children}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-2xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
            value === o.value ? "bg-surface-3 text-fg shadow" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium",
        active ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface-2 text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3")}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------
export function Stat({
  label,
  value,
  unit,
  icon,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between text-muted">
        <span className="text-[13px] font-medium">{label}</span>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[26px] font-bold leading-none tracking-tight">{value}</span>
        {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, color = "var(--accent)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Ring({
  value,
  max,
  size = 120,
  stroke = 12,
  color = "var(--accent)",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent", className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-3xl bg-surface", className)} />;
}

/** Numeric input that keeps a local text buffer (so "62." can be typed) and selects on focus */
export function NumberCell({
  value,
  onChange,
  placeholder,
  decimal,
  className,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);
  return (
    <input
      aria-label={ariaLabel}
      inputMode={decimal ? "decimal" : "numeric"}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(value == null ? "" : String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        const re = decimal ? /^\d*\.?\d*$/ : /^\d*$/;
        if (!re.test(raw)) return;
        setText(raw);
        if (raw === "" || raw === ".") return onChange(null);
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
      className={cn(
        "h-10 w-full rounded-xl bg-surface-2 text-center font-semibold tabular-nums text-fg outline-none placeholder:text-subtle focus:ring-2 focus:ring-accent/50",
        className,
      )}
    />
  );
}
