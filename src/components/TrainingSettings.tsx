"use client";

import { Check } from "lucide-react";
import { Chip, Field, Toggle } from "./ui";
import { useGym } from "@/lib/store";
import { EQUIPMENT_PRESETS, SPLIT_LABEL } from "@/lib/generator";
import { EQUIPMENT, type Equipment, type FitnessGoal, type SplitFocus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const DURATIONS = [30, 45, 60, 75, 90];
const SPLITS: SplitFocus[] = ["auto", "push", "pull", "legs", "upper", "lower", "full"];
const GOALS: { value: FitnessGoal; label: string }[] = [
  { value: "build_muscle", label: "Muscle" },
  { value: "strength", label: "Strength" },
  { value: "lose_fat", label: "Fat loss" },
  { value: "endurance", label: "Endurance" },
  { value: "maintain", label: "Stay fit" },
];

const sameSet = (a: Equipment[], b: Equipment[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Equipment + smart-workout preferences. Changes apply immediately. */
export function TrainingSettings({ compact = false, hideGoal = false }: { compact?: boolean; hideGoal?: boolean }) {
  const profile = useGym((s) => s.profile);
  const updateProfile = useGym((s) => s.updateProfile);
  const smart = profile.smart;
  const setSmart = (patch: Partial<typeof smart>) => updateProfile({ smart: { ...smart, ...patch } });

  const toggleEq = (e: Equipment) => {
    const has = profile.equipment.includes(e);
    const next = has ? profile.equipment.filter((x) => x !== e) : [...profile.equipment, e];
    if (next.length) updateProfile({ equipment: next });
  };

  return (
    <div className="space-y-5">
      {!hideGoal && (
        <Field label="Goal" group>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <Chip key={g.value} active={profile.fitnessGoal === g.value} onClick={() => updateProfile({ fitnessGoal: g.value })}>
                {g.label}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label="Workout length" group>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <Chip key={d} active={smart.duration === d} onClick={() => setSmart({ duration: d })} className="flex-1 px-0 text-center">
              {d}m
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Focus" group>
        <div className="flex flex-wrap gap-2">
          {SPLITS.map((s) => (
            <Chip key={s} active={smart.split === s} onClick={() => setSmart({ split: s })}>
              {s === "auto" ? "Auto (recovery)" : SPLIT_LABEL[s]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Equipment" group>
        <div className="grid gap-2">
          {EQUIPMENT_PRESETS.map((p) => {
            const active = sameSet(profile.equipment, p.equipment);
            return (
              <button
                key={p.id}
                onClick={() => updateProfile({ equipment: [...p.equipment] })}
                className={cn("tap flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left", active ? "border-accent bg-accent-soft" : "border-line bg-surface-2")}
                aria-pressed={active}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-muted">{p.description}</div>
                </div>
                {active && <Check className="h-4 w-4 text-accent" />}
              </button>
            );
          })}
        </div>
        {!compact && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EQUIPMENT.map((e) => (
              <Chip key={e} active={profile.equipment.includes(e)} onClick={() => toggleEq(e)}>
                {e}
              </Chip>
            ))}
          </div>
        )}
      </Field>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Warm-up sets</div>
          <div className="text-xs text-muted">Add 2 ramp-up sets before your first big lift</div>
        </div>
        <Toggle checked={smart.warmups} onChange={(v) => setSmart({ warmups: v })} label="Warm-up sets" />
      </div>
    </div>
  );
}
