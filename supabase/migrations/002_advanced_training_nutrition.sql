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
