"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useGym } from "@/lib/store";
import { initAuth, useAuth } from "@/lib/auth";
import { hasLocalChanges, syncNow } from "@/lib/sync";
import { unlockAudio } from "@/lib/hooks";
import { BottomNav } from "./BottomNav";
import { RestTimer } from "./RestTimer";
import { ActiveWorkoutBar } from "./ActiveWorkoutBar";
import { Onboarding } from "./Onboarding";
import { Dumbbell } from "lucide-react";

function applyTheme(theme: string) {
  const root = document.documentElement;
  const resolved =
    theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  root.classList.toggle("light", resolved === "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "light" ? "#f2f2f7" : "#000000");
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useGym((s) => s.hydrated);
  const onboarded = useGym((s) => s.onboarded);
  const theme = useGym((s) => s.profile.theme);
  const user = useAuth((s) => s.user);
  const floating = useGym((s) => s.activeWorkout !== null || s.restTimer.endsAt !== null);
  const pathname = usePathname();

  // Load persisted data
  useEffect(() => {
    void Promise.resolve(useGym.persist.rehydrate()).then(() => useGym.getState().setHydrated());
    initAuth();
  }, []);

  // Theme
  useEffect(() => {
    if (!hydrated) return;
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const fn = () => applyTheme("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [theme, hydrated]);

  // Service worker (production only — avoids caching during development)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("SW registration failed", e));
  }, []);

  // iOS needs a user gesture to enable sounds for the rest timer
  useEffect(() => {
    const fn = () => unlockAudio();
    window.addEventListener("touchend", fn, { once: true });
    window.addEventListener("click", fn, { once: true });
    return () => {
      window.removeEventListener("touchend", fn);
      window.removeEventListener("click", fn);
    };
  }, []);

  // Background sync when signed in
  useEffect(() => {
    if (!hydrated || !user) return;
    void syncNow();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (hasLocalChanges()) void syncNow();
      }, 4000);
    };
    const unsub = useGym.subscribe((s, prev) => {
      const changed =
        s.workouts !== prev.workouts ||
        s.programs !== prev.programs ||
        s.body !== prev.body ||
        s.nutrition !== prev.nutrition ||
        s.profile !== prev.profile ||
        s.customExercises !== prev.customExercises;
      if (changed) schedule();
    });
    const online = () => void syncNow();
    const visible = () => document.visibilityState === "visible" && void syncNow();
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    const interval = setInterval(() => hasLocalChanges() && void syncNow(), 60_000);
    return () => {
      unsub();
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [hydrated, user]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl bg-accent text-accent-ink">
          <Dumbbell className="h-8 w-8" />
        </div>
        <span className="text-sm font-semibold tracking-[0.3em] text-muted">GYMTRACK</span>
      </div>
    );
  }

  if (!onboarded && pathname !== "/login") return <Onboarding />;

  const showNav = pathname !== "/login";

  return (
    <>
      <main
        key={pathname}
        className="mx-auto min-h-dvh max-w-lg animate-fade-up px-4 pb-nav"
        style={floating ? { paddingBottom: "calc(env(safe-area-inset-bottom) + 176px)" } : undefined}
      >
        {children}
      </main>
      {showNav && pathname !== "/workout" && <ActiveWorkoutBar />}
      <RestTimer />
      {showNav && <BottomNav />}
    </>
  );
}
