"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Dumbbell, Sparkles, WifiOff } from "lucide-react";
import { useGym } from "@/lib/store";
import { generateSampleData } from "@/lib/sample-data";
import { Button, Field, Input, Segmented } from "./ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Units } from "@/lib/types";

export function Onboarding() {
  const [name, setName] = useState("");
  const [units, setUnits] = useState<Units>("kg");
  const completeOnboarding = useGym((s) => s.completeOnboarding);
  const replaceData = useGym((s) => s.replaceData);

  const start = (withSample: boolean) => {
    if (withSample) replaceData(generateSampleData());
    completeOnboarding(name.trim() || "Athlete", units);
  };

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col px-6 pb-[max(env(safe-area-inset-bottom),24px)]">
      <div className="flex-1 animate-fade-up">
        <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-ink shadow-[0_12px_40px_-8px_var(--accent)]">
          <Dumbbell className="h-8 w-8" strokeWidth={2.4} />
        </div>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight">
          Train smarter.
          <br />
          <span className="text-accent">Track everything.</span>
        </h1>
        <p className="mt-3 text-muted">Your personal gym companion — workouts, programs, progress and nutrition in one place.</p>

        <div className="mt-6 grid gap-2.5">
          {[
            { icon: Sparkles, text: "Ready-made PPL, Upper/Lower, Full Body & Arnold programs" },
            { icon: BarChart3, text: "Strength, volume and body progress charts" },
            { icon: WifiOff, text: "Works offline — your data is saved on this device" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm">
              <Icon className="h-5 w-5 shrink-0 text-accent" />
              {text}
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          <Field label="What should we call you?">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="given-name" />
          </Field>
          <Field label="Preferred units" group>
            <Segmented value={units} onChange={setUnits} options={[{ value: "kg", label: "Kilograms (kg)" }, { value: "lbs", label: "Pounds (lbs)" }]} />
          </Field>
        </div>
      </div>

      <div className="mt-8 space-y-2.5">
        <Button size="lg" className="w-full" onClick={() => start(false)}>
          Get started
        </Button>
        <Button size="lg" variant="secondary" className="w-full" onClick={() => start(true)}>
          Explore with sample data
        </Button>
        {isSupabaseConfigured && (
          <Link href="/login" className="block py-2 text-center text-sm font-semibold text-muted">
            Already have an account? <span className="text-accent">Sign in</span>
          </Link>
        )}
      </div>
    </div>
  );
}
