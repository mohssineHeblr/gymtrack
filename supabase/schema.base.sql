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
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

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
