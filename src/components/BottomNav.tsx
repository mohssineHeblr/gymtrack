"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Home, LineChart, Plus, User } from "lucide-react";
import { useGym } from "@/lib/store";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/programs", label: "Programs", icon: CalendarRange, match: (p: string) => p.startsWith("/programs") },
  { href: "/workout", label: "Workout", icon: Plus, center: true, match: (p: string) => p.startsWith("/workout") },
  { href: "/progress", label: "Progress", icon: LineChart, match: (p: string) => ["/progress", "/body", "/history"].some((x) => p.startsWith(x)) },
  { href: "/profile", label: "Profile", icon: User, match: (p: string) => ["/profile", "/nutrition", "/exercises", "/login"].some((x) => p.startsWith(x)) },
];

export function BottomNav() {
  const pathname = usePathname();
  const active = useGym((s) => s.activeWorkout !== null);
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-safe">
      <div className="mx-auto flex h-[68px] max-w-lg items-center justify-around px-2">
        {items.map(({ href, label, icon: Icon, center, match }) => {
          const isActive = match(pathname);
          if (center) {
            return (
              <Link key={href} href={href} aria-label={label} className="tap -mt-6 flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_10px_30px_-6px_var(--accent)]",
                    active && "ring-4 ring-accent/30",
                  )}
                >
                  <Icon className={cn("h-7 w-7", active && "animate-pulse")} strokeWidth={2.6} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn("tap flex w-16 flex-col items-center gap-1 py-1", isActive ? "text-accent" : "text-muted")}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 1.9} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
