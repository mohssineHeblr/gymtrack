"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Settings2, Trash2, Utensils } from "lucide-react";
import { Button, Card, EmptyState, Field, IconButton, Input, PageHeader, ProgressBar, Ring, SectionTitle, Sheet } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { useGym } from "@/lib/store";
import { addDays, cn, formatDate, fromDateKey, parseNum, toDateKey } from "@/lib/utils";
import type { NutritionGoals } from "@/lib/types";

const QUICK_FOODS: [string, number, number, number, number][] = [
  ["Chicken breast (150g)", 248, 46, 0, 5],
  ["White rice (200g cooked)", 260, 5, 57, 1],
  ["Eggs (3 large)", 216, 19, 1, 15],
  ["Whey protein scoop", 120, 24, 3, 2],
  ["Oats (80g)", 300, 11, 54, 6],
  ["Banana", 105, 1, 27, 0],
  ["Greek yogurt (200g)", 146, 20, 8, 4],
  ["Salmon fillet (150g)", 312, 31, 0, 20],
  ["Avocado (half)", 120, 1, 6, 11],
  ["Peanut butter (2 tbsp)", 190, 8, 7, 16],
];

const MACROS = [
  { key: "protein", label: "Protein", color: "var(--accent)" },
  { key: "carbs", label: "Carbs", color: "var(--info)" },
  { key: "fat", label: "Fat", color: "var(--warn)" },
] as const;

