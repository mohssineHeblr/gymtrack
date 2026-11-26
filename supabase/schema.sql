-- =============================================================================
-- GYMTRACK — Supabase schema
-- Paste the generated supabase/schema.sql into Supabase Dashboard → SQL Editor → Run.
-- Safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null default '',
  fitness_goal      text not null default 'build_muscle',
  goal_description  text not null default '',
  target_weight     numeric(6,2),
  weekly_goal       int not null default 4 check (weekly_goal between 0 and 14),
  units             text not null default 'kg' check (units in ('kg','lbs')),
  theme             text not null default 'dark' check (theme in ('dark','light','system')),
  nutrition_goals   jsonb not null default '{"calories":2600,"protein":170,"carbs":300,"fat":80}',
  active_program_id text,
  -- training preferences: equipment, favourite/excluded exercises, smart-workout settings
  preferences       jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- upgrade path for databases created before v1.1
alter table public.profiles add column if not exists preferences jsonb not null default '{}';

-- Create a profile automatically when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- exercises (user_id null = built-in library, otherwise a user's custom exercise)
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id               text primary key,
  user_id          uuid references auth.users (id) on delete cascade,
  name             text not null,
  muscle_group     text not null check (muscle_group in ('Chest','Back','Shoulders','Biceps','Triceps','Legs','Glutes','Abs','Cardio')),
  equipment        text not null default 'Other',
  description      text not null default '',
  instructions     text[] not null default '{}',
  recommended_sets int not null default 3,
  recommended_reps text not null default '8-12',
  is_custom        boolean not null default false,
  deleted          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists exercises_user_idx on public.exercises (user_id);

-- ---------------------------------------------------------------------------
-- workout_programs (days stored as jsonb: [{id,name,weekdays[],exercises[]}])
-- ---------------------------------------------------------------------------
create table if not exists public.workout_programs (
  id          text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text not null default '',
  is_preset   boolean not null default false,
  days        jsonb not null default '[]',
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- workouts → workout_exercises → workout_sets
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  program_id       text,
  program_day_id   text,
  started_at       timestamptz not null,
  finished_at      timestamptz,
  duration_seconds int not null default 0,
  total_volume     numeric(12,2) not null default 0,
  notes            text not null default '',
  deleted          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists workouts_user_started_idx on public.workouts (user_id, started_at desc);
create index if not exists workouts_updated_idx on public.workouts (user_id, updated_at);

create table if not exists public.workout_exercises (
  id           uuid primary key,
  workout_id   uuid not null references public.workouts (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  exercise_id  text not null references public.exercises (id),
  position     int not null default 0,
  rest_seconds int not null default 90,
  notes        text
);
create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id);

create table if not exists public.workout_sets (
  id                  uuid primary key,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  position            int not null default 0,
  weight              numeric(8,3),
  reps                int,
  completed           boolean not null default true,
  set_type            text not null default 'normal' check (set_type in ('normal','warmup','drop','failure'))
);
create index if not exists workout_sets_we_idx on public.workout_sets (workout_exercise_id);

-- ---------------------------------------------------------------------------
-- body_measurements
-- ---------------------------------------------------------------------------
create table if not exists public.body_measurements (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  measured_at date not null,
  weight      numeric(6,2),
  body_fat    numeric(5,2),
  chest       numeric(6,2),
  waist       numeric(6,2),
  arm         numeric(6,2),
  thigh       numeric(6,2),
  notes       text not null default '',
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists body_user_date_idx on public.body_measurements (user_id, measured_at);

-- ---------------------------------------------------------------------------
-- nutrition_logs
-- ---------------------------------------------------------------------------
create table if not exists public.nutrition_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  name       text not null,
  calories   numeric(8,1) not null default 0,
  protein    numeric(7,1) not null default 0,
  carbs      numeric(7,1) not null default 0,
  fat        numeric(7,1) not null default 0,
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nutrition_user_date_idx on public.nutrition_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- personal_records (derived from workouts, one row per user + exercise)
-- ---------------------------------------------------------------------------
create table if not exists public.personal_records (
  user_id          uuid not null references auth.users (id) on delete cascade,
  exercise_id      text not null references public.exercises (id),
  best_weight      numeric(8,3) not null default 0,
  best_weight_reps int not null default 0,
  best_e1rm        numeric(8,2) not null default 0,
  best_volume_set  numeric(10,2) not null default 0,
  max_reps         int not null default 0,
  achieved_at      timestamptz,
  workout_id       uuid references public.workouts (id) on delete set null,
  updated_at       timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.exercises         enable row level security;
alter table public.workout_programs  enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.body_measurements enable row level security;
alter table public.nutrition_logs    enable row level security;
alter table public.personal_records  enable row level security;

-- profiles: a user can only see / edit their own row
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- exercises: everyone signed in can read the built-in library; users manage their own custom ones
drop policy if exists "exercises_select" on public.exercises;
drop policy if exists "exercises_insert_own" on public.exercises;
drop policy if exists "exercises_update_own" on public.exercises;
drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_select" on public.exercises for select using (user_id is null or auth.uid() = user_id);
create policy "exercises_insert_own" on public.exercises for insert with check (auth.uid() = user_id);
create policy "exercises_update_own" on public.exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete_own" on public.exercises for delete using (auth.uid() = user_id);

-- Generic owner-only policies for the remaining tables
do $$
declare t text;
begin
  foreach t in array array['workout_programs','workouts','workout_exercises','workout_sets','body_measurements','nutrition_logs','personal_records']
  loop
    execute format('drop policy if exists "%1$s_owner_all" on public.%1$I', t);
    execute format('create policy "%1$s_owner_all" on public.%1$I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;


-- =============================================================================
-- migration: 002_advanced_training_nutrition.sql
-- =============================================================================
-- =============================================================================
-- GYMTRACK v2 — advanced training techniques, rest-timer preferences,
-- food database + meals, expanded exercise library.
--
-- Additive and idempotent: safe to run on an existing v1 database. Existing
-- workout history is preserved; v1 nutrition_logs are copied into meals.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles: rest-timer preferences
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists timer_settings jsonb not null default '{}';

-- ---------------------------------------------------------------------------
-- Exercise library: new muscle-group taxonomy + metadata
-- ---------------------------------------------------------------------------
alter table public.exercises drop constraint if exists exercises_muscle_group_check;
update public.exercises set muscle_group = 'Quadriceps' where muscle_group = 'Legs';
alter table public.exercises add constraint exercises_muscle_group_check check (muscle_group in (
  'Chest','Back','Shoulders','Biceps','Triceps','Forearms','Quadriceps','Hamstrings','Glutes','Calves','Abs','Cardio'
));
alter table public.exercises add column if not exists difficulty text not null default 'intermediate';
alter table public.exercises add column if not exists exercise_type text not null default 'isolation';
alter table public.exercises add column if not exists primary_muscles text[] not null default '{}';
alter table public.exercises add column if not exists secondary_muscles text[] not null default '{}';
-- small compressed image (data URL) or https URL
alter table public.exercises add column if not exists image text;
alter table public.exercises drop constraint if exists exercises_difficulty_check;
alter table public.exercises add constraint exercises_difficulty_check check (difficulty in ('beginner','intermediate','advanced'));
alter table public.exercises drop constraint if exists exercises_type_check;
alter table public.exercises add constraint exercises_type_check check (exercise_type in ('compound','isolation','cardio','plyometric','mobility'));
alter table public.exercises drop constraint if exists exercises_image_size_check;
alter table public.exercises add constraint exercises_image_size_check check (image is null or length(image) < 400000);
-- one custom exercise per name per user (prevents duplicates across devices).
-- Skipped with a notice if duplicates already exist, so the migration never fails on old data.
do $$
begin
  create unique index if not exists exercises_user_name_uidx on public.exercises (user_id, lower(name)) where user_id is not null and not deleted;
exception when unique_violation then
  raise notice 'exercises_user_name_uidx not created: duplicate custom exercise names exist';
end $$;

-- ---------------------------------------------------------------------------
-- Workout techniques: supersets / giant sets (group_id), technique, tempo
-- ---------------------------------------------------------------------------
alter table public.workout_exercises add column if not exists group_id uuid;
alter table public.workout_exercises add column if not exists technique text not null default 'standard';
alter table public.workout_exercises add column if not exists tempo text;
alter table public.workout_exercises add column if not exists target_reps text;
alter table public.workout_exercises drop constraint if exists workout_exercises_technique_check;
alter table public.workout_exercises add constraint workout_exercises_technique_check
  check (technique in ('standard','dropset','rest_pause','myo_reps','tempo'));
alter table public.workout_exercises drop constraint if exists workout_exercises_tempo_check;
alter table public.workout_exercises add constraint workout_exercises_tempo_check check (tempo is null or tempo ~ '^[0-9X](-[0-9X]){3}$');
create index if not exists workout_exercises_group_idx on public.workout_exercises (workout_id, group_id) where group_id is not null;

-- Individual rest per set
alter table public.workout_sets add column if not exists rest_seconds int check (rest_seconds is null or rest_seconds between 0 and 3600);

-- Dropset drops / rest-pause & myo-rep mini-sets belong to their parent set
create table if not exists public.workout_set_stages (
  id             uuid primary key,
  workout_set_id uuid not null references public.workout_sets (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  position       int not null default 0,
  weight         numeric(8,3),
  reps           int check (reps is null or reps >= 0)
);
create index if not exists workout_set_stages_set_idx on public.workout_set_stages (workout_set_id);

-- ---------------------------------------------------------------------------
-- Food database
--   user_id null  = built-in food (read-only, seeded below)
--   user_id = me  = my custom foods and Open Food Facts items I've used
-- ---------------------------------------------------------------------------
create table if not exists public.foods (
  id            text primary key,
  user_id       uuid references auth.users (id) on delete cascade,
  name          text not null,
  brand         text,
  category      text not null default 'Other',
  calories      numeric(7,1) not null default 0 check (calories >= 0),
  protein       numeric(6,2) not null default 0 check (protein >= 0),
  carbs         numeric(6,2) not null default 0 check (carbs >= 0),
  fat           numeric(6,2) not null default 0 check (fat >= 0),
  serving_grams numeric(7,1),
  serving_label text,
  source        text not null default 'custom' check (source in ('builtin','custom','off')),
  barcode       text,
  deleted       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists foods_user_idx on public.foods (user_id);
create index if not exists foods_name_idx on public.foods (lower(name));

-- ---------------------------------------------------------------------------
-- Meals (one per user / day / meal type) → meal items
-- ---------------------------------------------------------------------------
create table if not exists public.meals (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  meal_type  text not null check (meal_type in ('breakfast','lunch','dinner','snacks')),
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meals_user_date_idx on public.meals (user_id, log_date);
create index if not exists meals_updated_idx on public.meals (user_id, updated_at);

create table if not exists public.meal_items (
  id        uuid primary key,
  meal_id   uuid not null references public.meals (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  food_id   text references public.foods (id) on delete set null,
  position  int not null default 0,
  name      text not null,
  brand     text,
  grams     numeric(7,1) check (grams is null or grams >= 0),
  -- per-100 g values (null for quick / fixed-portion entries)
  per100    jsonb,
  calories  numeric(8,1) not null default 0,
  protein   numeric(7,1) not null default 0,
  carbs     numeric(7,1) not null default 0,
  fat       numeric(7,1) not null default 0
);
create index if not exists meal_items_meal_idx on public.meal_items (meal_id);

-- Saved / frequently used meals (templates)
create table if not exists public.saved_meals (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  items      jsonb not null default '[]',
  deleted    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_meals_user_idx on public.saved_meals (user_id);

-- Copy v1 nutrition logs into meals (once). Each day's logs become a "snacks" meal.
insert into public.meals (id, user_id, log_date, meal_type, updated_at)
select gen_random_uuid(), user_id, log_date, 'snacks', max(updated_at)
from public.nutrition_logs n
where not n.deleted
  and not exists (select 1 from public.meals m where m.user_id = n.user_id and m.log_date = n.log_date and m.meal_type = 'snacks')
group by user_id, log_date;

insert into public.meal_items (id, meal_id, user_id, position, name, calories, protein, carbs, fat)
select n.id, m.id, n.user_id, row_number() over (partition by m.id order by n.created_at), n.name, n.calories, n.protein, n.carbs, n.fat
from public.nutrition_logs n
join public.meals m on m.user_id = n.user_id and m.log_date = n.log_date and m.meal_type = 'snacks'
where not n.deleted
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Web Push fallback for the rest timer (written only by the Edge Function)
-- ---------------------------------------------------------------------------
create table if not exists public.rest_timer_pushes (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null default '',
  fire_at    timestamptz not null default now(),
  cancelled  boolean not null default false,
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rest_timer_pushes_due_idx on public.rest_timer_pushes (fire_at) where sent_at is null and not cancelled;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.workout_set_stages enable row level security;
alter table public.foods              enable row level security;
alter table public.meals              enable row level security;
alter table public.meal_items         enable row level security;
alter table public.saved_meals        enable row level security;
alter table public.rest_timer_pushes  enable row level security;

-- foods: everyone signed in can read built-ins; users manage only their own
drop policy if exists "foods_select" on public.foods;
drop policy if exists "foods_insert_own" on public.foods;
drop policy if exists "foods_update_own" on public.foods;
drop policy if exists "foods_delete_own" on public.foods;
create policy "foods_select" on public.foods for select using (user_id is null or auth.uid() = user_id);
create policy "foods_insert_own" on public.foods for insert with check (auth.uid() = user_id);
create policy "foods_update_own" on public.foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "foods_delete_own" on public.foods for delete using (auth.uid() = user_id);

-- private, owner-only tables
do $$
declare t text;
begin
  foreach t in array array['workout_set_stages','meals','meal_items','saved_meals']
  loop
    execute format('drop policy if exists "%1$s_owner_all" on public.%1$I', t);
    execute format('create policy "%1$s_owner_all" on public.%1$I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- rest_timer_pushes: users may only read their own rows; writes happen server-side (service role)
drop policy if exists "rest_timer_pushes_select_own" on public.rest_timer_pushes;
create policy "rest_timer_pushes_select_own" on public.rest_timer_pushes for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed: built-in exercise library (118 exercises). Auto-generated.
-- ---------------------------------------------------------------------------
insert into public.exercises (id, user_id, name, muscle_group, equipment, description, instructions, recommended_sets, recommended_reps, is_custom, difficulty, exercise_type, primary_muscles, secondary_muscles)
values
  ('bench-press', null, 'Bench Press', 'Chest', 'Barbell', 'The king of upper-body pressing. Builds chest, front delts and triceps.', ARRAY['Lie on the bench with eyes under the bar and feet flat on the floor.', 'Grip the bar slightly wider than shoulder width and unrack it.', 'Lower the bar under control to your mid-chest, elbows at ~45°.', 'Press the bar back up until your arms are locked out.']::text[], 4, '5-8', false, 'intermediate', 'compound', ARRAY['chest']::text[], ARRAY['frontDelts', 'triceps']::text[]),
  ('incline-bench-press', null, 'Incline Bench Press', 'Chest', 'Barbell', 'Pressing on a 30–45° incline to emphasise the upper chest.', ARRAY['Set the bench to a 30–45° incline.', 'Unrack the bar with a slightly-wider-than-shoulder grip.', 'Lower to the upper chest just below the collarbone.', 'Drive the bar up and slightly back to lockout.']::text[], 4, '6-10', false, 'intermediate', 'compound', ARRAY['chest', 'frontDelts']::text[], ARRAY['triceps']::text[]),
  ('dumbbell-bench-press', null, 'Dumbbell Bench Press', 'Chest', 'Dumbbell', 'Flat press with dumbbells for a greater range of motion and balanced strength.', ARRAY['Sit with dumbbells on your thighs, then lie back and bring them to chest level.', 'Press the dumbbells up until arms are straight.', 'Lower slowly until you feel a stretch in the chest.', 'Press back up, bringing the dumbbells slightly together.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['chest']::text[], ARRAY['frontDelts', 'triceps']::text[]),
  ('incline-dumbbell-press', null, 'Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Upper chest builder with independent arms.', ARRAY['Set the bench to 30–45°.', 'Start with dumbbells at shoulder level, palms forward.', 'Press up and slightly inward.', 'Lower under control to a deep stretch.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['chest', 'frontDelts']::text[], ARRAY['triceps']::text[]),
  ('dumbbell-fly', null, 'Dumbbell Fly', 'Chest', 'Dumbbell', 'Isolation movement that stretches and contracts the pecs.', ARRAY['Lie flat holding dumbbells above your chest with a slight elbow bend.', 'Open your arms in a wide arc until you feel a stretch.', 'Squeeze your chest to bring the weights back together.', 'Keep the elbow angle constant throughout.']::text[], 3, '10-15', false, 'beginner', 'isolation', ARRAY['chest']::text[], ARRAY['frontDelts']::text[]),
  ('cable-crossover', null, 'Cable Crossover', 'Chest', 'Cable', 'Constant-tension chest isolation from high pulleys.', ARRAY['Set pulleys high and grab a handle in each hand.', 'Step forward into a staggered stance with a slight lean.', 'Bring hands together in front of your hips in an arc.', 'Return slowly until you feel a stretch.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['chest']::text[], ARRAY['frontDelts']::text[]),
  ('chest-press-machine', null, 'Chest Press Machine', 'Chest', 'Machine', 'Stable machine press — great for pushing close to failure safely.', ARRAY['Adjust the seat so the handles are at mid-chest height.', 'Press the handles forward until arms are extended.', 'Return slowly without letting the stack touch.', 'Keep shoulder blades pinned to the pad.']::text[], 3, '10-12', false, 'beginner', 'compound', ARRAY['chest']::text[], ARRAY['frontDelts', 'triceps']::text[]),
  ('push-up', null, 'Push-Up', 'Chest', 'Bodyweight', 'Classic bodyweight press for chest, shoulders and triceps.', ARRAY['Start in a high plank with hands slightly wider than shoulders.', 'Brace your core and keep a straight line from head to heels.', 'Lower your chest to just above the floor.', 'Push back up to full extension.']::text[], 3, '10-20', false, 'beginner', 'compound', ARRAY['chest']::text[], ARRAY['frontDelts', 'triceps', 'abs']::text[]),
  ('chest-dip', null, 'Chest Dip', 'Chest', 'Bodyweight', 'Forward-leaning dip variation that hits the lower chest.', ARRAY['Support yourself on parallel bars with arms straight.', 'Lean your torso forward slightly.', 'Lower until your shoulders are just below elbows.', 'Press back up to lockout.']::text[], 3, '8-12', false, 'advanced', 'compound', ARRAY['chest', 'triceps']::text[], ARRAY['frontDelts']::text[]),
  ('deadlift', null, 'Deadlift', 'Back', 'Barbell', 'Full posterior-chain lift building raw strength in the back, glutes and hamstrings.', ARRAY['Stand with mid-foot under the bar, feet hip-width apart.', 'Hinge and grip the bar just outside your legs.', 'Brace, flatten your back and pull the slack out of the bar.', 'Drive through the floor and stand tall, then lower with control.']::text[], 3, '3-5', false, 'advanced', 'compound', ARRAY['lowerBack', 'hamstrings', 'glutes']::text[], ARRAY['upperBack', 'traps', 'forearms', 'quads']::text[]),
  ('barbell-row', null, 'Barbell Row', 'Back', 'Barbell', 'Heavy horizontal pull for a thick upper back.', ARRAY['Hinge forward to ~45° with a flat back, bar hanging at arm''s length.', 'Pull the bar to your lower ribs, driving elbows back.', 'Squeeze the shoulder blades at the top.', 'Lower under control.']::text[], 4, '6-10', false, 'intermediate', 'compound', ARRAY['upperBack', 'lats']::text[], ARRAY['rearDelts', 'biceps', 'lowerBack']::text[]),
  ('pull-up', null, 'Pull-Up', 'Back', 'Bodyweight', 'Vertical pulling staple for lat width.', ARRAY['Hang from the bar with an overhand grip, slightly wider than shoulders.', 'Pull your chest towards the bar, leading with your elbows.', 'Get your chin over the bar.', 'Lower all the way to a dead hang.']::text[], 4, '6-10', false, 'intermediate', 'compound', ARRAY['lats']::text[], ARRAY['biceps', 'upperBack', 'forearms']::text[]),
  ('chin-up', null, 'Chin-Up', 'Back', 'Bodyweight', 'Underhand pull-up with more biceps involvement.', ARRAY['Hang with a shoulder-width underhand grip.', 'Pull until your chin clears the bar.', 'Squeeze your lats at the top.', 'Lower slowly to full extension.']::text[], 3, '6-10', false, 'intermediate', 'compound', ARRAY['lats', 'biceps']::text[], ARRAY['upperBack', 'forearms']::text[]),
  ('lat-pulldown', null, 'Lat Pulldown', 'Back', 'Cable', 'Machine alternative to pull-ups for building the lats.', ARRAY['Sit with thighs secured under the pads.', 'Grip the bar wider than shoulder width.', 'Pull the bar to your upper chest, elbows down and back.', 'Return slowly to full stretch.']::text[], 3, '8-12', false, 'beginner', 'compound', ARRAY['lats']::text[], ARRAY['biceps', 'upperBack']::text[]),
  ('seated-cable-row', null, 'Seated Cable Row', 'Back', 'Cable', 'Horizontal pull targeting the mid-back and lats.', ARRAY['Sit with feet on the platform, knees slightly bent.', 'Grab the handle and sit tall.', 'Row the handle to your stomach, squeezing shoulder blades.', 'Extend your arms slowly without rounding.']::text[], 3, '10-12', false, 'beginner', 'compound', ARRAY['upperBack', 'lats']::text[], ARRAY['rearDelts', 'biceps']::text[]),
  ('dumbbell-row', null, 'One-Arm Dumbbell Row', 'Back', 'Dumbbell', 'Unilateral row for lats and upper back.', ARRAY['Place one knee and hand on a bench, back flat.', 'Hold a dumbbell in the free hand, arm extended.', 'Row the dumbbell to your hip.', 'Lower with control and repeat, then switch sides.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['lats', 'upperBack']::text[], ARRAY['rearDelts', 'biceps']::text[]),
  ('t-bar-row', null, 'T-Bar Row', 'Back', 'Barbell', 'Chest-supported or landmine row for back thickness.', ARRAY['Straddle the bar and grip the handle.', 'Hinge with a flat back.', 'Pull the handle to your chest.', 'Lower slowly to full stretch.']::text[], 3, '8-10', false, 'intermediate', 'compound', ARRAY['upperBack', 'lats']::text[], ARRAY['rearDelts', 'biceps', 'lowerBack']::text[]),
  ('face-pull', null, 'Face Pull', 'Back', 'Cable', 'Rear-delt and upper-back exercise for shoulder health.', ARRAY['Set a rope attachment at upper-chest height.', 'Pull the rope towards your face, splitting the ends.', 'Externally rotate so your hands finish beside your ears.', 'Return slowly.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['rearDelts']::text[], ARRAY['upperBack', 'traps']::text[]),
  ('straight-arm-pulldown', null, 'Straight-Arm Pulldown', 'Back', 'Cable', 'Lat isolation with straight arms.', ARRAY['Stand facing a high pulley holding a bar.', 'Keep arms nearly straight and hinge slightly.', 'Pull the bar down to your thighs in an arc.', 'Return to the start under control.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['lats']::text[], ARRAY['triceps']::text[]),
  ('overhead-press', null, 'Overhead Press', 'Shoulders', 'Barbell', 'Standing barbell press for strong, broad shoulders.', ARRAY['Hold the bar at your collarbone with a shoulder-width grip.', 'Brace your core and squeeze your glutes.', 'Press the bar overhead, moving your head back slightly.', 'Lock out with the bar over mid-foot, then lower.']::text[], 4, '5-8', false, 'intermediate', 'compound', ARRAY['frontDelts']::text[], ARRAY['sideDelts', 'triceps', 'traps']::text[]),
  ('dumbbell-shoulder-press', null, 'Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 'Seated or standing press with dumbbells.', ARRAY['Sit upright holding dumbbells at shoulder height.', 'Press the weights overhead until arms are straight.', 'Lower back to shoulder level.', 'Avoid arching your lower back.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['frontDelts']::text[], ARRAY['sideDelts', 'triceps']::text[]),
  ('arnold-press', null, 'Arnold Press', 'Shoulders', 'Dumbbell', 'Rotational press that hits all three delt heads.', ARRAY['Start with dumbbells in front of your face, palms facing you.', 'Rotate your palms outward as you press up.', 'Finish with palms facing forward overhead.', 'Reverse the motion on the way down.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['frontDelts', 'sideDelts']::text[], ARRAY['triceps']::text[]),
  ('lateral-raise', null, 'Lateral Raise', 'Shoulders', 'Dumbbell', 'Isolation for the side delts — key for shoulder width.', ARRAY['Stand holding dumbbells at your sides.', 'Raise your arms out to the side to shoulder height.', 'Lead with your elbows, slight bend in the arm.', 'Lower slowly.']::text[], 4, '12-15', false, 'beginner', 'isolation', ARRAY['sideDelts']::text[], ARRAY['traps']::text[]),
  ('cable-lateral-raise', null, 'Cable Lateral Raise', 'Shoulders', 'Cable', 'Constant-tension side delt raise.', ARRAY['Stand side-on to a low pulley, handle in the far hand.', 'Raise your arm out to shoulder height.', 'Pause briefly at the top.', 'Lower slowly to the start.']::text[], 3, '12-15', false, 'intermediate', 'isolation', ARRAY['sideDelts']::text[], ARRAY['traps']::text[]),
  ('front-raise', null, 'Front Raise', 'Shoulders', 'Dumbbell', 'Isolation for the front delts.', ARRAY['Hold dumbbells in front of your thighs.', 'Raise one or both arms forward to shoulder height.', 'Keep a slight elbow bend.', 'Lower with control.']::text[], 3, '10-12', false, 'beginner', 'isolation', ARRAY['frontDelts']::text[], ARRAY[]::text[]),
  ('rear-delt-fly', null, 'Rear Delt Fly', 'Shoulders', 'Dumbbell', 'Bent-over fly for the rear delts.', ARRAY['Hinge forward with a flat back, dumbbells hanging.', 'Raise the weights out to the side, squeezing the rear delts.', 'Keep a soft bend in the elbows.', 'Lower slowly.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['rearDelts']::text[], ARRAY['upperBack']::text[]),
  ('upright-row', null, 'Upright Row', 'Shoulders', 'Barbell', 'Compound pull for side delts and traps.', ARRAY['Hold a bar with a shoulder-width grip.', 'Pull the bar up along your body to chest height.', 'Lead with the elbows.', 'Lower under control.']::text[], 3, '10-12', false, 'intermediate', 'isolation', ARRAY['sideDelts', 'traps']::text[], ARRAY['biceps']::text[]),
  ('shrug', null, 'Barbell Shrug', 'Shoulders', 'Barbell', 'Trap builder.', ARRAY['Hold the bar at arm''s length.', 'Shrug your shoulders straight up towards your ears.', 'Hold for a second at the top.', 'Lower slowly.']::text[], 3, '10-15', false, 'beginner', 'isolation', ARRAY['traps']::text[], ARRAY['forearms']::text[]),
  ('barbell-curl', null, 'Barbell Curl', 'Biceps', 'Barbell', 'Classic mass builder for the biceps.', ARRAY['Stand holding a bar with an underhand, shoulder-width grip.', 'Curl the bar up, keeping elbows pinned to your sides.', 'Squeeze at the top.', 'Lower slowly to full extension.']::text[], 3, '8-12', false, 'intermediate', 'isolation', ARRAY['biceps']::text[], ARRAY['forearms']::text[]),
  ('dumbbell-curl', null, 'Dumbbell Curl', 'Biceps', 'Dumbbell', 'Alternating or simultaneous curls with supination.', ARRAY['Hold dumbbells at your sides, palms forward.', 'Curl the weights up, rotating palms up.', 'Squeeze at the top.', 'Lower with control.']::text[], 3, '10-12', false, 'beginner', 'isolation', ARRAY['biceps']::text[], ARRAY['forearms']::text[]),
  ('hammer-curl', null, 'Hammer Curl', 'Biceps', 'Dumbbell', 'Neutral-grip curl for the brachialis and forearms.', ARRAY['Hold dumbbells with palms facing each other.', 'Curl up keeping the neutral grip.', 'Pause at the top.', 'Lower slowly.']::text[], 3, '10-12', false, 'beginner', 'isolation', ARRAY['biceps', 'forearms']::text[], ARRAY[]::text[]),
  ('preacher-curl', null, 'Preacher Curl', 'Biceps', 'Machine', 'Strict curl on a preacher bench that removes momentum.', ARRAY['Sit with your upper arms flat on the pad.', 'Curl the bar or handles up.', 'Squeeze the biceps at the top.', 'Lower until arms are nearly straight.']::text[], 3, '10-12', false, 'intermediate', 'isolation', ARRAY['biceps']::text[], ARRAY[]::text[]),
  ('incline-dumbbell-curl', null, 'Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 'Curl from a stretched position for the long head.', ARRAY['Lie back on a 45–60° incline bench, arms hanging.', 'Curl both dumbbells up without moving your elbows.', 'Squeeze at the top.', 'Lower slowly to full stretch.']::text[], 3, '10-12', false, 'intermediate', 'isolation', ARRAY['biceps']::text[], ARRAY[]::text[]),
  ('cable-curl', null, 'Cable Curl', 'Biceps', 'Cable', 'Constant-tension biceps curl.', ARRAY['Stand facing a low pulley with a straight bar.', 'Curl the bar to your shoulders.', 'Keep elbows fixed at your sides.', 'Lower under control.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['biceps']::text[], ARRAY['forearms']::text[]),
  ('close-grip-bench', null, 'Close-Grip Bench Press', 'Triceps', 'Barbell', 'Heavy compound press emphasising the triceps.', ARRAY['Lie on a bench and grip the bar shoulder-width apart.', 'Lower the bar to your lower chest, elbows tucked.', 'Press back to lockout.', 'Keep wrists stacked over elbows.']::text[], 3, '6-10', false, 'intermediate', 'compound', ARRAY['triceps']::text[], ARRAY['chest', 'frontDelts']::text[]),
  ('tricep-pushdown', null, 'Tricep Pushdown', 'Triceps', 'Cable', 'Cable isolation for all three triceps heads.', ARRAY['Stand at a high pulley with a bar or rope.', 'Pin your elbows to your sides.', 'Push down until arms are fully extended.', 'Return slowly to ~90°.']::text[], 3, '10-15', false, 'beginner', 'isolation', ARRAY['triceps']::text[], ARRAY[]::text[]),
  ('overhead-tricep-extension', null, 'Overhead Tricep Extension', 'Triceps', 'Dumbbell', 'Stretches and loads the long head of the triceps.', ARRAY['Hold one dumbbell overhead with both hands.', 'Lower it behind your head by bending the elbows.', 'Keep elbows pointing forward.', 'Extend back to the top.']::text[], 3, '10-12', false, 'intermediate', 'isolation', ARRAY['triceps']::text[], ARRAY[]::text[]),
  ('skull-crusher', null, 'Skull Crusher', 'Triceps', 'Barbell', 'Lying EZ-bar extension for triceps mass.', ARRAY['Lie on a bench holding an EZ-bar above your chest.', 'Bend at the elbows to lower the bar to your forehead.', 'Keep upper arms still.', 'Extend back up.']::text[], 3, '8-12', false, 'intermediate', 'isolation', ARRAY['triceps']::text[], ARRAY[]::text[]),
  ('tricep-dip', null, 'Tricep Dip', 'Triceps', 'Bodyweight', 'Upright dip variation for the triceps.', ARRAY['Support yourself on parallel bars, torso upright.', 'Lower until elbows reach 90°.', 'Press back up to lockout.', 'Keep elbows close to your body.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['triceps']::text[], ARRAY['chest', 'frontDelts']::text[]),
  ('tricep-kickback', null, 'Tricep Kickback', 'Triceps', 'Dumbbell', 'Isolation with peak contraction at full extension.', ARRAY['Hinge forward with your upper arm parallel to the floor.', 'Extend the dumbbell back until your arm is straight.', 'Squeeze the triceps.', 'Return slowly.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['triceps']::text[], ARRAY[]::text[]),
  ('back-squat', null, 'Back Squat', 'Quadriceps', 'Barbell', 'The foundational lower-body lift for quads, glutes and core.', ARRAY['Set the bar on your upper back and unrack it.', 'Stand with feet shoulder-width, toes slightly out.', 'Sit down and back until hips are below knees.', 'Drive up through mid-foot to standing.']::text[], 4, '5-8', false, 'intermediate', 'compound', ARRAY['quads', 'glutes']::text[], ARRAY['hamstrings', 'adductors', 'lowerBack']::text[]),
  ('front-squat', null, 'Front Squat', 'Quadriceps', 'Barbell', 'Quad-dominant squat with the bar in the front rack.', ARRAY['Rest the bar on your front delts, elbows high.', 'Squat straight down keeping your torso upright.', 'Reach depth below parallel.', 'Drive up keeping elbows high.']::text[], 3, '5-8', false, 'advanced', 'compound', ARRAY['quads']::text[], ARRAY['glutes', 'abs', 'upperBack']::text[]),
  ('leg-press', null, 'Leg Press', 'Quadriceps', 'Machine', 'Heavy quad and glute work with back support.', ARRAY['Sit with feet shoulder-width on the platform.', 'Release the safeties and lower the sled to ~90°.', 'Press through your heels to extend.', 'Don''t lock the knees hard at the top.']::text[], 3, '10-12', false, 'beginner', 'compound', ARRAY['quads', 'glutes']::text[], ARRAY['hamstrings', 'adductors']::text[]),
  ('romanian-deadlift', null, 'Romanian Deadlift', 'Hamstrings', 'Barbell', 'Hip hinge for hamstrings and glutes.', ARRAY['Hold the bar at hip height with a flat back.', 'Push your hips back, sliding the bar down your thighs.', 'Stop when you feel a strong hamstring stretch.', 'Drive the hips forward to stand.']::text[], 3, '8-10', false, 'intermediate', 'compound', ARRAY['hamstrings', 'glutes']::text[], ARRAY['lowerBack', 'forearms']::text[]),
  ('bulgarian-split-squat', null, 'Bulgarian Split Squat', 'Quadriceps', 'Dumbbell', 'Single-leg squat for quads and glutes.', ARRAY['Stand in front of a bench, rear foot elevated behind you.', 'Hold dumbbells at your sides.', 'Lower until the back knee nearly touches the floor.', 'Drive up through the front foot.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['quads', 'glutes']::text[], ARRAY['hamstrings', 'adductors']::text[]),
  ('walking-lunge', null, 'Walking Lunge', 'Quadriceps', 'Dumbbell', 'Dynamic lunge for legs and balance.', ARRAY['Hold dumbbells at your sides.', 'Step forward into a lunge, both knees at ~90°.', 'Push off and step through with the other leg.', 'Keep your torso tall.']::text[], 3, '10-12', false, 'intermediate', 'compound', ARRAY['quads', 'glutes']::text[], ARRAY['hamstrings', 'adductors', 'calves']::text[]),
  ('leg-extension', null, 'Leg Extension', 'Quadriceps', 'Machine', 'Quad isolation.', ARRAY['Sit with the pad on your lower shins.', 'Extend your legs until straight.', 'Squeeze the quads at the top.', 'Lower slowly.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['quads']::text[], ARRAY[]::text[]),
  ('leg-curl', null, 'Lying Leg Curl', 'Hamstrings', 'Machine', 'Hamstring isolation.', ARRAY['Lie face down with the pad above your heels.', 'Curl your heels towards your glutes.', 'Squeeze at the top.', 'Lower under control.']::text[], 3, '10-15', false, 'beginner', 'isolation', ARRAY['hamstrings']::text[], ARRAY['calves']::text[]),
  ('calf-raise', null, 'Standing Calf Raise', 'Calves', 'Machine', 'Builds the gastrocnemius.', ARRAY['Stand on the platform with the balls of your feet.', 'Lower your heels for a deep stretch.', 'Rise up onto your toes as high as possible.', 'Pause, then lower slowly.']::text[], 4, '12-15', false, 'beginner', 'isolation', ARRAY['calves']::text[], ARRAY[]::text[]),
  ('goblet-squat', null, 'Goblet Squat', 'Quadriceps', 'Dumbbell', 'Front-loaded squat — great for learning depth.', ARRAY['Hold a dumbbell vertically at your chest.', 'Squat down between your knees.', 'Keep your chest up and elbows inside knees.', 'Stand back up.']::text[], 3, '10-12', false, 'beginner', 'compound', ARRAY['quads', 'glutes']::text[], ARRAY['adductors', 'abs']::text[]),
  ('hack-squat', null, 'Hack Squat', 'Quadriceps', 'Machine', 'Machine squat that hammers the quads.', ARRAY['Stand on the platform with shoulders under the pads.', 'Release the safeties.', 'Lower until thighs are parallel or below.', 'Press back up.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['quads']::text[], ARRAY['glutes', 'adductors']::text[]),
  ('hip-thrust', null, 'Barbell Hip Thrust', 'Glutes', 'Barbell', 'The best direct glute builder.', ARRAY['Sit with your upper back against a bench, bar over your hips.', 'Plant your feet hip-width apart.', 'Drive your hips up until your body is straight from knees to shoulders.', 'Squeeze your glutes hard, then lower.']::text[], 4, '8-12', false, 'intermediate', 'compound', ARRAY['glutes']::text[], ARRAY['hamstrings']::text[]),
  ('glute-bridge', null, 'Glute Bridge', 'Glutes', 'Bodyweight', 'Floor-based hip extension.', ARRAY['Lie on your back, knees bent, feet flat.', 'Drive through your heels to raise your hips.', 'Squeeze your glutes at the top.', 'Lower slowly.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['glutes']::text[], ARRAY['hamstrings']::text[]),
  ('cable-kickback', null, 'Cable Glute Kickback', 'Glutes', 'Cable', 'Glute isolation with an ankle strap.', ARRAY['Attach an ankle strap to a low pulley.', 'Face the machine and hold for support.', 'Kick your leg back, squeezing the glute.', 'Return slowly.']::text[], 3, '12-15', false, 'intermediate', 'isolation', ARRAY['glutes']::text[], ARRAY[]::text[]),
  ('hip-abduction', null, 'Hip Abduction Machine', 'Glutes', 'Machine', 'Targets the glute medius.', ARRAY['Sit with the pads on the outside of your knees.', 'Push your knees outward.', 'Pause at full abduction.', 'Return slowly.']::text[], 3, '15-20', false, 'beginner', 'isolation', ARRAY['glutes']::text[], ARRAY[]::text[]),
  ('sumo-deadlift', null, 'Sumo Deadlift', 'Glutes', 'Barbell', 'Wide-stance deadlift with more glute and adductor work.', ARRAY['Take a wide stance, toes pointed out.', 'Grip the bar inside your knees.', 'Push the floor apart and stand up.', 'Lock out by squeezing your glutes.']::text[], 3, '5-8', false, 'advanced', 'compound', ARRAY['glutes', 'adductors', 'hamstrings']::text[], ARRAY['lowerBack', 'quads', 'traps']::text[]),
  ('step-up', null, 'Dumbbell Step-Up', 'Glutes', 'Dumbbell', 'Unilateral glute and quad exercise.', ARRAY['Stand facing a box holding dumbbells.', 'Step up with one foot and drive through the heel.', 'Stand tall on top.', 'Step down under control.']::text[], 3, '10-12', false, 'intermediate', 'compound', ARRAY['glutes', 'quads']::text[], ARRAY['hamstrings']::text[]),
  ('plank', null, 'Plank', 'Abs', 'Bodyweight', 'Isometric core stability exercise. Log reps as seconds.', ARRAY['Rest on your forearms and toes.', 'Keep a straight line from head to heels.', 'Brace your abs and squeeze your glutes.', 'Hold for the target time.']::text[], 3, '30-60s', false, 'beginner', 'mobility', ARRAY['abs']::text[], ARRAY['obliques']::text[]),
  ('hanging-leg-raise', null, 'Hanging Leg Raise', 'Abs', 'Bodyweight', 'Advanced lower-ab exercise.', ARRAY['Hang from a pull-up bar.', 'Raise your legs until they''re parallel to the floor or higher.', 'Avoid swinging.', 'Lower slowly.']::text[], 3, '10-15', false, 'advanced', 'isolation', ARRAY['abs']::text[], ARRAY['obliques', 'forearms']::text[]),
  ('cable-crunch', null, 'Cable Crunch', 'Abs', 'Cable', 'Weighted crunch for ab strength.', ARRAY['Kneel below a high pulley holding a rope by your head.', 'Crunch down, bringing elbows towards knees.', 'Squeeze your abs.', 'Return slowly.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['abs']::text[], ARRAY[]::text[]),
  ('crunch', null, 'Crunch', 'Abs', 'Bodyweight', 'Basic ab flexion.', ARRAY['Lie on your back with knees bent.', 'Curl your shoulders off the floor.', 'Squeeze your abs at the top.', 'Lower slowly.']::text[], 3, '15-20', false, 'beginner', 'isolation', ARRAY['abs']::text[], ARRAY[]::text[]),
  ('russian-twist', null, 'Russian Twist', 'Abs', 'Other', 'Rotational core exercise for the obliques.', ARRAY['Sit with knees bent and lean back slightly.', 'Hold a weight in front of your chest.', 'Rotate your torso side to side.', 'Keep your core braced.']::text[], 3, '20', false, 'intermediate', 'isolation', ARRAY['obliques']::text[], ARRAY['abs']::text[]),
  ('ab-wheel', null, 'Ab Wheel Rollout', 'Abs', 'Other', 'Anti-extension core builder.', ARRAY['Kneel holding an ab wheel.', 'Roll forward as far as you can with a flat back.', 'Use your abs to pull back to the start.', 'Don''t let your hips sag.']::text[], 3, '8-12', false, 'advanced', 'isolation', ARRAY['abs']::text[], ARRAY['obliques', 'lats']::text[]),
  ('treadmill-run', null, 'Treadmill Run', 'Cardio', 'Machine', 'Steady-state or interval running. Log reps as minutes.', ARRAY['Start with a 3–5 minute walking warm-up.', 'Increase to your target pace.', 'Maintain good posture and a relaxed stride.', 'Cool down for 3–5 minutes.']::text[], 1, '20-30 min', false, 'beginner', 'cardio', ARRAY['quads', 'calves']::text[], ARRAY['hamstrings', 'glutes']::text[]),
  ('rowing-machine', null, 'Rowing Machine', 'Cardio', 'Machine', 'Full-body conditioning. Log reps as minutes.', ARRAY['Strap in and grab the handle.', 'Drive with legs first, then lean back and pull.', 'Return arms, then body, then legs.', 'Keep a steady stroke rate.']::text[], 1, '10-20 min', false, 'beginner', 'cardio', ARRAY['upperBack', 'quads']::text[], ARRAY['lats', 'hamstrings', 'biceps']::text[]),
  ('stationary-bike', null, 'Stationary Bike', 'Cardio', 'Machine', 'Low-impact cardio. Log reps as minutes.', ARRAY['Adjust seat height so your knee is slightly bent at the bottom.', 'Warm up at an easy resistance.', 'Increase intensity to your target.', 'Cool down gradually.']::text[], 1, '20-40 min', false, 'beginner', 'cardio', ARRAY['quads']::text[], ARRAY['calves', 'glutes']::text[]),
  ('jump-rope', null, 'Jump Rope', 'Cardio', 'Other', 'High-intensity conditioning. Log reps as minutes.', ARRAY['Hold the handles at hip height.', 'Turn the rope with your wrists.', 'Jump just high enough to clear the rope.', 'Land softly on the balls of your feet.']::text[], 3, '2-3 min', false, 'intermediate', 'plyometric', ARRAY['calves']::text[], ARRAY['quads']::text[]),
  ('burpee', null, 'Burpee', 'Cardio', 'Bodyweight', 'Full-body explosive conditioning.', ARRAY['Squat down and place hands on the floor.', 'Jump your feet back into a plank.', 'Do a push-up, then jump your feet forward.', 'Explode up into a jump.']::text[], 3, '10-15', false, 'intermediate', 'plyometric', ARRAY['chest', 'quads']::text[], ARRAY['frontDelts', 'triceps', 'abs']::text[]),
  ('kettlebell-swing', null, 'Kettlebell Swing', 'Cardio', 'Kettlebell', 'Explosive hip hinge for power and conditioning.', ARRAY['Stand with feet wider than hips, kettlebell in front.', 'Hike the bell between your legs.', 'Snap your hips forward to swing it to chest height.', 'Let it fall back and repeat.']::text[], 3, '15-20', false, 'intermediate', 'cardio', ARRAY['glutes', 'hamstrings']::text[], ARRAY['lowerBack', 'frontDelts', 'forearms']::text[]),
  ('stair-climber', null, 'Stair Climber', 'Cardio', 'Machine', 'Glute-heavy cardio. Log reps as minutes.', ARRAY['Step onto the machine and hold the rails lightly.', 'Set a steady pace.', 'Drive through your whole foot.', 'Stand tall — don''t lean on the rails.']::text[], 1, '15-20 min', false, 'beginner', 'cardio', ARRAY['quads', 'glutes']::text[], ARRAY['calves', 'hamstrings']::text[]),
  ('wrist-curl', null, 'Wrist Curl', 'Forearms', 'Dumbbell', 'Isolation for the wrist flexors on the inside of the forearm.', ARRAY['Sit with forearms on your thighs, palms up, wrists past your knees.', 'Let the dumbbells roll down to your fingertips.', 'Curl your wrists up as high as possible.', 'Lower slowly.']::text[], 3, '15-20', false, 'beginner', 'isolation', ARRAY['forearms']::text[], ARRAY[]::text[]),
  ('reverse-wrist-curl', null, 'Reverse Wrist Curl', 'Forearms', 'Dumbbell', 'Builds the wrist extensors on top of the forearm.', ARRAY['Rest forearms on your thighs, palms facing down.', 'Hold light dumbbells with wrists past your knees.', 'Raise the backs of your hands towards you.', 'Lower under control.']::text[], 3, '15-20', false, 'beginner', 'isolation', ARRAY['forearms']::text[], ARRAY[]::text[]),
  ('reverse-curl', null, 'Reverse Barbell Curl', 'Forearms', 'Barbell', 'Overhand curl that targets the brachioradialis and forearm extensors.', ARRAY['Hold a barbell with an overhand, shoulder-width grip.', 'Keep elbows pinned to your sides.', 'Curl the bar up to shoulder height.', 'Lower slowly to full extension.']::text[], 3, '10-15', false, 'intermediate', 'isolation', ARRAY['forearms', 'biceps']::text[], ARRAY[]::text[]),
  ('farmers-carry', null, 'Farmer''s Carry', 'Forearms', 'Dumbbell', 'Loaded carry for grip strength, traps and core stability. Log reps as metres or seconds.', ARRAY['Pick up heavy dumbbells with a neutral grip.', 'Stand tall with shoulders back and core braced.', 'Walk with short, controlled steps.', 'Set the weights down with a flat back.']::text[], 3, '30-40 m', false, 'beginner', 'mobility', ARRAY['forearms', 'traps']::text[], ARRAY['abs', 'obliques', 'upperBack']::text[]),
  ('dead-hang', null, 'Dead Hang', 'Forearms', 'Bodyweight', 'Grip endurance and shoulder decompression. Log reps as seconds.', ARRAY['Grab a pull-up bar with an overhand grip.', 'Hang with arms straight and shoulders engaged.', 'Breathe steadily and hold.', 'Drop down with control.']::text[], 3, '30-60 s', false, 'beginner', 'mobility', ARRAY['forearms']::text[], ARRAY['lats']::text[]),
  ('plate-pinch', null, 'Plate Pinch', 'Forearms', 'Other', 'Pinch-grip strength for the fingers and thumb. Log reps as seconds.', ARRAY['Place two smooth plates together, smooth sides out.', 'Pinch them between fingers and thumb.', 'Lift and hold at your side.', 'Set down before your grip fails.']::text[], 3, '20-40 s', false, 'intermediate', 'mobility', ARRAY['forearms']::text[], ARRAY[]::text[]),
  ('seated-calf-raise', null, 'Seated Calf Raise', 'Calves', 'Machine', 'Bent-knee calf raise that emphasises the soleus.', ARRAY['Sit with the pad on your lower thighs, balls of feet on the platform.', 'Release the safety and lower your heels for a deep stretch.', 'Press up onto your toes as high as possible.', 'Pause, then lower slowly.']::text[], 4, '12-15', false, 'beginner', 'isolation', ARRAY['calves']::text[], ARRAY[]::text[]),
  ('single-leg-calf-raise', null, 'Single-Leg Calf Raise', 'Calves', 'Bodyweight', 'Unilateral calf builder you can do anywhere.', ARRAY['Stand on one foot on the edge of a step, holding a support.', 'Lower your heel below the step.', 'Rise onto your toes as high as possible.', 'Complete all reps, then switch legs.']::text[], 3, '12-20', false, 'beginner', 'isolation', ARRAY['calves']::text[], ARRAY[]::text[]),
  ('leg-press-calf-raise', null, 'Leg Press Calf Raise', 'Calves', 'Machine', 'Heavy, stable calf raise on the leg press.', ARRAY['Sit in the leg press with balls of the feet on the bottom edge of the platform.', 'Extend your legs without locking the knees.', 'Push the platform away with your toes.', 'Return slowly to a deep stretch.']::text[], 4, '10-15', false, 'beginner', 'isolation', ARRAY['calves']::text[], ARRAY[]::text[]),
  ('seated-leg-curl', null, 'Seated Leg Curl', 'Hamstrings', 'Machine', 'Seated knee-flexion that trains the hamstrings in a lengthened position.', ARRAY['Adjust the machine so your knees line up with the pivot.', 'Lock the thigh pad down.', 'Curl your heels under the seat.', 'Return slowly to full extension.']::text[], 3, '10-12', false, 'beginner', 'isolation', ARRAY['hamstrings']::text[], ARRAY['calves']::text[]),
  ('nordic-curl', null, 'Nordic Hamstring Curl', 'Hamstrings', 'Bodyweight', 'Demanding eccentric exercise that builds strong, resilient hamstrings.', ARRAY['Kneel with ankles anchored under a pad or by a partner.', 'Keep hips extended and body straight.', 'Lower your torso towards the floor as slowly as possible.', 'Catch yourself with your hands and push back up.']::text[], 3, '4-8', false, 'advanced', 'isolation', ARRAY['hamstrings']::text[], ARRAY['calves', 'glutes']::text[]),
  ('good-morning', null, 'Good Morning', 'Hamstrings', 'Barbell', 'Hip hinge with the bar on your back for hamstrings and spinal erectors.', ARRAY['Place a barbell on your upper back as for a squat.', 'Soften your knees and brace your core.', 'Hinge at the hips, pushing them back until your torso is near parallel.', 'Drive your hips forward to stand up.']::text[], 3, '8-10', false, 'advanced', 'compound', ARRAY['hamstrings', 'lowerBack']::text[], ARRAY['glutes', 'upperBack']::text[]),
  ('dumbbell-romanian-deadlift', null, 'Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbell', 'Dumbbell hip hinge for the hamstrings and glutes.', ARRAY['Hold dumbbells in front of your thighs.', 'Push your hips back with a slight knee bend.', 'Lower the weights along your legs until you feel a stretch.', 'Squeeze your glutes to stand tall.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['hamstrings', 'glutes']::text[], ARRAY['lowerBack', 'forearms']::text[]),
  ('glute-ham-raise', null, 'Glute-Ham Raise', 'Hamstrings', 'Machine', 'Knee flexion and hip extension on a GHD bench.', ARRAY['Set up on the GHD with feet locked and knees just behind the pad.', 'Start upright with your body straight.', 'Lower forward under control.', 'Pull yourself back up with your hamstrings.']::text[], 3, '6-10', false, 'advanced', 'isolation', ARRAY['hamstrings']::text[], ARRAY['glutes', 'calves', 'lowerBack']::text[]),
  ('bodyweight-squat', null, 'Bodyweight Squat', 'Quadriceps', 'Bodyweight', 'Foundational squat pattern — great for warm-ups and beginners.', ARRAY['Stand with feet shoulder-width apart, toes slightly out.', 'Sit your hips back and down, chest up.', 'Squat until thighs are at least parallel.', 'Drive through your heels to stand.']::text[], 3, '15-20', false, 'beginner', 'compound', ARRAY['quads', 'glutes']::text[], ARRAY['adductors']::text[]),
  ('reverse-lunge', null, 'Reverse Lunge', 'Quadriceps', 'Dumbbell', 'Knee-friendly lunge variation for quads and glutes.', ARRAY['Stand tall holding dumbbells at your sides.', 'Step one foot back and lower until both knees are at 90°.', 'Push through the front heel to return.', 'Alternate legs.']::text[], 3, '10-12', false, 'intermediate', 'compound', ARRAY['quads', 'glutes']::text[], ARRAY['hamstrings', 'adductors']::text[]),
  ('smith-machine-squat', null, 'Smith Machine Squat', 'Quadriceps', 'Machine', 'Guided squat that lets you push hard with a fixed bar path.', ARRAY['Set the bar at shoulder height and step under it.', 'Place your feet slightly in front of the bar.', 'Unrack and squat to parallel or below.', 'Drive back up and re-rack.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['quads', 'glutes']::text[], ARRAY['adductors', 'hamstrings']::text[]),
  ('wall-sit', null, 'Wall Sit', 'Quadriceps', 'Bodyweight', 'Isometric quad endurance hold. Log reps as seconds.', ARRAY['Lean your back flat against a wall.', 'Slide down until knees are at 90°.', 'Keep weight in your heels.', 'Hold for time.']::text[], 3, '30-60 s', false, 'beginner', 'mobility', ARRAY['quads']::text[], ARRAY['glutes']::text[]),
  ('sissy-squat', null, 'Sissy Squat', 'Quadriceps', 'Bodyweight', 'Advanced quad isolation with the knees travelling forward.', ARRAY['Hold a support with one hand and rise onto your toes.', 'Lean back as your knees travel forward and down.', 'Lower until you feel a deep quad stretch.', 'Drive the knees back to stand.']::text[], 3, '8-12', false, 'advanced', 'isolation', ARRAY['quads']::text[], ARRAY['abs']::text[]),
  ('decline-bench-press', null, 'Decline Bench Press', 'Chest', 'Barbell', 'Pressing on a decline bench to emphasise the lower chest.', ARRAY['Secure your legs and lie back on a decline bench.', 'Unrack the bar with a slightly-wider-than-shoulder grip.', 'Lower to your lower chest.', 'Press back to lockout.']::text[], 3, '6-10', false, 'intermediate', 'compound', ARRAY['chest']::text[], ARRAY['triceps', 'frontDelts']::text[]),
  ('pec-deck', null, 'Pec Deck', 'Chest', 'Machine', 'Machine fly that keeps constant tension on the chest.', ARRAY['Adjust the seat so the handles are at chest height.', 'Grip the handles with a slight elbow bend.', 'Bring the handles together in front of you.', 'Open slowly to a full stretch.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['chest']::text[], ARRAY['frontDelts']::text[]),
  ('band-chest-press', null, 'Band Chest Press', 'Chest', 'Band', 'Standing chest press with a resistance band — perfect for home.', ARRAY['Anchor a band behind you at chest height.', 'Hold the handles at your chest, staggered stance.', 'Press forward until arms are straight.', 'Return slowly.']::text[], 3, '12-20', false, 'beginner', 'compound', ARRAY['chest']::text[], ARRAY['frontDelts', 'triceps']::text[]),
  ('inverted-row', null, 'Inverted Row', 'Back', 'Bodyweight', 'Bodyweight horizontal pull using a bar or rings.', ARRAY['Hang under a bar set at waist height, body straight.', 'Pull your chest to the bar.', 'Squeeze your shoulder blades.', 'Lower until arms are straight.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['upperBack', 'lats']::text[], ARRAY['biceps', 'rearDelts']::text[]),
  ('chest-supported-row', null, 'Chest-Supported Row', 'Back', 'Machine', 'Supported row that removes lower-back fatigue.', ARRAY['Lie face down on the pad with handles in front of you.', 'Row the handles towards your ribs.', 'Squeeze your upper back.', 'Extend arms slowly.']::text[], 3, '8-12', false, 'beginner', 'compound', ARRAY['upperBack', 'lats']::text[], ARRAY['rearDelts', 'biceps']::text[]),
  ('band-pull-apart', null, 'Band Pull-Apart', 'Back', 'Band', 'Rear-delt and upper-back activation for posture and shoulder health.', ARRAY['Hold a band at shoulder height with straight arms.', 'Pull the band apart until it touches your chest.', 'Squeeze your shoulder blades together.', 'Return slowly.']::text[], 3, '15-20', false, 'beginner', 'isolation', ARRAY['rearDelts', 'upperBack']::text[], ARRAY['traps']::text[]),
  ('back-extension', null, 'Back Extension', 'Back', 'Bodyweight', 'Hip extension on a Roman chair for lower back and glutes.', ARRAY['Set the pad just below your hips and lock your feet in.', 'Cross arms over your chest.', 'Lower your torso with a neutral spine.', 'Raise until your body is straight — don''t hyperextend.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['lowerBack']::text[], ARRAY['glutes', 'hamstrings']::text[]),
  ('machine-shoulder-press', null, 'Machine Shoulder Press', 'Shoulders', 'Machine', 'Stable overhead press for pushing close to failure safely.', ARRAY['Adjust the seat so the handles are at shoulder height.', 'Press the handles overhead.', 'Stop just short of lockout.', 'Lower under control.']::text[], 3, '8-12', false, 'beginner', 'compound', ARRAY['frontDelts']::text[], ARRAY['sideDelts', 'triceps']::text[]),
  ('kettlebell-press', null, 'Kettlebell Overhead Press', 'Shoulders', 'Kettlebell', 'Single-arm overhead press that challenges stability.', ARRAY['Clean a kettlebell to the rack position.', 'Brace your core and squeeze your glutes.', 'Press the bell overhead until your arm is straight.', 'Lower back to the rack.']::text[], 3, '6-10', false, 'intermediate', 'compound', ARRAY['frontDelts']::text[], ARRAY['sideDelts', 'triceps', 'obliques']::text[]),
  ('pike-push-up', null, 'Pike Push-Up', 'Shoulders', 'Bodyweight', 'Bodyweight overhead pressing for the shoulders.', ARRAY['Start in a downward-dog position, hips high.', 'Bend your elbows to lower your head towards the floor.', 'Press back up to straight arms.', 'Keep your hips high throughout.']::text[], 3, '8-12', false, 'intermediate', 'compound', ARRAY['frontDelts']::text[], ARRAY['triceps', 'upperBack']::text[]),
  ('concentration-curl', null, 'Concentration Curl', 'Biceps', 'Dumbbell', 'Seated, strict curl for a strong peak contraction.', ARRAY['Sit and brace your elbow against your inner thigh.', 'Curl the dumbbell towards your shoulder.', 'Squeeze at the top.', 'Lower slowly to full extension.']::text[], 3, '10-12', false, 'beginner', 'isolation', ARRAY['biceps']::text[], ARRAY[]::text[]),
  ('band-curl', null, 'Band Curl', 'Biceps', 'Band', 'Biceps curl with a resistance band.', ARRAY['Stand on the band and hold the handles.', 'Keep elbows at your sides.', 'Curl your hands to your shoulders.', 'Lower under control.']::text[], 3, '12-20', false, 'beginner', 'isolation', ARRAY['biceps']::text[], ARRAY['forearms']::text[]),
  ('ez-bar-curl', null, 'EZ-Bar Curl', 'Biceps', 'Barbell', 'Curl with an angled bar that is easier on the wrists.', ARRAY['Grip the EZ bar on the inner angles.', 'Stand tall with elbows by your sides.', 'Curl the bar up to your chest.', 'Lower slowly.']::text[], 3, '8-12', false, 'intermediate', 'isolation', ARRAY['biceps']::text[], ARRAY['forearms']::text[]),
  ('diamond-push-up', null, 'Diamond Push-Up', 'Triceps', 'Bodyweight', 'Close-hand push-up that shifts the work to the triceps.', ARRAY['Place your hands together under your chest, forming a diamond.', 'Keep your body in a straight line.', 'Lower your chest to your hands.', 'Press back up.']::text[], 3, '8-15', false, 'intermediate', 'compound', ARRAY['triceps']::text[], ARRAY['chest', 'frontDelts']::text[]),
  ('rope-overhead-extension', null, 'Cable Overhead Extension', 'Triceps', 'Cable', 'Overhead triceps extension with a rope for a deep long-head stretch.', ARRAY['Face away from a low pulley holding a rope behind your head.', 'Stagger your stance and lean forward slightly.', 'Extend your arms overhead.', 'Return slowly to a deep stretch.']::text[], 3, '10-15', false, 'intermediate', 'isolation', ARRAY['triceps']::text[], ARRAY[]::text[]),
  ('cable-pull-through', null, 'Cable Pull-Through', 'Glutes', 'Cable', 'Hip hinge with a low cable for the glutes and hamstrings.', ARRAY['Face away from a low pulley holding a rope between your legs.', 'Hinge at the hips, letting the rope travel back.', 'Drive your hips forward to stand tall.', 'Squeeze your glutes at the top.']::text[], 3, '12-15', false, 'intermediate', 'isolation', ARRAY['glutes', 'hamstrings']::text[], ARRAY['lowerBack']::text[]),
  ('lateral-band-walk', null, 'Lateral Band Walk', 'Glutes', 'Band', 'Banded side steps for the glute medius.', ARRAY['Place a mini band above your knees or around your ankles.', 'Sit into a quarter squat.', 'Step sideways keeping tension on the band.', 'Complete the reps, then return the other way.']::text[], 3, '12-15', false, 'beginner', 'isolation', ARRAY['glutes']::text[], ARRAY['adductors']::text[]),
  ('single-leg-glute-bridge', null, 'Single-Leg Glute Bridge', 'Glutes', 'Bodyweight', 'Unilateral bridge for glute strength and balance.', ARRAY['Lie on your back with one knee bent and the other leg straight.', 'Drive through the planted heel to lift your hips.', 'Squeeze your glute at the top.', 'Lower and repeat, then switch sides.']::text[], 3, '10-12', false, 'beginner', 'isolation', ARRAY['glutes']::text[], ARRAY['hamstrings']::text[]),
  ('dead-bug', null, 'Dead Bug', 'Abs', 'Bodyweight', 'Beginner-friendly anti-extension core exercise.', ARRAY['Lie on your back with arms up and knees at 90°.', 'Press your lower back into the floor.', 'Extend the opposite arm and leg slowly.', 'Return and alternate sides.']::text[], 3, '10-12', false, 'beginner', 'mobility', ARRAY['abs']::text[], ARRAY['obliques']::text[]),
  ('side-plank', null, 'Side Plank', 'Abs', 'Bodyweight', 'Lateral core stability for the obliques. Log reps as seconds.', ARRAY['Lie on your side and prop yourself on your forearm.', 'Lift your hips so your body is straight.', 'Hold without letting the hips drop.', 'Switch sides.']::text[], 3, '30-45 s', false, 'beginner', 'mobility', ARRAY['obliques']::text[], ARRAY['abs']::text[]),
  ('bicycle-crunch', null, 'Bicycle Crunch', 'Abs', 'Bodyweight', 'Rotational crunch for the abs and obliques.', ARRAY['Lie on your back with hands behind your head.', 'Bring one knee in while rotating the opposite elbow towards it.', 'Switch sides in a pedalling motion.', 'Keep your lower back on the floor.']::text[], 3, '20-30', false, 'beginner', 'isolation', ARRAY['abs', 'obliques']::text[], ARRAY[]::text[]),
  ('pallof-press', null, 'Pallof Press', 'Abs', 'Cable', 'Anti-rotation press that builds a stable core.', ARRAY['Stand side-on to a cable at chest height.', 'Hold the handle at your chest.', 'Press it straight out without letting your torso rotate.', 'Return slowly and switch sides.']::text[], 3, '10-12', false, 'intermediate', 'mobility', ARRAY['obliques', 'abs']::text[], ARRAY[]::text[]),
  ('mountain-climber', null, 'Mountain Climber', 'Abs', 'Bodyweight', 'Dynamic core and conditioning drill.', ARRAY['Start in a high plank.', 'Drive one knee towards your chest.', 'Quickly switch legs.', 'Keep your hips level.']::text[], 3, '20-30', false, 'intermediate', 'isolation', ARRAY['abs']::text[], ARRAY['frontDelts', 'quads']::text[]),
  ('elliptical', null, 'Elliptical', 'Cardio', 'Machine', 'Low-impact full-body cardio. Log reps as minutes.', ARRAY['Step on and hold the handles.', 'Start at a comfortable resistance.', 'Push and pull with arms and legs.', 'Keep a steady pace.']::text[], 1, '20-30 min', false, 'beginner', 'cardio', ARRAY['quads', 'glutes']::text[], ARRAY['hamstrings', 'calves']::text[]),
  ('assault-bike', null, 'Air Bike', 'Cardio', 'Machine', 'Fan bike intervals for brutal conditioning. Log reps as calories or minutes.', ARRAY['Adjust the seat height.', 'Push and pull the handles while pedalling.', 'Go all-out for the work interval.', 'Recover at an easy pace.']::text[], 5, '30 s', false, 'advanced', 'cardio', ARRAY['quads']::text[], ARRAY['glutes', 'frontDelts', 'triceps']::text[]),
  ('box-jump', null, 'Box Jump', 'Cardio', 'Bodyweight', 'Explosive plyometric jump for power.', ARRAY['Stand in front of a sturdy box.', 'Swing your arms and jump onto the box.', 'Land softly with both feet.', 'Step down and reset.']::text[], 4, '5-8', false, 'advanced', 'plyometric', ARRAY['quads', 'glutes']::text[], ARRAY['calves', 'hamstrings']::text[]),
  ('jumping-jacks', null, 'Jumping Jacks', 'Cardio', 'Bodyweight', 'Classic warm-up and conditioning movement.', ARRAY['Stand with feet together and arms at your sides.', 'Jump your feet out while raising your arms overhead.', 'Jump back to the start.', 'Keep a steady rhythm.']::text[], 3, '30-50', false, 'beginner', 'plyometric', ARRAY['calves']::text[], ARRAY['sideDelts', 'quads']::text[]),
  ('sprint-intervals', null, 'Sprint Intervals', 'Cardio', 'Bodyweight', 'Short, maximal sprints with recovery. Log reps as seconds.', ARRAY['Warm up thoroughly.', 'Sprint at near-maximal effort.', 'Walk or jog to recover.', 'Repeat for the planned rounds.']::text[], 6, '20-30 s', false, 'advanced', 'cardio', ARRAY['hamstrings', 'quads', 'glutes']::text[], ARRAY['calves']::text[]),
  ('battle-ropes', null, 'Battle Ropes', 'Cardio', 'Other', 'Upper-body conditioning with heavy ropes. Log reps as seconds.', ARRAY['Hold one rope end in each hand, athletic stance.', 'Alternate arms to create waves.', 'Keep your core braced and hips low.', 'Work for the interval, then rest.']::text[], 4, '30 s', false, 'intermediate', 'cardio', ARRAY['frontDelts', 'sideDelts']::text[], ARRAY['forearms', 'abs']::text[])
on conflict (id) do update set
  name = excluded.name, muscle_group = excluded.muscle_group, equipment = excluded.equipment,
  description = excluded.description, instructions = excluded.instructions,
  recommended_sets = excluded.recommended_sets, recommended_reps = excluded.recommended_reps,
  difficulty = excluded.difficulty, exercise_type = excluded.exercise_type,
  primary_muscles = excluded.primary_muscles, secondary_muscles = excluded.secondary_muscles;

-- ---------------------------------------------------------------------------
-- Seed: built-in food database (146 foods, values per 100 g). Auto-generated.
-- ---------------------------------------------------------------------------
insert into public.foods (id, user_id, name, category, calories, protein, carbs, fat, serving_grams, serving_label, source)
values
  ('food-chicken-breast-cooked', null, 'Chicken breast, cooked', 'Meat & Poultry', 165, 31, 0, 3.6, 150, '1 breast', 'builtin'),
  ('food-chicken-breast-raw', null, 'Chicken breast, raw', 'Meat & Poultry', 120, 22.5, 0, 2.6, 150, null, 'builtin'),
  ('food-chicken-thigh-cooked', null, 'Chicken thigh, cooked (skinless)', 'Meat & Poultry', 209, 26, 0, 10.9, 120, null, 'builtin'),
  ('food-turkey-breast', null, 'Turkey breast, roasted', 'Meat & Poultry', 147, 30, 0, 2.1, 120, null, 'builtin'),
  ('food-beef-mince-5', null, 'Beef mince 5% fat, cooked', 'Meat & Poultry', 174, 26, 0, 7.5, 125, null, 'builtin'),
  ('food-beef-mince-20', null, 'Beef mince 20% fat, cooked', 'Meat & Poultry', 254, 26, 0, 17, 125, null, 'builtin'),
  ('food-sirloin-steak', null, 'Sirloin steak, grilled', 'Meat & Poultry', 206, 29, 0, 9.5, 200, '1 steak', 'builtin'),
  ('food-pork-loin', null, 'Pork loin, roasted', 'Meat & Poultry', 196, 27, 0, 9, 150, null, 'builtin'),
  ('food-bacon', null, 'Bacon, cooked', 'Meat & Poultry', 541, 37, 1.4, 42, 15, '1 slice', 'builtin'),
  ('food-ham', null, 'Ham, sliced', 'Meat & Poultry', 145, 21, 1.5, 6, 30, '1 slice', 'builtin'),
  ('food-lamb-chop', null, 'Lamb chop, grilled', 'Meat & Poultry', 282, 25, 0, 20, 100, null, 'builtin'),
  ('food-chicken-sausage', null, 'Chicken sausage', 'Meat & Poultry', 172, 16, 4, 10, 70, '1 sausage', 'builtin'),
  ('food-beef-jerky', null, 'Beef jerky', 'Meat & Poultry', 410, 33, 11, 25.6, 28, null, 'builtin'),
  ('food-salmon-cooked', null, 'Salmon, baked', 'Fish & Seafood', 206, 22, 0, 12.4, 150, '1 fillet', 'builtin'),
  ('food-tuna-canned-water', null, 'Tuna, canned in water', 'Fish & Seafood', 116, 25.5, 0, 0.8, 120, '1 can drained', 'builtin'),
  ('food-cod-cooked', null, 'Cod, baked', 'Fish & Seafood', 105, 23, 0, 0.9, 150, null, 'builtin'),
  ('food-shrimp-cooked', null, 'Shrimp / prawns, cooked', 'Fish & Seafood', 99, 24, 0.2, 0.3, 100, null, 'builtin'),
  ('food-tilapia', null, 'Tilapia, baked', 'Fish & Seafood', 128, 26, 0, 2.7, 120, null, 'builtin'),
  ('food-sardines', null, 'Sardines, canned in oil', 'Fish & Seafood', 208, 24.6, 0, 11.5, 90, null, 'builtin'),
  ('food-mackerel', null, 'Mackerel, grilled', 'Fish & Seafood', 262, 24, 0, 17.8, 100, null, 'builtin'),
  ('food-smoked-salmon', null, 'Smoked salmon', 'Fish & Seafood', 117, 18.3, 0, 4.3, 50, null, 'builtin'),
  ('food-egg-whole', null, 'Egg, whole (boiled)', 'Dairy & Eggs', 155, 12.6, 1.1, 10.6, 50, '1 large egg', 'builtin'),
  ('food-egg-white', null, 'Egg white', 'Dairy & Eggs', 52, 10.9, 0.7, 0.2, 33, '1 egg white', 'builtin'),
  ('food-greek-yogurt-0', null, 'Greek yogurt, 0% fat', 'Dairy & Eggs', 59, 10.3, 3.6, 0.4, 170, '1 pot', 'builtin'),
  ('food-greek-yogurt-full', null, 'Greek yogurt, full fat', 'Dairy & Eggs', 97, 9, 4, 5, 170, '1 pot', 'builtin'),
  ('food-skyr', null, 'Skyr, plain', 'Dairy & Eggs', 63, 11, 4, 0.2, 150, null, 'builtin'),
  ('food-cottage-cheese', null, 'Cottage cheese', 'Dairy & Eggs', 98, 11, 3.4, 4.3, 150, null, 'builtin'),
  ('food-milk-whole', null, 'Milk, whole', 'Dairy & Eggs', 61, 3.2, 4.8, 3.3, 250, '1 glass', 'builtin'),
  ('food-milk-semi', null, 'Milk, semi-skimmed', 'Dairy & Eggs', 47, 3.4, 4.8, 1.6, 250, '1 glass', 'builtin'),
  ('food-milk-skim', null, 'Milk, skimmed', 'Dairy & Eggs', 34, 3.4, 5, 0.1, 250, '1 glass', 'builtin'),
  ('food-cheddar', null, 'Cheddar cheese', 'Dairy & Eggs', 403, 25, 1.3, 33, 30, null, 'builtin'),
  ('food-mozzarella', null, 'Mozzarella', 'Dairy & Eggs', 280, 28, 3.1, 17, 30, null, 'builtin'),
  ('food-parmesan', null, 'Parmesan', 'Dairy & Eggs', 431, 38, 4.1, 29, 10, null, 'builtin'),
  ('food-feta', null, 'Feta', 'Dairy & Eggs', 264, 14, 4.1, 21, 30, null, 'builtin'),
  ('food-butter', null, 'Butter', 'Dairy & Eggs', 717, 0.9, 0.1, 81, 10, '1 tsp', 'builtin'),
  ('food-cream-cheese', null, 'Cream cheese', 'Dairy & Eggs', 342, 6, 4.1, 34, 30, null, 'builtin'),
  ('food-oats', null, 'Rolled oats', 'Grains & Bread', 379, 13.2, 67.7, 6.5, 40, '½ cup', 'builtin'),
  ('food-whole-wheat-bread', null, 'Whole-wheat bread', 'Grains & Bread', 247, 13, 41, 3.4, 35, '1 slice', 'builtin'),
  ('food-white-bread', null, 'White bread', 'Grains & Bread', 265, 9, 49, 3.2, 30, '1 slice', 'builtin'),
  ('food-sourdough', null, 'Sourdough bread', 'Grains & Bread', 289, 11.8, 56, 1.8, 50, '1 slice', 'builtin'),
  ('food-bagel', null, 'Bagel, plain', 'Grains & Bread', 250, 10, 49, 1.5, 100, '1 bagel', 'builtin'),
  ('food-tortilla', null, 'Flour tortilla', 'Grains & Bread', 312, 8.3, 51.6, 8, 45, '1 wrap', 'builtin'),
  ('food-corn-flakes', null, 'Corn flakes', 'Grains & Bread', 357, 7.5, 84, 0.4, 30, null, 'builtin'),
  ('food-granola', null, 'Granola', 'Grains & Bread', 471, 10, 64, 20, 45, null, 'builtin'),
  ('food-rice-cakes', null, 'Rice cakes', 'Grains & Bread', 387, 8, 81.5, 2.8, 9, '1 cake', 'builtin'),
  ('food-pita', null, 'Pita bread', 'Grains & Bread', 275, 9.1, 55.7, 1.2, 60, '1 pita', 'builtin'),
  ('food-croissant', null, 'Croissant', 'Grains & Bread', 406, 8.2, 45.8, 21, 60, '1 croissant', 'builtin'),
  ('food-white-rice-cooked', null, 'White rice, cooked', 'Pasta & Rice', 130, 2.7, 28.2, 0.3, 180, '1 cup', 'builtin'),
  ('food-brown-rice-cooked', null, 'Brown rice, cooked', 'Pasta & Rice', 123, 2.7, 25.6, 1, 180, '1 cup', 'builtin'),
  ('food-basmati-cooked', null, 'Basmati rice, cooked', 'Pasta & Rice', 121, 3.5, 25.2, 0.4, 180, null, 'builtin'),
  ('food-pasta-cooked', null, 'Pasta, cooked', 'Pasta & Rice', 158, 5.8, 30.9, 0.9, 200, null, 'builtin'),
  ('food-pasta-dry', null, 'Pasta, dry', 'Pasta & Rice', 371, 13, 74.7, 1.5, 80, null, 'builtin'),
  ('food-wholewheat-pasta-cooked', null, 'Whole-wheat pasta, cooked', 'Pasta & Rice', 149, 6, 30, 1.7, 200, null, 'builtin'),
  ('food-quinoa-cooked', null, 'Quinoa, cooked', 'Pasta & Rice', 120, 4.4, 21.3, 1.9, 185, '1 cup', 'builtin'),
  ('food-couscous-cooked', null, 'Couscous, cooked', 'Pasta & Rice', 112, 3.8, 23.2, 0.2, 160, null, 'builtin'),
  ('food-egg-noodles-cooked', null, 'Egg noodles, cooked', 'Pasta & Rice', 138, 4.5, 25.2, 2.1, 160, null, 'builtin'),
  ('food-potato-boiled', null, 'Potato, boiled', 'Pasta & Rice', 87, 1.9, 20.1, 0.1, 200, '1 medium', 'builtin'),
  ('food-sweet-potato-baked', null, 'Sweet potato, baked', 'Pasta & Rice', 90, 2, 20.7, 0.2, 150, '1 medium', 'builtin'),
  ('food-fries', null, 'French fries', 'Pasta & Rice', 312, 3.4, 41, 15, 120, '1 portion', 'builtin'),
  ('food-banana', null, 'Banana', 'Fruit', 89, 1.1, 22.8, 0.3, 118, '1 medium', 'builtin'),
  ('food-apple', null, 'Apple', 'Fruit', 52, 0.3, 13.8, 0.2, 182, '1 medium', 'builtin'),
  ('food-orange', null, 'Orange', 'Fruit', 47, 0.9, 11.8, 0.1, 131, '1 medium', 'builtin'),
  ('food-blueberries', null, 'Blueberries', 'Fruit', 57, 0.7, 14.5, 0.3, 80, null, 'builtin'),
  ('food-strawberries', null, 'Strawberries', 'Fruit', 32, 0.7, 7.7, 0.3, 150, null, 'builtin'),
  ('food-raspberries', null, 'Raspberries', 'Fruit', 52, 1.2, 11.9, 0.7, 80, null, 'builtin'),
  ('food-grapes', null, 'Grapes', 'Fruit', 69, 0.7, 18.1, 0.2, 100, null, 'builtin'),
  ('food-mango', null, 'Mango', 'Fruit', 60, 0.8, 15, 0.4, 165, null, 'builtin'),
  ('food-pineapple', null, 'Pineapple', 'Fruit', 50, 0.5, 13.1, 0.1, 165, null, 'builtin'),
  ('food-watermelon', null, 'Watermelon', 'Fruit', 30, 0.6, 7.6, 0.2, 280, null, 'builtin'),
  ('food-kiwi', null, 'Kiwi', 'Fruit', 61, 1.1, 14.7, 0.5, 70, '1 kiwi', 'builtin'),
  ('food-pear', null, 'Pear', 'Fruit', 57, 0.4, 15.2, 0.1, 178, '1 medium', 'builtin'),
  ('food-dates', null, 'Dates, dried', 'Fruit', 282, 2.5, 75, 0.4, 24, '3 dates', 'builtin'),
  ('food-raisins', null, 'Raisins', 'Fruit', 299, 3.1, 79.2, 0.5, 30, null, 'builtin'),
  ('food-avocado', null, 'Avocado', 'Fruit', 160, 2, 8.5, 14.7, 75, '½ avocado', 'builtin'),
  ('food-broccoli', null, 'Broccoli', 'Vegetables', 34, 2.8, 6.6, 0.4, 90, null, 'builtin'),
  ('food-spinach', null, 'Spinach', 'Vegetables', 23, 2.9, 3.6, 0.4, 30, null, 'builtin'),
  ('food-carrot', null, 'Carrot', 'Vegetables', 41, 0.9, 9.6, 0.2, 60, '1 medium', 'builtin'),
  ('food-tomato', null, 'Tomato', 'Vegetables', 18, 0.9, 3.9, 0.2, 120, '1 medium', 'builtin'),
  ('food-cucumber', null, 'Cucumber', 'Vegetables', 15, 0.7, 3.6, 0.1, 100, null, 'builtin'),
  ('food-bell-pepper', null, 'Bell pepper', 'Vegetables', 31, 1, 6, 0.3, 120, null, 'builtin'),
  ('food-lettuce', null, 'Lettuce / mixed salad', 'Vegetables', 15, 1.4, 2.9, 0.2, 50, null, 'builtin'),
  ('food-onion', null, 'Onion', 'Vegetables', 40, 1.1, 9.3, 0.1, 110, null, 'builtin'),
  ('food-mushrooms', null, 'Mushrooms', 'Vegetables', 22, 3.1, 3.3, 0.3, 70, null, 'builtin'),
  ('food-zucchini', null, 'Zucchini / courgette', 'Vegetables', 17, 1.2, 3.1, 0.3, 120, null, 'builtin'),
  ('food-green-beans', null, 'Green beans', 'Vegetables', 31, 1.8, 7, 0.2, 100, null, 'builtin'),
  ('food-sweet-corn', null, 'Sweet corn', 'Vegetables', 86, 3.3, 19, 1.4, 80, null, 'builtin'),
  ('food-peas', null, 'Green peas', 'Vegetables', 81, 5.4, 14.5, 0.4, 80, null, 'builtin'),
  ('food-cauliflower', null, 'Cauliflower', 'Vegetables', 25, 1.9, 5, 0.3, 100, null, 'builtin'),
  ('food-asparagus', null, 'Asparagus', 'Vegetables', 20, 2.2, 3.9, 0.1, 90, null, 'builtin'),
  ('food-lentils-cooked', null, 'Lentils, cooked', 'Legumes', 116, 9, 20.1, 0.4, 200, null, 'builtin'),
  ('food-chickpeas-cooked', null, 'Chickpeas, cooked', 'Legumes', 164, 8.9, 27.4, 2.6, 160, null, 'builtin'),
  ('food-black-beans-cooked', null, 'Black beans, cooked', 'Legumes', 132, 8.9, 23.7, 0.5, 170, null, 'builtin'),
  ('food-kidney-beans-cooked', null, 'Kidney beans, cooked', 'Legumes', 127, 8.7, 22.8, 0.5, 170, null, 'builtin'),
  ('food-edamame', null, 'Edamame', 'Legumes', 121, 11.9, 8.9, 5.2, 100, null, 'builtin'),
  ('food-tofu-firm', null, 'Tofu, firm', 'Legumes', 144, 17.3, 2.8, 8.7, 125, null, 'builtin'),
  ('food-tempeh', null, 'Tempeh', 'Legumes', 192, 20.3, 7.6, 10.8, 100, null, 'builtin'),
  ('food-hummus', null, 'Hummus', 'Legumes', 166, 7.9, 14.3, 9.6, 30, '2 tbsp', 'builtin'),
  ('food-baked-beans', null, 'Baked beans in tomato sauce', 'Legumes', 94, 4.8, 14, 0.4, 200, '½ can', 'builtin'),
  ('food-almonds', null, 'Almonds', 'Nuts & Seeds', 579, 21.2, 21.6, 49.9, 28, 'handful', 'builtin'),
  ('food-peanuts', null, 'Peanuts, roasted', 'Nuts & Seeds', 585, 23.7, 21.5, 49.7, 28, 'handful', 'builtin'),
  ('food-walnuts', null, 'Walnuts', 'Nuts & Seeds', 654, 15.2, 13.7, 65.2, 28, 'handful', 'builtin'),
  ('food-cashews', null, 'Cashews', 'Nuts & Seeds', 553, 18.2, 30.2, 43.9, 28, 'handful', 'builtin'),
  ('food-peanut-butter', null, 'Peanut butter', 'Nuts & Seeds', 588, 25, 20, 50, 32, '2 tbsp', 'builtin'),
  ('food-almond-butter', null, 'Almond butter', 'Nuts & Seeds', 614, 21, 18.8, 55.5, 32, '2 tbsp', 'builtin'),
  ('food-chia-seeds', null, 'Chia seeds', 'Nuts & Seeds', 486, 16.5, 42.1, 30.7, 15, '1 tbsp', 'builtin'),
  ('food-flaxseed', null, 'Flaxseed, ground', 'Nuts & Seeds', 534, 18.3, 28.9, 42.2, 10, '1 tbsp', 'builtin'),
  ('food-pumpkin-seeds', null, 'Pumpkin seeds', 'Nuts & Seeds', 559, 30.2, 10.7, 49, 30, null, 'builtin'),
  ('food-sunflower-seeds', null, 'Sunflower seeds', 'Nuts & Seeds', 584, 20.8, 20, 51.5, 30, null, 'builtin'),
  ('food-olive-oil', null, 'Olive oil', 'Fats & Oils', 884, 0, 0, 100, 10, '1 tbsp', 'builtin'),
  ('food-coconut-oil', null, 'Coconut oil', 'Fats & Oils', 862, 0, 0, 100, 10, '1 tbsp', 'builtin'),
  ('food-mayonnaise', null, 'Mayonnaise', 'Fats & Oils', 680, 1, 0.6, 75, 15, '1 tbsp', 'builtin'),
  ('food-pesto', null, 'Pesto', 'Fats & Oils', 418, 5, 6, 41, 15, '1 tbsp', 'builtin'),
  ('food-dark-chocolate', null, 'Dark chocolate 70%', 'Snacks & Sweets', 598, 7.8, 45.9, 42.6, 20, '2 squares', 'builtin'),
  ('food-milk-chocolate', null, 'Milk chocolate', 'Snacks & Sweets', 535, 7.6, 59.4, 29.7, 25, null, 'builtin'),
  ('food-potato-chips', null, 'Potato chips / crisps', 'Snacks & Sweets', 536, 7, 53, 34.6, 30, '1 small bag', 'builtin'),
  ('food-popcorn', null, 'Popcorn, air-popped', 'Snacks & Sweets', 387, 12.9, 77.8, 4.5, 25, null, 'builtin'),
  ('food-protein-bar', null, 'Protein bar (typical)', 'Snacks & Sweets', 360, 32, 38, 12, 60, '1 bar', 'builtin'),
  ('food-granola-bar', null, 'Granola bar', 'Snacks & Sweets', 471, 10.1, 64.4, 19.8, 25, '1 bar', 'builtin'),
  ('food-honey', null, 'Honey', 'Snacks & Sweets', 304, 0.3, 82.4, 0, 21, '1 tbsp', 'builtin'),
  ('food-ice-cream', null, 'Ice cream, vanilla', 'Snacks & Sweets', 207, 3.5, 23.6, 11, 66, '1 scoop', 'builtin'),
  ('food-cookie', null, 'Chocolate chip cookie', 'Snacks & Sweets', 488, 5.4, 64, 24, 15, '1 cookie', 'builtin'),
  ('food-jam', null, 'Jam', 'Snacks & Sweets', 278, 0.4, 68.9, 0.1, 20, '1 tbsp', 'builtin'),
  ('food-orange-juice', null, 'Orange juice', 'Drinks', 45, 0.7, 10.4, 0.2, 250, '1 glass', 'builtin'),
  ('food-cola', null, 'Cola', 'Drinks', 42, 0, 10.6, 0, 330, '1 can', 'builtin'),
  ('food-beer', null, 'Beer', 'Drinks', 43, 0.5, 3.6, 0, 330, '1 bottle', 'builtin'),
  ('food-red-wine', null, 'Red wine', 'Drinks', 85, 0.1, 2.6, 0, 150, '1 glass', 'builtin'),
  ('food-oat-milk', null, 'Oat milk', 'Drinks', 46, 1, 6.7, 1.5, 250, '1 glass', 'builtin'),
  ('food-almond-milk', null, 'Almond milk, unsweetened', 'Drinks', 15, 0.6, 0.3, 1.1, 250, '1 glass', 'builtin'),
  ('food-soy-milk', null, 'Soy milk', 'Drinks', 43, 3.3, 2.5, 1.8, 250, '1 glass', 'builtin'),
  ('food-latte', null, 'Caffè latte (whole milk)', 'Drinks', 56, 3, 4.7, 3, 300, '1 grande', 'builtin'),
  ('food-coffee-black', null, 'Coffee, black', 'Drinks', 1, 0.1, 0, 0, 240, '1 cup', 'builtin'),
  ('food-sports-drink', null, 'Sports drink', 'Drinks', 26, 0, 6.4, 0, 500, '1 bottle', 'builtin'),
  ('food-whey-protein', null, 'Whey protein powder', 'Supplements', 400, 80, 8, 6, 30, '1 scoop', 'builtin'),
  ('food-casein-protein', null, 'Casein protein powder', 'Supplements', 360, 80, 6, 2, 30, '1 scoop', 'builtin'),
  ('food-plant-protein', null, 'Plant protein powder', 'Supplements', 380, 72, 10, 7, 30, '1 scoop', 'builtin'),
  ('food-mass-gainer', null, 'Mass gainer powder', 'Supplements', 380, 15, 75, 2, 100, '1 serving', 'builtin'),
  ('food-creatine', null, 'Creatine monohydrate', 'Supplements', 0, 0, 0, 0, 5, '1 tsp', 'builtin'),
  ('food-pizza-margherita', null, 'Pizza margherita', 'Prepared Meals', 250, 11, 31, 9, 300, '½ pizza', 'builtin'),
  ('food-cheeseburger', null, 'Cheeseburger', 'Prepared Meals', 263, 13, 25, 12.5, 200, '1 burger', 'builtin'),
  ('food-chicken-wrap', null, 'Chicken wrap', 'Prepared Meals', 210, 13, 22, 7.5, 250, '1 wrap', 'builtin'),
  ('food-sushi-salmon', null, 'Salmon sushi rolls', 'Prepared Meals', 150, 6, 25, 3, 200, '8 pieces', 'builtin'),
  ('food-caesar-salad', null, 'Chicken Caesar salad', 'Prepared Meals', 130, 10, 5, 8, 300, '1 bowl', 'builtin'),
  ('food-spaghetti-bolognese', null, 'Spaghetti bolognese', 'Prepared Meals', 140, 7.5, 17, 4.5, 400, '1 plate', 'builtin'),
  ('food-chicken-curry-rice', null, 'Chicken curry with rice', 'Prepared Meals', 145, 8, 18, 4.5, 450, '1 plate', 'builtin'),
  ('food-burrito-bowl', null, 'Burrito bowl', 'Prepared Meals', 135, 8, 16, 4.5, 450, '1 bowl', 'builtin'),
  ('food-overnight-oats', null, 'Overnight oats', 'Prepared Meals', 150, 6, 22, 4.5, 250, '1 jar', 'builtin')
on conflict (id) do update set
  name = excluded.name, category = excluded.category, calories = excluded.calories, protein = excluded.protein,
  carbs = excluded.carbs, fat = excluded.fat, serving_grams = excluded.serving_grams, serving_label = excluded.serving_label;
