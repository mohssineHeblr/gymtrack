"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button, Chip, Input, Sheet } from "./ui";
import { useExercises } from "@/lib/store";
import { ExerciseThumb } from "./ExerciseThumb";
import { MUSCLE_GROUPS, type Difficulty, type Exercise, type ExerciseType, type MuscleGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ExerciseFilters {
  group: MuscleGroup | "All";
  equipment: string;
  type: ExerciseType | "All";
  difficulty: Difficulty | "All";
}

export function filterExercises(list: Exercise[], query: string, filters: Partial<ExerciseFilters> | MuscleGroup | "All") {
  const f: Partial<ExerciseFilters> = typeof filters === "string" ? { group: filters } : filters;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((e) => {
    if (f.group && f.group !== "All" && e.muscleGroup !== f.group) return false;
    if (f.equipment && f.equipment !== "All" && e.equipment !== f.equipment) return false;
    if (f.type && f.type !== "All" && e.type !== f.type) return false;
    if (f.difficulty && f.difficulty !== "All" && e.difficulty !== f.difficulty) return false;
    if (!words.length) return true;
    const hay = [e.name, e.muscleGroup, e.equipment, ...(e.primaryMuscles ?? []), ...(e.secondaryMuscles ?? [])].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  multi = true,
  title = "Add exercises",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  multi?: boolean;
  title?: string;
}) {
  const all = useExercises();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "All">("All");
  const [selected, setSelected] = useState<string[]>([]);
  const list = useMemo(() => filterExercises(all, query, group), [all, query, group]);

  const close = () => {
    setSelected([]);
    setQuery("");
    onClose();
  };

  const toggle = (id: string) => {
    if (!multi) {
      onPick([id]);
      close();
      return;
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      full
      footer={
        multi ? (
          <Button
            className="w-full"
            size="lg"
            disabled={!selected.length}
            onClick={() => {
              onPick(selected);
              close();
            }}
          >
            Add {selected.length || ""} exercise{selected.length === 1 ? "" : "s"}
          </Button>
        ) : undefined
      }
    >
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" className="pl-10" />
        </div>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {(["All", ...MUSCLE_GROUPS] as const).map((g) => (
            <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {list.map((e) => {
          const isSel = selected.includes(e.id);
          return (
            <li key={e.id}>
              <button onClick={() => toggle(e.id)} className="tap flex w-full items-center gap-3 py-3 text-left">
                {isSel ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink">
                    <Check className="h-5 w-5" />
                  </div>
                ) : (
                  <ExerciseThumb exercise={e} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{e.name}</div>
                  <div className="text-xs text-muted">
                    {e.muscleGroup} · {e.equipment}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="py-10 text-center text-sm text-muted">No exercises match your search.</li>}
      </ul>
    </Sheet>
  );
}