export default function NutritionPage() {
  const nutrition = useGym((s) => s.nutrition);
  const goals = useGym((s) => s.profile.nutritionGoals);
  const deleteFood = useGym((s) => s.deleteFood);
  const [date, setDate] = useState(toDateKey());
  const [addOpen, setAddOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const entries = nutrition.filter((n) => n.date === date);
  const totals = entries.reduce(
    (a, n) => ({ calories: a.calories + n.calories, protein: a.protein + n.protein, carbs: a.carbs + n.carbs, fat: a.fat + n.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const remaining = goals.calories - totals.calories;
  const isToday = date === toDateKey();

  const week = useMemo(() => {
    const end = fromDateKey(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(end, i - 6);
      const key = toDateKey(d);
      return {
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        calories: Math.round(nutrition.filter((n) => n.date === key).reduce((a, n) => a + n.calories, 0)),
        current: key === date,
      };
    });
  }, [nutrition, date]);

  return (
    <div>
      <PageHeader
        title="Nutrition"
        back
        action={
          <IconButton label="Nutrition goals" onClick={() => setGoalsOpen(true)}>
            <Settings2 className="h-5 w-5" />
          </IconButton>
        }
      />

      <div className="flex items-center justify-between rounded-2xl bg-surface p-1.5">
        <IconButton label="Previous day" className="bg-transparent" onClick={() => setDate(toDateKey(addDays(fromDateKey(date), -1)))}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <button className="text-sm font-semibold" onClick={() => setDate(toDateKey())}>
          {isToday ? "Today" : formatDate(date, { weekday: "long", month: "short", day: "numeric" })}
        </button>
        <IconButton label="Next day" className="bg-transparent" disabled={isToday} onClick={() => setDate(toDateKey(addDays(fromDateKey(date), 1)))}>
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>

      <Card className="mt-3 flex items-center gap-5 p-5">
        <Ring value={totals.calories} max={goals.calories} size={128} stroke={12} color={remaining < 0 ? "var(--danger)" : "var(--accent)"}>
          <div className="text-2xl font-bold tabular-nums">{Math.round(totals.calories)}</div>
          <div className="text-[11px] text-muted">of {goals.calories} kcal</div>
        </Ring>
        <div className="flex-1 space-y-3">
          {MACROS.map((m) => (
            <div key={m.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold">{m.label}</span>
                <span className="tabular-nums text-muted">
                  {Math.round(totals[m.key])}/{goals[m.key]}g
                </span>
              </div>
              <ProgressBar value={totals[m.key]} max={goals[m.key]} color={m.color} />
            </div>
          ))}
        </div>
      </Card>
      <p className={cn("mt-2 text-center text-sm", remaining < 0 ? "text-danger" : "text-muted")}>
        {remaining >= 0 ? `${Math.round(remaining)} kcal remaining` : `${Math.round(-remaining)} kcal over goal`}
      </p>

      <Button size="lg" className="mt-3 w-full" icon={<Plus className="h-5 w-5" />} onClick={() => setAddOpen(true)}>
        Log food
      </Button>

      <SectionTitle>Meals</SectionTitle>
      {entries.length ? (
        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          {entries.map((n, i) => (
            <div key={n.id} className={cn("flex items-center gap-3 px-4 py-3", i && "border-t border-line")}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{n.name}</div>
                <div className="text-xs text-muted">
                  P {n.protein}g · C {n.carbs}g · F {n.fat}g
                </div>
              </div>
              <div className="font-bold tabular-nums">{Math.round(n.calories)}</div>
              <IconButton label="Delete" className="h-8 w-8 text-danger" onClick={() => deleteFood(n.id)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Utensils className="h-6 w-6" />} title="Nothing logged" description="Add meals to track calories and macros." />
      )}

      <SectionTitle>Last 7 days</SectionTitle>
      <Card>
        <BarsChart data={week} x="label" y="calories" unit="kcal" highlightKey="current" height={160} />
        <p className="mt-1 text-xs text-muted">
          Daily average: {Math.round(week.reduce((a, d) => a + d.calories, 0) / Math.max(1, week.filter((d) => d.calories > 0).length))} kcal
        </p>
      </Card>

      <AddFoodSheet open={addOpen} onClose={() => setAddOpen(false)} date={date} />
      <GoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} />
    </div>
  );
}

function AddFoodSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const addFood = useGym((s) => s.addFood);
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  const reset = () => {
    setName("");
    setCal("");
    setP("");
    setC("");
    setF("");
  };

  const estimated = (parseNum(p) ?? 0) * 4 + (parseNum(c) ?? 0) * 4 + (parseNum(f) ?? 0) * 9;

  const save = () => {
    const calories = parseNum(cal) ?? Math.round(estimated);
    if (!name.trim() || !calories) return;
    addFood({ date, name: name.trim(), calories, protein: parseNum(p) ?? 0, carbs: parseNum(c) ?? 0, fat: parseNum(f) ?? 0 });
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Log food">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Food">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken wrap" required />
        </Field>
        <div className="grid grid-cols-4 gap-2">
          <Field label="kcal">
            <Input inputMode="decimal" value={cal} placeholder={estimated ? String(Math.round(estimated)) : "0"} onChange={(e) => setCal(e.target.value)} className="px-2 text-center" />
          </Field>
          <Field label="Protein">
            <Input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} placeholder="g" className="px-2 text-center" />
          </Field>
          <Field label="Carbs">
            <Input inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} placeholder="g" className="px-2 text-center" />
          </Field>
          <Field label="Fat">
            <Input inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} placeholder="g" className="px-2 text-center" />
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || !(parseNum(cal) || estimated)}>
          Add
        </Button>
      </form>

      <SectionTitle>Quick add</SectionTitle>
      <div className="overflow-hidden rounded-2xl border border-line">
        {QUICK_FOODS.map(([n, kcal, pr, cb, ft], i) => (
          <button
            key={n}
            onClick={() => {
              addFood({ date, name: n, calories: kcal, protein: pr, carbs: cb, fat: ft });
              onClose();
            }}
            className={cn("tap flex w-full items-center justify-between px-4 py-3 text-left", i && "border-t border-line")}
          >
            <div>
              <div className="text-sm font-semibold">{n}</div>
              <div className="text-xs text-muted">
                P {pr} · C {cb} · F {ft}
              </div>
            </div>
            <span className="flex items-center gap-2 text-sm font-bold">
              {kcal} <Plus className="h-4 w-4 text-accent" />
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function GoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const goals = useGym((s) => s.profile.nutritionGoals);
  const updateProfile = useGym((s) => s.updateProfile);
  const [draft, setDraft] = useState<Record<keyof NutritionGoals, string>>({
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
  });
  const save = () => {
    updateProfile({
      nutritionGoals: {
        calories: parseNum(draft.calories) ?? goals.calories,
        protein: parseNum(draft.protein) ?? goals.protein,
        carbs: parseNum(draft.carbs) ?? goals.carbs,
        fat: parseNum(draft.fat) ?? goals.fat,
      },
    });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Daily goals" footer={<Button size="lg" className="w-full" onClick={save}>Save goals</Button>}>
      <div className="grid grid-cols-2 gap-3">
        {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
          <Field key={k} label={k === "calories" ? "Calories (kcal)" : `${k[0].toUpperCase()}${k.slice(1)} (g)`}>
            <Input inputMode="numeric" value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Macros add up to {Math.round((parseNum(draft.protein) ?? 0) * 4 + (parseNum(draft.carbs) ?? 0) * 4 + (parseNum(draft.fat) ?? 0) * 9)} kcal.
      </p>
    </Sheet>
  );
}
