// Generates supabase/schema.sql = base schema + migrations + seed data (exercises, foods).
// Run with: npm run seed:sql   (Node 22.6+ strips TypeScript types natively)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_EXERCISES } from "../src/data/exercises.ts";
import { FOOD_DATABASE } from "../src/data/foods.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exercises = DEFAULT_EXERCISES;

const q = (s: string | null | undefined) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);
const arr = (a: string[] = []) => `ARRAY[${a.map((x) => q(x)).join(", ")}]::text[]`;

const exerciseSeed = exercises
  .map(
    (e) =>
      `  (${q(e.id)}, null, ${q(e.name)}, ${q(e.muscleGroup)}, ${q(e.equipment)}, ${q(e.description)}, ${arr(e.instructions)}, ${e.recommendedSets}, ${q(e.recommendedReps)}, false, ${q(e.difficulty ?? "intermediate")}, ${q(e.type ?? "isolation")}, ${arr(e.primaryMuscles)}, ${arr(e.secondaryMuscles)})`,
  )
  .join(",\n");

const foodSeed = FOOD_DATABASE.map(
  (f) =>
    `  (${q(f.id)}, null, ${q(f.name)}, ${q(f.category)}, ${f.per100.calories}, ${f.per100.protein}, ${f.per100.carbs}, ${f.per100.fat}, ${f.servingGrams ?? "null"}, ${q(f.servingLabel ?? null)}, 'builtin')`,
).join(",\n");

const base = readFileSync(join(root, "supabase/schema.base.sql"), "utf8");
const migrationsDir = join(root, "supabase/migrations");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => `\n-- =============================================================================\n-- migration: ${f}\n-- =============================================================================\n${readFileSync(join(migrationsDir, f), "utf8")}`)
  .join("\n");

const out = `${base}
${migrations}
-- ---------------------------------------------------------------------------
-- Seed: built-in exercise library (${exercises.length} exercises). Auto-generated.
-- ---------------------------------------------------------------------------
insert into public.exercises (id, user_id, name, muscle_group, equipment, description, instructions, recommended_sets, recommended_reps, is_custom, difficulty, exercise_type, primary_muscles, secondary_muscles)
values
${exerciseSeed}
on conflict (id) do update set
  name = excluded.name, muscle_group = excluded.muscle_group, equipment = excluded.equipment,
  description = excluded.description, instructions = excluded.instructions,
  recommended_sets = excluded.recommended_sets, recommended_reps = excluded.recommended_reps,
  difficulty = excluded.difficulty, exercise_type = excluded.exercise_type,
  primary_muscles = excluded.primary_muscles, secondary_muscles = excluded.secondary_muscles;

-- ---------------------------------------------------------------------------
-- Seed: built-in food database (${FOOD_DATABASE.length} foods, values per 100 g). Auto-generated.
-- ---------------------------------------------------------------------------
insert into public.foods (id, user_id, name, category, calories, protein, carbs, fat, serving_grams, serving_label, source)
values
${foodSeed}
on conflict (id) do update set
  name = excluded.name, category = excluded.category, calories = excluded.calories, protein = excluded.protein,
  carbs = excluded.carbs, fat = excluded.fat, serving_grams = excluded.serving_grams, serving_label = excluded.serving_label;
`;
writeFileSync(join(root, "supabase/schema.sql"), out);
console.log(`Wrote supabase/schema.sql with ${exercises.length} exercises and ${FOOD_DATABASE.length} foods`);
