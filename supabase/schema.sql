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

-- ---------------------------------------------------------------------------
-- Seed: built-in exercise library (70 exercises). Auto-generated.
-- ---------------------------------------------------------------------------
insert into public.exercises (id, user_id, name, muscle_group, equipment, description, instructions, recommended_sets, recommended_reps, is_custom)
values
  ('bench-press', null, 'Bench Press', 'Chest', 'Barbell', 'The king of upper-body pressing. Builds chest, front delts and triceps.', ARRAY['Lie on the bench with eyes under the bar and feet flat on the floor.', 'Grip the bar slightly wider than shoulder width and unrack it.', 'Lower the bar under control to your mid-chest, elbows at ~45°.', 'Press the bar back up until your arms are locked out.']::text[], 4, '5-8', false),
  ('incline-bench-press', null, 'Incline Bench Press', 'Chest', 'Barbell', 'Pressing on a 30–45° incline to emphasise the upper chest.', ARRAY['Set the bench to a 30–45° incline.', 'Unrack the bar with a slightly-wider-than-shoulder grip.', 'Lower to the upper chest just below the collarbone.', 'Drive the bar up and slightly back to lockout.']::text[], 4, '6-10', false),
  ('dumbbell-bench-press', null, 'Dumbbell Bench Press', 'Chest', 'Dumbbell', 'Flat press with dumbbells for a greater range of motion and balanced strength.', ARRAY['Sit with dumbbells on your thighs, then lie back and bring them to chest level.', 'Press the dumbbells up until arms are straight.', 'Lower slowly until you feel a stretch in the chest.', 'Press back up, bringing the dumbbells slightly together.']::text[], 3, '8-12', false),
  ('incline-dumbbell-press', null, 'Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Upper chest builder with independent arms.', ARRAY['Set the bench to 30–45°.', 'Start with dumbbells at shoulder level, palms forward.', 'Press up and slightly inward.', 'Lower under control to a deep stretch.']::text[], 3, '8-12', false),
  ('dumbbell-fly', null, 'Dumbbell Fly', 'Chest', 'Dumbbell', 'Isolation movement that stretches and contracts the pecs.', ARRAY['Lie flat holding dumbbells above your chest with a slight elbow bend.', 'Open your arms in a wide arc until you feel a stretch.', 'Squeeze your chest to bring the weights back together.', 'Keep the elbow angle constant throughout.']::text[], 3, '10-15', false),
  ('cable-crossover', null, 'Cable Crossover', 'Chest', 'Cable', 'Constant-tension chest isolation from high pulleys.', ARRAY['Set pulleys high and grab a handle in each hand.', 'Step forward into a staggered stance with a slight lean.', 'Bring hands together in front of your hips in an arc.', 'Return slowly until you feel a stretch.']::text[], 3, '12-15', false),
  ('chest-press-machine', null, 'Chest Press Machine', 'Chest', 'Machine', 'Stable machine press — great for pushing close to failure safely.', ARRAY['Adjust the seat so the handles are at mid-chest height.', 'Press the handles forward until arms are extended.', 'Return slowly without letting the stack touch.', 'Keep shoulder blades pinned to the pad.']::text[], 3, '10-12', false),
  ('push-up', null, 'Push-Up', 'Chest', 'Bodyweight', 'Classic bodyweight press for chest, shoulders and triceps.', ARRAY['Start in a high plank with hands slightly wider than shoulders.', 'Brace your core and keep a straight line from head to heels.', 'Lower your chest to just above the floor.', 'Push back up to full extension.']::text[], 3, '10-20', false),
  ('chest-dip', null, 'Chest Dip', 'Chest', 'Bodyweight', 'Forward-leaning dip variation that hits the lower chest.', ARRAY['Support yourself on parallel bars with arms straight.', 'Lean your torso forward slightly.', 'Lower until your shoulders are just below elbows.', 'Press back up to lockout.']::text[], 3, '8-12', false),
  ('deadlift', null, 'Deadlift', 'Back', 'Barbell', 'Full posterior-chain lift building raw strength in the back, glutes and hamstrings.', ARRAY['Stand with mid-foot under the bar, feet hip-width apart.', 'Hinge and grip the bar just outside your legs.', 'Brace, flatten your back and pull the slack out of the bar.', 'Drive through the floor and stand tall, then lower with control.']::text[], 3, '3-5', false),
  ('barbell-row', null, 'Barbell Row', 'Back', 'Barbell', 'Heavy horizontal pull for a thick upper back.', ARRAY['Hinge forward to ~45° with a flat back, bar hanging at arm''s length.', 'Pull the bar to your lower ribs, driving elbows back.', 'Squeeze the shoulder blades at the top.', 'Lower under control.']::text[], 4, '6-10', false),
  ('pull-up', null, 'Pull-Up', 'Back', 'Bodyweight', 'Vertical pulling staple for lat width.', ARRAY['Hang from the bar with an overhand grip, slightly wider than shoulders.', 'Pull your chest towards the bar, leading with your elbows.', 'Get your chin over the bar.', 'Lower all the way to a dead hang.']::text[], 4, '6-10', false),
  ('chin-up', null, 'Chin-Up', 'Back', 'Bodyweight', 'Underhand pull-up with more biceps involvement.', ARRAY['Hang with a shoulder-width underhand grip.', 'Pull until your chin clears the bar.', 'Squeeze your lats at the top.', 'Lower slowly to full extension.']::text[], 3, '6-10', false),
  ('lat-pulldown', null, 'Lat Pulldown', 'Back', 'Cable', 'Machine alternative to pull-ups for building the lats.', ARRAY['Sit with thighs secured under the pads.', 'Grip the bar wider than shoulder width.', 'Pull the bar to your upper chest, elbows down and back.', 'Return slowly to full stretch.']::text[], 3, '8-12', false),
  ('seated-cable-row', null, 'Seated Cable Row', 'Back', 'Cable', 'Horizontal pull targeting the mid-back and lats.', ARRAY['Sit with feet on the platform, knees slightly bent.', 'Grab the handle and sit tall.', 'Row the handle to your stomach, squeezing shoulder blades.', 'Extend your arms slowly without rounding.']::text[], 3, '10-12', false),
  ('dumbbell-row', null, 'One-Arm Dumbbell Row', 'Back', 'Dumbbell', 'Unilateral row for lats and upper back.', ARRAY['Place one knee and hand on a bench, back flat.', 'Hold a dumbbell in the free hand, arm extended.', 'Row the dumbbell to your hip.', 'Lower with control and repeat, then switch sides.']::text[], 3, '8-12', false),
  ('t-bar-row', null, 'T-Bar Row', 'Back', 'Barbell', 'Chest-supported or landmine row for back thickness.', ARRAY['Straddle the bar and grip the handle.', 'Hinge with a flat back.', 'Pull the handle to your chest.', 'Lower slowly to full stretch.']::text[], 3, '8-10', false),
  ('face-pull', null, 'Face Pull', 'Back', 'Cable', 'Rear-delt and upper-back exercise for shoulder health.', ARRAY['Set a rope attachment at upper-chest height.', 'Pull the rope towards your face, splitting the ends.', 'Externally rotate so your hands finish beside your ears.', 'Return slowly.']::text[], 3, '12-15', false),
  ('straight-arm-pulldown', null, 'Straight-Arm Pulldown', 'Back', 'Cable', 'Lat isolation with straight arms.', ARRAY['Stand facing a high pulley holding a bar.', 'Keep arms nearly straight and hinge slightly.', 'Pull the bar down to your thighs in an arc.', 'Return to the start under control.']::text[], 3, '12-15', false),
  ('overhead-press', null, 'Overhead Press', 'Shoulders', 'Barbell', 'Standing barbell press for strong, broad shoulders.', ARRAY['Hold the bar at your collarbone with a shoulder-width grip.', 'Brace your core and squeeze your glutes.', 'Press the bar overhead, moving your head back slightly.', 'Lock out with the bar over mid-foot, then lower.']::text[], 4, '5-8', false),
  ('dumbbell-shoulder-press', null, 'Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 'Seated or standing press with dumbbells.', ARRAY['Sit upright holding dumbbells at shoulder height.', 'Press the weights overhead until arms are straight.', 'Lower back to shoulder level.', 'Avoid arching your lower back.']::text[], 3, '8-12', false),
  ('arnold-press', null, 'Arnold Press', 'Shoulders', 'Dumbbell', 'Rotational press that hits all three delt heads.', ARRAY['Start with dumbbells in front of your face, palms facing you.', 'Rotate your palms outward as you press up.', 'Finish with palms facing forward overhead.', 'Reverse the motion on the way down.']::text[], 3, '8-12', false),
  ('lateral-raise', null, 'Lateral Raise', 'Shoulders', 'Dumbbell', 'Isolation for the side delts — key for shoulder width.', ARRAY['Stand holding dumbbells at your sides.', 'Raise your arms out to the side to shoulder height.', 'Lead with your elbows, slight bend in the arm.', 'Lower slowly.']::text[], 4, '12-15', false),
  ('cable-lateral-raise', null, 'Cable Lateral Raise', 'Shoulders', 'Cable', 'Constant-tension side delt raise.', ARRAY['Stand side-on to a low pulley, handle in the far hand.', 'Raise your arm out to shoulder height.', 'Pause briefly at the top.', 'Lower slowly to the start.']::text[], 3, '12-15', false),
  ('front-raise', null, 'Front Raise', 'Shoulders', 'Dumbbell', 'Isolation for the front delts.', ARRAY['Hold dumbbells in front of your thighs.', 'Raise one or both arms forward to shoulder height.', 'Keep a slight elbow bend.', 'Lower with control.']::text[], 3, '10-12', false),
  ('rear-delt-fly', null, 'Rear Delt Fly', 'Shoulders', 'Dumbbell', 'Bent-over fly for the rear delts.', ARRAY['Hinge forward with a flat back, dumbbells hanging.', 'Raise the weights out to the side, squeezing the rear delts.', 'Keep a soft bend in the elbows.', 'Lower slowly.']::text[], 3, '12-15', false),
  ('upright-row', null, 'Upright Row', 'Shoulders', 'Barbell', 'Compound pull for side delts and traps.', ARRAY['Hold a bar with a shoulder-width grip.', 'Pull the bar up along your body to chest height.', 'Lead with the elbows.', 'Lower under control.']::text[], 3, '10-12', false),
  ('shrug', null, 'Barbell Shrug', 'Shoulders', 'Barbell', 'Trap builder.', ARRAY['Hold the bar at arm''s length.', 'Shrug your shoulders straight up towards your ears.', 'Hold for a second at the top.', 'Lower slowly.']::text[], 3, '10-15', false),
  ('barbell-curl', null, 'Barbell Curl', 'Biceps', 'Barbell', 'Classic mass builder for the biceps.', ARRAY['Stand holding a bar with an underhand, shoulder-width grip.', 'Curl the bar up, keeping elbows pinned to your sides.', 'Squeeze at the top.', 'Lower slowly to full extension.']::text[], 3, '8-12', false),
  ('dumbbell-curl', null, 'Dumbbell Curl', 'Biceps', 'Dumbbell', 'Alternating or simultaneous curls with supination.', ARRAY['Hold dumbbells at your sides, palms forward.', 'Curl the weights up, rotating palms up.', 'Squeeze at the top.', 'Lower with control.']::text[], 3, '10-12', false),
  ('hammer-curl', null, 'Hammer Curl', 'Biceps', 'Dumbbell', 'Neutral-grip curl for the brachialis and forearms.', ARRAY['Hold dumbbells with palms facing each other.', 'Curl up keeping the neutral grip.', 'Pause at the top.', 'Lower slowly.']::text[], 3, '10-12', false),
  ('preacher-curl', null, 'Preacher Curl', 'Biceps', 'Machine', 'Strict curl on a preacher bench that removes momentum.', ARRAY['Sit with your upper arms flat on the pad.', 'Curl the bar or handles up.', 'Squeeze the biceps at the top.', 'Lower until arms are nearly straight.']::text[], 3, '10-12', false),
  ('incline-dumbbell-curl', null, 'Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 'Curl from a stretched position for the long head.', ARRAY['Lie back on a 45–60° incline bench, arms hanging.', 'Curl both dumbbells up without moving your elbows.', 'Squeeze at the top.', 'Lower slowly to full stretch.']::text[], 3, '10-12', false),
  ('cable-curl', null, 'Cable Curl', 'Biceps', 'Cable', 'Constant-tension biceps curl.', ARRAY['Stand facing a low pulley with a straight bar.', 'Curl the bar to your shoulders.', 'Keep elbows fixed at your sides.', 'Lower under control.']::text[], 3, '12-15', false),
  ('close-grip-bench', null, 'Close-Grip Bench Press', 'Triceps', 'Barbell', 'Heavy compound press emphasising the triceps.', ARRAY['Lie on a bench and grip the bar shoulder-width apart.', 'Lower the bar to your lower chest, elbows tucked.', 'Press back to lockout.', 'Keep wrists stacked over elbows.']::text[], 3, '6-10', false),
  ('tricep-pushdown', null, 'Tricep Pushdown', 'Triceps', 'Cable', 'Cable isolation for all three triceps heads.', ARRAY['Stand at a high pulley with a bar or rope.', 'Pin your elbows to your sides.', 'Push down until arms are fully extended.', 'Return slowly to ~90°.']::text[], 3, '10-15', false),
  ('overhead-tricep-extension', null, 'Overhead Tricep Extension', 'Triceps', 'Dumbbell', 'Stretches and loads the long head of the triceps.', ARRAY['Hold one dumbbell overhead with both hands.', 'Lower it behind your head by bending the elbows.', 'Keep elbows pointing forward.', 'Extend back to the top.']::text[], 3, '10-12', false),
  ('skull-crusher', null, 'Skull Crusher', 'Triceps', 'Barbell', 'Lying EZ-bar extension for triceps mass.', ARRAY['Lie on a bench holding an EZ-bar above your chest.', 'Bend at the elbows to lower the bar to your forehead.', 'Keep upper arms still.', 'Extend back up.']::text[], 3, '8-12', false),
  ('tricep-dip', null, 'Tricep Dip', 'Triceps', 'Bodyweight', 'Upright dip variation for the triceps.', ARRAY['Support yourself on parallel bars, torso upright.', 'Lower until elbows reach 90°.', 'Press back up to lockout.', 'Keep elbows close to your body.']::text[], 3, '8-12', false),
  ('tricep-kickback', null, 'Tricep Kickback', 'Triceps', 'Dumbbell', 'Isolation with peak contraction at full extension.', ARRAY['Hinge forward with your upper arm parallel to the floor.', 'Extend the dumbbell back until your arm is straight.', 'Squeeze the triceps.', 'Return slowly.']::text[], 3, '12-15', false),
  ('back-squat', null, 'Back Squat', 'Legs', 'Barbell', 'The foundational lower-body lift for quads, glutes and core.', ARRAY['Set the bar on your upper back and unrack it.', 'Stand with feet shoulder-width, toes slightly out.', 'Sit down and back until hips are below knees.', 'Drive up through mid-foot to standing.']::text[], 4, '5-8', false),
  ('front-squat', null, 'Front Squat', 'Legs', 'Barbell', 'Quad-dominant squat with the bar in the front rack.', ARRAY['Rest the bar on your front delts, elbows high.', 'Squat straight down keeping your torso upright.', 'Reach depth below parallel.', 'Drive up keeping elbows high.']::text[], 3, '5-8', false),
  ('leg-press', null, 'Leg Press', 'Legs', 'Machine', 'Heavy quad and glute work with back support.', ARRAY['Sit with feet shoulder-width on the platform.', 'Release the safeties and lower the sled to ~90°.', 'Press through your heels to extend.', 'Don''t lock the knees hard at the top.']::text[], 3, '10-12', false),
  ('romanian-deadlift', null, 'Romanian Deadlift', 'Legs', 'Barbell', 'Hip hinge for hamstrings and glutes.', ARRAY['Hold the bar at hip height with a flat back.', 'Push your hips back, sliding the bar down your thighs.', 'Stop when you feel a strong hamstring stretch.', 'Drive the hips forward to stand.']::text[], 3, '8-10', false),
  ('bulgarian-split-squat', null, 'Bulgarian Split Squat', 'Legs', 'Dumbbell', 'Single-leg squat for quads and glutes.', ARRAY['Stand in front of a bench, rear foot elevated behind you.', 'Hold dumbbells at your sides.', 'Lower until the back knee nearly touches the floor.', 'Drive up through the front foot.']::text[], 3, '8-12', false),
  ('walking-lunge', null, 'Walking Lunge', 'Legs', 'Dumbbell', 'Dynamic lunge for legs and balance.', ARRAY['Hold dumbbells at your sides.', 'Step forward into a lunge, both knees at ~90°.', 'Push off and step through with the other leg.', 'Keep your torso tall.']::text[], 3, '10-12', false),
  ('leg-extension', null, 'Leg Extension', 'Legs', 'Machine', 'Quad isolation.', ARRAY['Sit with the pad on your lower shins.', 'Extend your legs until straight.', 'Squeeze the quads at the top.', 'Lower slowly.']::text[], 3, '12-15', false),
  ('leg-curl', null, 'Lying Leg Curl', 'Legs', 'Machine', 'Hamstring isolation.', ARRAY['Lie face down with the pad above your heels.', 'Curl your heels towards your glutes.', 'Squeeze at the top.', 'Lower under control.']::text[], 3, '10-15', false),
  ('calf-raise', null, 'Standing Calf Raise', 'Legs', 'Machine', 'Builds the gastrocnemius.', ARRAY['Stand on the platform with the balls of your feet.', 'Lower your heels for a deep stretch.', 'Rise up onto your toes as high as possible.', 'Pause, then lower slowly.']::text[], 4, '12-15', false),
  ('goblet-squat', null, 'Goblet Squat', 'Legs', 'Dumbbell', 'Front-loaded squat — great for learning depth.', ARRAY['Hold a dumbbell vertically at your chest.', 'Squat down between your knees.', 'Keep your chest up and elbows inside knees.', 'Stand back up.']::text[], 3, '10-12', false),
  ('hack-squat', null, 'Hack Squat', 'Legs', 'Machine', 'Machine squat that hammers the quads.', ARRAY['Stand on the platform with shoulders under the pads.', 'Release the safeties.', 'Lower until thighs are parallel or below.', 'Press back up.']::text[], 3, '8-12', false),
  ('hip-thrust', null, 'Barbell Hip Thrust', 'Glutes', 'Barbell', 'The best direct glute builder.', ARRAY['Sit with your upper back against a bench, bar over your hips.', 'Plant your feet hip-width apart.', 'Drive your hips up until your body is straight from knees to shoulders.', 'Squeeze your glutes hard, then lower.']::text[], 4, '8-12', false),
  ('glute-bridge', null, 'Glute Bridge', 'Glutes', 'Bodyweight', 'Floor-based hip extension.', ARRAY['Lie on your back, knees bent, feet flat.', 'Drive through your heels to raise your hips.', 'Squeeze your glutes at the top.', 'Lower slowly.']::text[], 3, '12-15', false),
  ('cable-kickback', null, 'Cable Glute Kickback', 'Glutes', 'Cable', 'Glute isolation with an ankle strap.', ARRAY['Attach an ankle strap to a low pulley.', 'Face the machine and hold for support.', 'Kick your leg back, squeezing the glute.', 'Return slowly.']::text[], 3, '12-15', false),
  ('hip-abduction', null, 'Hip Abduction Machine', 'Glutes', 'Machine', 'Targets the glute medius.', ARRAY['Sit with the pads on the outside of your knees.', 'Push your knees outward.', 'Pause at full abduction.', 'Return slowly.']::text[], 3, '15-20', false),
  ('sumo-deadlift', null, 'Sumo Deadlift', 'Glutes', 'Barbell', 'Wide-stance deadlift with more glute and adductor work.', ARRAY['Take a wide stance, toes pointed out.', 'Grip the bar inside your knees.', 'Push the floor apart and stand up.', 'Lock out by squeezing your glutes.']::text[], 3, '5-8', false),
  ('step-up', null, 'Dumbbell Step-Up', 'Glutes', 'Dumbbell', 'Unilateral glute and quad exercise.', ARRAY['Stand facing a box holding dumbbells.', 'Step up with one foot and drive through the heel.', 'Stand tall on top.', 'Step down under control.']::text[], 3, '10-12', false),
  ('plank', null, 'Plank', 'Abs', 'Bodyweight', 'Isometric core stability exercise. Log reps as seconds.', ARRAY['Rest on your forearms and toes.', 'Keep a straight line from head to heels.', 'Brace your abs and squeeze your glutes.', 'Hold for the target time.']::text[], 3, '30-60s', false),
  ('hanging-leg-raise', null, 'Hanging Leg Raise', 'Abs', 'Bodyweight', 'Advanced lower-ab exercise.', ARRAY['Hang from a pull-up bar.', 'Raise your legs until they''re parallel to the floor or higher.', 'Avoid swinging.', 'Lower slowly.']::text[], 3, '10-15', false),
  ('cable-crunch', null, 'Cable Crunch', 'Abs', 'Cable', 'Weighted crunch for ab strength.', ARRAY['Kneel below a high pulley holding a rope by your head.', 'Crunch down, bringing elbows towards knees.', 'Squeeze your abs.', 'Return slowly.']::text[], 3, '12-15', false),
  ('crunch', null, 'Crunch', 'Abs', 'Bodyweight', 'Basic ab flexion.', ARRAY['Lie on your back with knees bent.', 'Curl your shoulders off the floor.', 'Squeeze your abs at the top.', 'Lower slowly.']::text[], 3, '15-20', false),
  ('russian-twist', null, 'Russian Twist', 'Abs', 'Other', 'Rotational core exercise for the obliques.', ARRAY['Sit with knees bent and lean back slightly.', 'Hold a weight in front of your chest.', 'Rotate your torso side to side.', 'Keep your core braced.']::text[], 3, '20', false),
  ('ab-wheel', null, 'Ab Wheel Rollout', 'Abs', 'Other', 'Anti-extension core builder.', ARRAY['Kneel holding an ab wheel.', 'Roll forward as far as you can with a flat back.', 'Use your abs to pull back to the start.', 'Don''t let your hips sag.']::text[], 3, '8-12', false),
  ('treadmill-run', null, 'Treadmill Run', 'Cardio', 'Machine', 'Steady-state or interval running. Log reps as minutes.', ARRAY['Start with a 3–5 minute walking warm-up.', 'Increase to your target pace.', 'Maintain good posture and a relaxed stride.', 'Cool down for 3–5 minutes.']::text[], 1, '20-30 min', false),
  ('rowing-machine', null, 'Rowing Machine', 'Cardio', 'Machine', 'Full-body conditioning. Log reps as minutes.', ARRAY['Strap in and grab the handle.', 'Drive with legs first, then lean back and pull.', 'Return arms, then body, then legs.', 'Keep a steady stroke rate.']::text[], 1, '10-20 min', false),
  ('stationary-bike', null, 'Stationary Bike', 'Cardio', 'Machine', 'Low-impact cardio. Log reps as minutes.', ARRAY['Adjust seat height so your knee is slightly bent at the bottom.', 'Warm up at an easy resistance.', 'Increase intensity to your target.', 'Cool down gradually.']::text[], 1, '20-40 min', false),
  ('jump-rope', null, 'Jump Rope', 'Cardio', 'Other', 'High-intensity conditioning. Log reps as minutes.', ARRAY['Hold the handles at hip height.', 'Turn the rope with your wrists.', 'Jump just high enough to clear the rope.', 'Land softly on the balls of your feet.']::text[], 3, '2-3 min', false),
  ('burpee', null, 'Burpee', 'Cardio', 'Bodyweight', 'Full-body explosive conditioning.', ARRAY['Squat down and place hands on the floor.', 'Jump your feet back into a plank.', 'Do a push-up, then jump your feet forward.', 'Explode up into a jump.']::text[], 3, '10-15', false),
  ('kettlebell-swing', null, 'Kettlebell Swing', 'Cardio', 'Kettlebell', 'Explosive hip hinge for power and conditioning.', ARRAY['Stand with feet wider than hips, kettlebell in front.', 'Hike the bell between your legs.', 'Snap your hips forward to swing it to chest height.', 'Let it fall back and repeat.']::text[], 3, '15-20', false),
  ('stair-climber', null, 'Stair Climber', 'Cardio', 'Machine', 'Glute-heavy cardio. Log reps as minutes.', ARRAY['Step onto the machine and hold the rails lightly.', 'Set a steady pace.', 'Drive through your whole foot.', 'Stand tall — don''t lean on the rails.']::text[], 1, '15-20 min', false)
on conflict (id) do update set
  name = excluded.name, muscle_group = excluded.muscle_group, equipment = excluded.equipment,
  description = excluded.description, instructions = excluded.instructions,
  recommended_sets = excluded.recommended_sets, recommended_reps = excluded.recommended_reps;
