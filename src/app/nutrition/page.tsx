"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
  Utensils,
  WifiOff,
} from "lucide-react";
import { Button, Card, Chip, EmptyState, Field, IconButton, Input, PageHeader, ProgressBar, Ring, SectionTitle, Select, Sheet, Spinner } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { useFoods, useGym } from "@/lib/store";
import { useOnline } from "@/lib/hooks";
import { dayTotals, itemFromFood, macrosFor, mealTotals, roundMacros, searchFoods, searchOpenFoodFacts, sumMacros } from "@/lib/nutrition";
import { addDays, cn, formatDate, fromDateKey, parseNum, toDateKey } from "@/lib/utils";
import {
  FOOD_CATEGORIES,
  MEAL_LABEL,
  MEAL_TYPES,
  type Food,
  type FoodCategory,
  type Macros,
  type MealItem,
  type MealRecord,
  type MealType,
  type NutritionGoals,
} from "@/lib/types";

const MACROS = [
  { key: "protein", label: "Protein", color: "var(--accent)" },
  { key: "carbs", label: "Carbs", color: "var(--info)" },
  { key: "fat", label: "Fat", color: "var(--warn)" },
] as const;

const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

export default function NutritionPage() {
  const meals = useGym((s) => s.meals);
  const goals = useGym((s) => s.profile.nutritionGoals);
  const [date, setDate] = useState(toDateKey());
  const [addFor, setAddFor] = useState<MealType | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ meal: MealRecord; item: MealItem } | null>(null);

  const totals = dayTotals(meals, date);
  const remaining = goals.calories - totals.calories;
  const isToday = date === toDateKey();

  const week = useMemo(() => {
    const end = fromDateKey(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(end, i - 6);
      const key = toDateKey(d);
      return {
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        calories: Math.round(dayTotals(meals, key).calories),
        current: key === date,
      };
    });
  }, [meals, date]);

  const dayMeals = MEAL_TYPES.map((type) => ({ type, meal: meals.find((m) => m.date === date && m.type === type) ?? null }));
  const loggedDays = week.filter((d) => d.calories > 0);

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

      {/* Daily dashboard */}
      <Card className="mt-3 p-5">
        <div className="flex items-center gap-5">
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
                    {fmt(totals[m.key])}/{goals[m.key]}g
                  </span>
                </div>
                <ProgressBar value={totals[m.key]} max={goals[m.key]} color={m.color} />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center" aria-label="Remaining today">
          {([
            ["kcal", goals.calories - totals.calories],
            ["Protein", goals.protein - totals.protein],
            ["Carbs", goals.carbs - totals.carbs],
            ["Fat", goals.fat - totals.fat],
          ] as const).map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-surface-2 px-1 py-2">
              <div className={cn("text-[15px] font-bold tabular-nums", v < 0 && "text-danger")}>
                {v < 0 ? "+" : ""}
                {fmt(Math.abs(v))}
                {l === "kcal" ? "" : "g"}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{v < 0 ? `${l} over` : `${l} left`}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Meals */}
      <div className="mt-2 space-y-3">
        {dayMeals.map(({ type, meal }) => (
          <MealCard key={type} type={type} meal={meal} date={date} onAdd={() => setAddFor(type)} onEdit={(item) => meal && setEditItem({ meal, item })} />
        ))}
      </div>

      <SectionTitle>Last 7 days</SectionTitle>
      <Card>
        <BarsChart data={week} x="label" y="calories" unit="kcal" highlightKey="current" height={160} />
        <p className="mt-1 text-xs text-muted">
          Daily average: {Math.round(week.reduce((a, d) => a + d.calories, 0) / Math.max(1, loggedDays.length))} kcal · goal {goals.calories} kcal
        </p>
      </Card>

      <AddFoodSheet mealType={addFor} date={date} onClose={() => setAddFor(null)} />
      <EditItemSheet value={editItem} onClose={() => setEditItem(null)} />
      <GoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meal card
