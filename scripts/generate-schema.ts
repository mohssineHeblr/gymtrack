// Generates supabase/schema.sql (tables + RLS + exercise seed).
// Run with: npm run seed:sql   (Node 22.6+ strips TypeScript types natively)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_EXERCISES } from "../src/data/exercises.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exercises = DEFAULT_EXERCISES;

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (a: string[]) => `ARRAY[${a.map(q).join(", ")}]::text[]`;

const seed = exercises
  .map((e) => `  (${q(e.id)}, null, ${q(e.name)}, ${q(e.muscleGroup)}, ${q(e.equipment)}, ${q(e.description)}, ${arr(e.instructions)}, ${e.recommendedSets}, ${q(e.recommendedReps)}, false)`)
  .join(",\n");

const schema = readFileSync(join(root, "supabase/schema.base.sql"), "utf8");
const out = `${schema}
-- ---------------------------------------------------------------------------
-- Seed: built-in exercise library (${exercises.length} exercises). Auto-generated.
-- ---------------------------------------------------------------------------
insert into public.exercises (id, user_id, name, muscle_group, equipment, description, instructions, recommended_sets, recommended_reps, is_custom)
values
${seed}
on conflict (id) do update set
  name = excluded.name, muscle_group = excluded.muscle_group, equipment = excluded.equipment,
  description = excluded.description, instructions = excluded.instructions,
  recommended_sets = excluded.recommended_sets, recommended_reps = excluded.recommended_reps;
`;
writeFileSync(join(root, "supabase/schema.sql"), out);
console.log(`Wrote supabase/schema.sql with ${exercises.length} exercises`);
