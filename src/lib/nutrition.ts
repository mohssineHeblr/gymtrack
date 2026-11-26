import type { Food, FoodCategory, Macros, MealItem, MealRecord, MealType, NutritionLog } from "./types";
import { uuid } from "./utils";

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Nutrition for `grams` of a food given its per-100 g values. */
export function macrosFor(per100: Macros, grams: number): Macros {
  const f = Math.max(0, grams) / 100;
  return {
    calories: Math.round(per100.calories * f),
    protein: r1(per100.protein * f),
    carbs: r1(per100.carbs * f),
    fat: r1(per100.fat * f),
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { ...ZERO },
  );
}

export function roundMacros(m: Macros): Macros {
  return { calories: Math.round(m.calories), protein: r1(m.protein), carbs: r1(m.carbs), fat: r1(m.fat) };
}

export const mealTotals = (m: MealRecord) => sumMacros(m.items.map((i) => i.macros));

export function dayTotals(meals: MealRecord[], date: string): Macros {
  return roundMacros(sumMacros(meals.filter((m) => m.date === date).map(mealTotals)));
}

export function itemFromFood(food: Food, grams: number): MealItem {
  return {
    id: uuid(),
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    grams,
    per100: food.per100,
    macros: macrosFor(food.per100, grams),
  };
}

/** Change the quantity of an item, recalculating its macros. Fixed portions scale proportionally. */
export function withGrams(item: MealItem, grams: number): MealItem {
  if (item.per100) return { ...item, grams, macros: macrosFor(item.per100, grams) };
  return item;
}

/** Convert v1 flat nutrition logs into meal records (one "Snacks" meal per day). */
export function legacyNutritionToMeals(logs: NutritionLog[]): MealRecord[] {
  const byKey = new Map<string, MealRecord>();
  for (const n of logs) {
    const type: MealType = "snacks";
    const key = `${n.date}|${type}`;
    let meal = byKey.get(key);
    if (!meal) {
      meal = { id: uuid(), date: n.date, type, items: [], updatedAt: n.updatedAt };
      byKey.set(key, meal);
    }
    meal.items.push({
      id: n.id,
      foodId: null,
      name: n.name,
      grams: null,
      per100: null,
      macros: { calories: n.calories, protein: n.protein, carbs: n.carbs, fat: n.fat },
    });
    if (n.updatedAt > meal.updatedAt) meal.updatedAt = n.updatedAt;
  }
  return [...byKey.values()];
}

export function searchFoods(list: Food[], query: string, category?: FoodCategory | "All") {
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  return list
    .filter((f) => !category || category === "All" || f.category === category)
    .filter((f) => {
      if (!words.length) return true;
      const hay = `${f.name} ${f.brand ?? ""} ${f.category}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => {
      if (!q) return a.name.localeCompare(b.name);
      const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || a.name.length - b.name.length;
    });
}

// ---------------------------------------------------------------------------
// Open Food Facts (https://world.openfoodfacts.org) — open, crowd-sourced database.
// Only the search text is sent; no personal data.
// ---------------------------------------------------------------------------

const OFF_SEARCH = "https://search.openfoodfacts.org/search";

interface OffHit {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string[] | string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const n = (v: unknown) => {
  const x = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? x : null;
};

export function offHitToFood(h: OffHit): Food | null {
  const name = (h.product_name_en || h.product_name || "").trim();
  const nu = h.nutriments ?? {};
  let kcal = n(nu["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = n(nu["energy-kj_100g"] ?? nu["energy_100g"]);
    if (kj != null) kcal = kj / 4.184;
  }
  const protein = n(nu["proteins_100g"]);
  const carbs = n(nu["carbohydrates_100g"]);
  const fat = n(nu["fat_100g"]);
  if (!name || kcal == null || (protein == null && carbs == null && fat == null)) return null;
  const brandsRaw = Array.isArray(h.brands) ? h.brands : h.brands ? String(h.brands).split(",") : [];
  const brand = brandsRaw
    .map((b) => b.replace(/^[a-z]{2}:/, "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const serving = n(h.serving_quantity);
  return {
    id: `off-${h.code ?? name.toLowerCase().replace(/\W+/g, "-")}`,
    name,
    brand: brand || undefined,
    category: "Other",
    per100: { calories: Math.round(kcal), protein: r1(protein ?? 0), carbs: r1(carbs ?? 0), fat: r1(fat ?? 0) },
    servingGrams: serving && serving > 0 && serving < 2000 ? Math.round(serving) : null,
    source: "off",
    barcode: h.code,
  };
}

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${OFF_SEARCH}?q=${encodeURIComponent(q)}&page_size=25&fields=code,product_name,product_name_en,brands,serving_quantity,nutriments`;
  // Give up after 12 s so the UI can show an error instead of spinning forever
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timed out")), 12_000);
  signal?.addEventListener("abort", () => ctrl.abort(signal.reason), { once: true });
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(ctrl.signal.aborted ? "request timed out" : "network error");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const json = (await res.json()) as { hits?: OffHit[] };
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const h of json.hits ?? []) {
    const f = offHitToFood(h);
    if (!f || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}