// ---------------------------------------------------------------------------
function MealCard({ type, meal, date, onAdd, onEdit }: { type: MealType; meal: MealRecord | null; date: string; onAdd: () => void; onEdit: (i: MealItem) => void }) {
  const [menu, setMenu] = useState(false);
  const totals = meal ? roundMacros(mealTotals(meal)) : null;
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface" aria-label={MEAL_LABEL[type]}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">{MEAL_LABEL[type]}</h2>
          <div className="text-xs text-muted">
            {totals ? `${totals.calories} kcal · P ${fmt(totals.protein)} · C ${fmt(totals.carbs)} · F ${fmt(totals.fat)}` : "Nothing logged"}
          </div>
        </div>
        <IconButton label={`${MEAL_LABEL[type]} options`} className="h-9 w-9" onClick={() => setMenu(true)}>
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
        <IconButton label={`Add food to ${MEAL_LABEL[type]}`} className="h-9 w-9 bg-accent text-accent-ink" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>
      {meal?.items.map((it) => (
        <button key={it.id} onClick={() => onEdit(it)} className="tap flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{it.name}</div>
            <div className="truncate text-xs text-muted">
              {it.grams != null ? `${fmt(it.grams)} g · ` : ""}
              P {fmt(it.macros.protein)} · C {fmt(it.macros.carbs)} · F {fmt(it.macros.fat)}
              {it.brand ? ` · ${it.brand}` : ""}
            </div>
          </div>
          <div className="text-sm font-bold tabular-nums">{Math.round(it.macros.calories)}</div>
        </button>
      ))}
      <MealMenu open={menu} onClose={() => setMenu(false)} type={type} meal={meal} date={date} />
    </section>
  );
}

