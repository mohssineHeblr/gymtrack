"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button, Chip, Input, Sheet } from "./ui";
import { useExercises } from "@/lib/store";
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

export function filterExercises(list: Exercise[], query: string, group: MuscleGroup | "All", equipment?: string) {
  const q = query.trim().toLowerCase();
  return list.filter(
    (e) =>
      (group === "All" || e.muscleGroup === group) &&
      (!equipment || equipment === "All" || e.equipment === equipment) &&
      (!q || e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)),
  );
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
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-bold",
                    isSel ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
                  )}
                >
                  {isSel ? <Check className="h-5 w-5" /> : e.name.slice(0, 2).toUpperCase()}
                </div>
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
