"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Dumbbell, Sparkles, WifiOff } from "lucide-react";
import { useGym } from "@/lib/store";
import { generateSampleData } from "@/lib/sample-data";
import { Button, Chip, Field, Input, Segmented } from "./ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { FitnessGoal, Units } from "@/lib/types";
import { EQUIPMENT_PRESETS } from "@/lib/generator";

export function Onboarding() {
  const [name, setName] = useState("");
  const [units, setUnits] = useState<Units>("kg");
  const [goal, setGoal] = useState<FitnessGoal>("build_muscle");
  const [equipment, setEquipment] = useState(EQUIPMENT_PRESETS[0].id);
  const updateProfile = useGym((s) => s.updateProfile);
  const completeOnboarding = useGym((s) => s.completeOnboarding);
  const replaceData = useGym((s) => s.replaceData);

  const start = (withSample: boolean) => {
    if (withSample) replaceData(generateSampleData());
    completeOnboarding(name.trim() || "Athlete", units);
    updateProfile({ fitnessGoal: goal, equipment: [...(EQUIPMENT_PRESETS.find((p) => p.id === equipment) ?? EQUIPMENT_PRESETS[0]).equipment] });
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
            { icon: Sparkles, text: "Smart workouts built from your recovery, goal & equipment" },
            { icon: BarChart3, text: "Auto progressive overload, programs & progress charts" },
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
          <Field label="Main goal" group>
            <div className="flex flex-wrap gap-2">
              {([
                ["build_muscle", "Build muscle"],
                ["strength", "Get stronger"],
                ["lose_fat", "Lose fat"],
                ["endurance", "Endurance"],
                ["maintain", "Stay fit"],
              ] as [FitnessGoal, string][]).map(([v, l]) => (
                <Chip key={v} active={goal === v} onClick={() => setGoal(v)}>
                  {l}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Where do you train?" group>
            <Segmented value={equipment} onChange={setEquipment} options={EQUIPMENT_PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
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