function MealMenu({ open, onClose, type, meal, date }: { open: boolean; onClose: () => void; type: MealType; meal: MealRecord | null; date: string }) {
  const meals = useGym((s) => s.meals);
  const copyMeal = useGym((s) => s.copyMeal);
  const clearMeal = useGym((s) => s.clearMeal);
  const saveMealTemplate = useGym((s) => s.saveMealTemplate);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  const previous = useMemo(
    () =>
      meals
        .filter((m) => m.date < date && m.items.length)
        .sort((a, b) => b.date.localeCompare(a.date) || MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type))
        .slice(0, 24),
    [meals, date],
  );
  const sameType = previous.filter((m) => m.type === type);
  const others = previous.filter((m) => m.type !== type).slice(0, 8);

  const close = () => {
    setName("");
    setSaved(false);
    onClose();
  };

  const row = (m: MealRecord) => (
    <button
      key={m.id}
      onClick={() => {
        copyMeal(m.id, date, type);
        close();
      }}
      className="tap flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left first:border-t-0"
    >
      <Copy className="h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">
          {MEAL_LABEL[m.type]} · {formatDate(m.date, { weekday: "short", month: "short", day: "numeric" })}
        </div>
        <div className="truncate text-xs text-muted">{m.items.map((i) => i.name).join(", ")}</div>
      </div>
      <span className="text-sm font-bold tabular-nums">{Math.round(mealTotals(m).calories)}</span>
    </button>
  );

  return (
    <Sheet open={open} onClose={close} title={MEAL_LABEL[type]}>
      <div className="space-y-5">
        {meal && meal.items.length > 0 && (
          <div>
            <div className="mb-2 text-[13px] font-medium text-muted">Save this meal for later</div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveMealTemplate(name || `${MEAL_LABEL[type]} ${formatDate(date, { month: "short", day: "numeric" })}`, meal.items.map(({ id: _id, ...rest }) => rest));
                setSaved(true);
                setName("");
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name, e.g. Post-workout shake" />
              <Button type="submit" icon={<BookmarkPlus className="h-4 w-4" />}>
                Save
              </Button>
            </form>
            {saved && <p className="mt-1.5 text-xs text-accent">Saved — find it under “Meals” when adding food.</p>}
          </div>
        )}
        <div>
          <div className="mb-2 text-[13px] font-medium text-muted">Copy a previous {MEAL_LABEL[type].toLowerCase()}</div>
          {sameType.length ? (
            <div className="overflow-hidden rounded-2xl border border-line">{sameType.slice(0, 10).map(row)}</div>
          ) : (
            <p className="text-sm text-subtle">No earlier {MEAL_LABEL[type].toLowerCase()} logged yet.</p>
          )}
        </div>
        {others.length > 0 && (
          <div>
            <div className="mb-2 text-[13px] font-medium text-muted">Or copy another meal</div>
            <div className="overflow-hidden rounded-2xl border border-line">{others.map(row)}</div>
          </div>
        )}
        {meal && (
          <Button
            variant="danger"
            className="w-full"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              if (confirm(`Remove all foods from ${MEAL_LABEL[type]}?`)) {
                clearMeal(meal.id);
                close();
              }
            }}
          >
            Clear {MEAL_LABEL[type].toLowerCase()}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Add food
// ---------------------------------------------------------------------------
type Tab = "search" | "favorites" | "recent" | "mine" | "meals";
const TABS: { id: Tab; label: string }[] = [
  { id: "search", label: "Search" },
  { id: "favorites", label: "Favourites" },
  { id: "recent", label: "Frequent" },
  { id: "mine", label: "My foods" },
  { id: "meals", label: "Meals" },
];

function AddFoodSheet({ mealType, date, onClose }: { mealType: MealType | null; date: string; onClose: () => void }) {
  const foods = useFoods();
  const meals = useGym((s) => s.meals);
  const favorites = useGym((s) => s.profile.favoriteFoods);
  const savedMeals = useGym((s) => s.savedMeals);
  const addMealItems = useGym((s) => s.addMealItems);
  const deleteSavedMeal = useGym((s) => s.deleteSavedMeal);
  const online = useOnline();
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FoodCategory | "All">("All");
  const [picked, setPicked] = useState<Food | null>(null);
  const [custom, setCustom] = useState(false);
  const [quick, setQuick] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ q: string; foods: Food[]; loading: boolean; error: string | null }>({ q: "", foods: [], loading: false, error: null });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const open = mealType !== null;

  const local = useMemo(() => searchFoods(foods, query, category).slice(0, query ? 60 : 300), [foods, query, category]);

  // Debounced Open Food Facts search for branded products
  useEffect(() => {
    const q = query.trim();
    if (!open || tab !== "search" || q.length < 3 || !online) {
      setRemote((r) => (r.loading ? { ...r, loading: false } : r));
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setRemote({ q, foods: [], loading: true, error: null });
      searchOpenFoodFacts(q, ctrl.signal)
        .then((res) => setRemote({ q, foods: res, loading: false, error: null }))
        .catch((e) => {
          if (ctrl.signal.aborted) return;
          setRemote({ q, foods: [], loading: false, error: e instanceof Error ? e.message : "Search failed" });
        });
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open, tab, online]);

  const frequent = useMemo(() => {
    const counts = new Map<string, { n: number; item: MealItem }>();
    for (const m of meals)
      for (const it of m.items) {
        const key = it.foodId ?? `name:${it.name.toLowerCase()}`;
        const cur = counts.get(key);
        counts.set(key, { n: (cur?.n ?? 0) + 1, item: cur?.item ?? it });
      }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 25);
  }, [meals]);

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  const close = () => {
    setQuery("");
    setTab("search");
    setPicked(null);
    setCategory("All");
    onClose();
  };

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const favFoods = favorites.map((id) => foodById.get(id)).filter((f): f is Food => !!f);
  const myFoods = foods.filter((f) => f.source === "custom");
  const label = mealType ? MEAL_LABEL[mealType] : "";

  return (
    <Sheet
      open={open}
      onClose={close}
      title={`Add to ${label}`}
      full
      footer={
        <Button size="lg" className="w-full" onClick={close}>
          Done
        </Button>
      }
    >
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {TABS.map((t) => (
            <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
        {tab === "search" && (
          <>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods, e.g. chicken, oats, skyr" className="pl-10" aria-label="Search foods" />
            </div>
            <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
              {(["All", ...FOOD_CATEGORIES.filter((c) => c !== "Other")] as const).map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)} className="py-1 text-xs">
                  {c}
                </Chip>
              ))}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-[12dvh] z-[70] mx-auto w-fit animate-pop rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink shadow-xl" role="status">
          {toast}
        </div>
      )}

      {tab === "search" && (
        <div className="space-y-5">
          <FoodList foods={local} onPick={setPicked} empty={query ? "No matches in the built-in database." : "No foods in this category."} />
          {query.trim().length >= 3 && category === "All" && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-muted">
                <Globe className="h-3.5 w-3.5" /> Branded products · Open Food Facts
              </div>
              {!online ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <WifiOff className="h-4 w-4" /> Offline — online search unavailable. Built-in foods still work.
                </p>
              ) : remote.loading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted">
                  <Spinner className="h-4 w-4" /> Searching…
                </div>
              ) : remote.error ? (
                <p className="text-sm text-warn">Couldn&apos;t reach Open Food Facts ({remote.error}). Try again in a moment.</p>
              ) : remote.q === query.trim() ? (
                <FoodList foods={remote.foods} onPick={setPicked} empty="No branded products found." />
              ) : null}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setCustom(true)}>
              Create food
            </Button>
            <Button variant="secondary" icon={<Utensils className="h-4 w-4" />} onClick={() => setQuick(true)}>
              Quick add kcal
            </Button>
          </div>
        </div>
      )}

      {tab === "favorites" && (
        <FoodList foods={favFoods} onPick={setPicked} empty="Tap the ♥ on any food to save it here." />
      )}

      {tab === "recent" &&
        (frequent.length ? (
          <ul className="divide-y divide-line">
            {frequent.map(({ n, item }) => {
              const food = item.foodId ? foodById.get(item.foodId) : undefined;
              return (
                <li key={item.foodId ?? item.name}>
                  <button
                    onClick={() => {
                      if (food) setPicked(food);
                      else if (item.per100) setPicked({ id: item.foodId ?? `name-${item.name}`, name: item.name, brand: item.brand, category: "Other", per100: item.per100, servingGrams: item.grams, source: "custom" });
                      else {
                        const { id: _id, ...rest } = item;
                        addMealItems(date, mealType!, [rest]);
                        flash(`Added ${item.name}`);
                      }
                    }}
                    className="tap flex w-full items-center gap-3 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{item.name}</div>
                      <div className="text-xs text-muted">
                        logged {n}× · {item.grams != null ? `${fmt(item.grams)} g · ` : ""}
                        {Math.round(item.macros.calories)} kcal
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-accent" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Star className="h-6 w-6" />} title="Nothing yet" description="Foods you log often will show up here." />
        ))}

      {tab === "mine" && (
        <div className="space-y-4">
          <Button className="w-full" icon={<Plus className="h-4 w-4" />} onClick={() => setCustom(true)}>
            Create custom food
          </Button>
          <FoodList foods={myFoods} onPick={setPicked} empty="Foods you create appear here." />
        </div>
      )}

      {tab === "meals" &&
        (savedMeals.length ? (
          <div className="space-y-2">
            {savedMeals.map((sm) => {
              const t = roundMacros(sumMacros(sm.items.map((i) => i.macros)));
              return (
                <div key={sm.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <button
                    className="tap min-w-0 flex-1 text-left"
                    onClick={() => {
                      addMealItems(date, mealType!, sm.items);
                      flash(`Added ${sm.name}`);
                    }}
                  >
                    <div className="truncate font-semibold">{sm.name}</div>
                    <div className="truncate text-xs text-muted">
                      {t.calories} kcal · {sm.items.map((i) => i.name).join(", ")}
                    </div>
                  </button>
                  <IconButton label={`Delete ${sm.name}`} className="h-8 w-8 text-danger" onClick={() => confirm(`Delete "${sm.name}"?`) && deleteSavedMeal(sm.id)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<BookmarkPlus className="h-6 w-6" />}
            title="No saved meals"
            description="Log a meal, then use its ••• menu → Save to reuse it in one tap."
          />
        ))}

      <QuantitySheet
        food={picked}
        mealLabel={label}
        onClose={() => setPicked(null)}
        onAdd={(item) => {
          addMealItems(date, mealType!, [item]);
          setPicked(null);
          flash(`Added ${item.name}`);
        }}
      />
      <CustomFoodSheet
        open={custom}
        onClose={() => setCustom(false)}
        onCreated={(f) => {
          setCustom(false);
          setPicked(f);
        }}
      />
      <QuickAddSheet
        open={quick}
        onClose={() => setQuick(false)}
        onAdd={(item) => {
          addMealItems(date, mealType!, [item]);
          setQuick(false);
          flash(`Added ${item.name}`);
        }}
      />
    </Sheet>
  );
}

function FoodList({ foods, onPick, empty }: { foods: Food[]; onPick: (f: Food) => void; empty: string }) {
  if (!foods.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {foods.map((f) => (
        <li key={f.id}>
          <button onClick={() => onPick(f)} className="tap flex w-full items-center gap-3 py-3 text-left">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{f.name}</div>
              <div className="truncate text-xs text-muted">
                {f.brand ? `${f.brand} · ` : ""}
                {f.per100.calories} kcal · P {fmt(f.per100.protein)} · C {fmt(f.per100.carbs)} · F {fmt(f.per100.fat)} per 100 g
              </div>
            </div>
            <Plus className="h-4 w-4 shrink-0 text-accent" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function MacroPreview({ m }: { m: Macros }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center" aria-label="Calculated nutrition">
      {([
        ["kcal", m.calories, ""],
        ["Protein", m.protein, "g"],
        ["Carbs", m.carbs, "g"],
        ["Fat", m.fat, "g"],
      ] as const).map(([l, v, u]) => (
        <div key={l} className="rounded-2xl bg-surface-2 py-2.5">
          <div className="text-lg font-bold tabular-nums" data-testid={`calc-${l.toLowerCase()}`}>
            {fmt(v)}
            {u}
          </div>
          <div className="text-[11px] text-muted">{l}</div>
        </div>
      ))}
    </div>
  );
}

function QuantitySheet({ food, mealLabel, onClose, onAdd }: { food: Food | null; mealLabel: string; onClose: () => void; onAdd: (i: MealItem) => void }) {
  const favorites = useGym((s) => s.profile.favoriteFoods);
  const toggleFavoriteFood = useGym((s) => s.toggleFavoriteFood);
  const upsertFood = useGym((s) => s.upsertFood);
  const [grams, setGrams] = useState("100");

  useEffect(() => {
    if (food) setGrams(String(food.servingGrams ?? 100));
  }, [food]);

  if (!food) return null;
  const g = parseNum(grams) ?? 0;
  const macros = macrosFor(food.per100, g);
  const fav = favorites.includes(food.id);
  const chips = [...new Set([food.servingGrams ?? 0, 50, 100, 150, 200, 250].filter((x) => x > 0))];

  return (
    <Sheet open onClose={onClose} title={food.name}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-sm text-muted">
            {food.brand && <div className="font-medium text-fg">{food.brand}</div>}
            Per 100 g: {food.per100.calories} kcal · P {fmt(food.per100.protein)} · C {fmt(food.per100.carbs)} · F {fmt(food.per100.fat)}
            {food.source === "off" && <div className="mt-1 text-xs text-subtle">Data: Open Food Facts (community-maintained)</div>}
          </div>
          <IconButton label={fav ? "Remove from favourites" : "Add to favourites"} className={cn("h-10 w-10", fav && "text-danger")} onClick={() => toggleFavoriteFood(food)}>
            <Heart className="h-5 w-5" fill={fav ? "currentColor" : "none"} />
          </IconButton>
        </div>

        <Field label="Quantity (grams)">
          <Input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} aria-label="Quantity in grams" className="text-center text-xl font-bold" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Chip key={c} active={g === c} onClick={() => setGrams(String(c))}>
              {c === food.servingGrams && food.servingLabel ? `${food.servingLabel} (${c} g)` : `${c} g`}
            </Chip>
          ))}
        </div>

        <MacroPreview m={macros} />

        <Button
          size="lg"
          className="w-full"
          disabled={g <= 0}
          onClick={() => {
            if (food.source === "off") upsertFood(food);
            const item = itemFromFood(food, g);
            onAdd(item);
          }}
        >
          Add to {mealLabel}
        </Button>
      </div>
    </Sheet>
  );
}

function EditItemSheet({ value, onClose }: { value: { meal: MealRecord; item: MealItem } | null; onClose: () => void }) {
  const update = useGym((s) => s.updateMealItemGrams);
  const remove = useGym((s) => s.removeMealItem);
  const [grams, setGrams] = useState("");
  useEffect(() => {
    if (value) setGrams(value.item.grams != null ? String(value.item.grams) : "");
  }, [value]);
  if (!value) return null;
  const { meal, item } = value;
  const g = parseNum(grams) ?? 0;
  const preview = item.per100 ? macrosFor(item.per100, g) : item.macros;

  return (
    <Sheet open onClose={onClose} title={item.name}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {MEAL_LABEL[meal.type]} · {formatDate(meal.date, { weekday: "short", month: "short", day: "numeric" })}
        </p>
        {item.per100 ? (
          <Field label="Quantity (grams)">
            <Input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} aria-label="Quantity in grams" className="text-center text-xl font-bold" />
          </Field>
        ) : (
          <p className="rounded-2xl bg-surface-2 p-3 text-xs text-muted">Quick entry — logged as a fixed portion, so the quantity can&apos;t be changed.</p>
        )}
        <MacroPreview m={preview} />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              remove(meal.id, item.id);
              onClose();
            }}
          >
            Remove
          </Button>
          <Button
            disabled={!!item.per100 && g <= 0}
            onClick={() => {
              if (item.per100 && g > 0) update(meal.id, item.id, g);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function CustomFoodSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (f: Food) => void }) {
  const addCustomFood = useGym((s) => s.addCustomFood);
  const foods = useGym((s) => s.foods);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<FoodCategory>("Other");
  const [v, setV] = useState({ calories: "", protein: "", carbs: "", fat: "", serving: "" });
  const estimated = Math.round((parseNum(v.protein) ?? 0) * 4 + (parseNum(v.carbs) ?? 0) * 4 + (parseNum(v.fat) ?? 0) * 9);
  const calories = parseNum(v.calories) ?? estimated;
  const duplicate = foods.some((f) => f.source === "custom" && f.name.trim().toLowerCase() === name.trim().toLowerCase() && (f.brand ?? "") === brand.trim());

  const reset = () => {
    setName("");
    setBrand("");
    setCategory("Other");
    setV({ calories: "", protein: "", carbs: "", fat: "", serving: "" });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Create food">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || duplicate) return;
          const food: Omit<Food, "id" | "source" | "updatedAt"> = {
            name: name.trim(),
            brand: brand.trim() || undefined,
            category,
            per100: { calories, protein: parseNum(v.protein) ?? 0, carbs: parseNum(v.carbs) ?? 0, fat: parseNum(v.fat) ?? 0 },
            servingGrams: parseNum(v.serving),
          };
          const id = addCustomFood(food);
          reset();
          onCreated({ ...food, id, source: "custom" });
        }}
      >
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mum's lasagne" required />
        </Field>
        {duplicate && <p className="-mt-2 text-xs text-warn">You already have a custom food with this name.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand (optional)">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)}>
              {FOOD_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="text-[13px] font-medium text-muted">Nutrition per 100 g</div>
        <div className="grid grid-cols-4 gap-2">
          {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
            <Field key={k} label={k === "calories" ? "kcal" : k[0].toUpperCase() + k.slice(1)}>
              <Input
                inputMode="decimal"
                value={v[k]}
                placeholder={k === "calories" && estimated ? String(estimated) : "0"}
                onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))}
                className="px-2 text-center"
                aria-label={`${k} per 100 g`}
              />
            </Field>
          ))}
        </div>
        <Field label="Typical serving (g, optional)">
          <Input inputMode="decimal" value={v.serving} onChange={(e) => setV((x) => ({ ...x, serving: e.target.value }))} placeholder="e.g. 250" />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || duplicate || calories <= 0}>
          Save food
        </Button>
      </form>
    </Sheet>
  );
}

function QuickAddSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (i: MealItem) => void }) {
  const [name, setName] = useState("");
  const [v, setV] = useState({ calories: "", protein: "", carbs: "", fat: "" });
  const estimated = Math.round((parseNum(v.protein) ?? 0) * 4 + (parseNum(v.carbs) ?? 0) * 4 + (parseNum(v.fat) ?? 0) * 9);
  const calories = parseNum(v.calories) ?? estimated;
  return (
    <Sheet open={open} onClose={onClose} title="Quick add">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (calories <= 0) return;
          onAdd({
            id: "",
            foodId: null,
            name: name.trim() || "Quick add",
            grams: null,
            per100: null,
            macros: { calories, protein: parseNum(v.protein) ?? 0, carbs: parseNum(v.carbs) ?? 0, fat: parseNum(v.fat) ?? 0 },
          });
          setName("");
          setV({ calories: "", protein: "", carbs: "", fat: "" });
        }}
      >
        <Field label="Description">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Restaurant dinner" />
        </Field>
        <div className="grid grid-cols-4 gap-2">
          {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
            <Field key={k} label={k === "calories" ? "kcal" : k[0].toUpperCase() + k.slice(1)}>
              <Input
                inputMode="decimal"
                value={v[k]}
                placeholder={k === "calories" && estimated ? String(estimated) : k === "calories" ? "0" : "g"}
                onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))}
                className="px-2 text-center"
              />
            </Field>
          ))}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={calories <= 0}>
          Add
        </Button>
      </form>
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
  useEffect(() => {
    if (open) setDraft({ calories: String(goals.calories), protein: String(goals.protein), carbs: String(goals.carbs), fat: String(goals.fat) });
  }, [open, goals]);
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
    <Sheet open={open} onClose={onClose} title="Daily targets" footer={<Button size="lg" className="w-full" onClick={save}>Save targets</Button>}>
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
