# GYMTRACK

A premium, mobile-first gym and workout tracker. It's built as a Progressive Web App (PWA), so you can install it on your iPhone from Safari.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Zustand (local-first store) · Supabase (auth + cloud sync) · Recharts · Lucide icons

---

## Features

| Area | What you can do |
|---|---|
| **Smart Workouts** | A workout built for you every day from your **muscle recovery**, goal, available **equipment** (full gym / home / bodyweight / custom) and target length (30–90 min). Focus is automatic (picks the most recovered split) or forced to Push/Pull/Legs/Upper/Lower/Full. Shuffle, swap any exercise for a smart alternative, remove exercises, optional warm-up sets |
| **Progressive overload** | Every exercise gets suggested weight × reps from your history: hit the top of the rep range on every set and the weight goes up, otherwise beat last time by a rep, or back off after a grind. Tips appear on each exercise |
| **Muscle recovery** | Front/back body heat map with 18 muscles, recovery %, time until recovered, and weekly sets per muscle versus the 10–20 set guideline |
| **Exercise preferences** | Mark exercises "Suggest more" (favourite) or "Don't suggest" (excluded). Each exercise shows a body map of its primary and secondary muscles |
| **Dashboard** | See today's scheduled workout, start a workout in one tap, check weekly goal progress and streak, weekly volume and time, total workouts, current body weight, recent PRs, and a weekly activity chart |
| **Workout tracker** | Start an empty workout, a program day, or a repeat of a past workout. Add, edit and delete sets, set types (working, warm-up, drop, to failure), **individual rest per set**, "previous" values, live duration, notes. Progress saves automatically, even after a reload or offline |
| **Training techniques** | **Supersets** (2 exercises) and **giant sets** (3+) shown as one block (A1, A2…); you're taken to the next exercise and the rest timer starts only after the whole round. **Dropsets** log every weight drop inside the same set (e.g. 20 kg×10 → 16 kg×8 → 10 kg×8). **Rest-pause** and **myo-reps** log mini-sets with an automatic short pause. **Tempo** prescriptions (e.g. 3-1-1-0). Choose the technique per exercise in a workout or in a program |
| **Rest timer** | Circular countdown with start, pause, resume, reset, skip and ±15 s, configurable durations, auto-start after a set, 5 alarm sounds with volume and preview, vibration and notification toggles. Based on the clock, so it stays correct when the app is suspended. Optional Web Push fallback for a locked phone |
| **Programs** | Templates for Push/Pull/Legs, Upper/Lower, Full Body and Arnold Split. Create, duplicate, edit and delete programs, add, remove and reorder exercises, set sets, reps and rest, schedule each day by weekday, track completed sessions |
| **Exercise library** | 118 exercises across Chest, Back, Shoulders, Biceps, Triceps, Forearms, Quadriceps, Hamstrings, Glutes, Calves, Abs and Cardio. Each has primary and secondary muscles (body-map illustration), equipment, type, difficulty and instructions. Filter by muscle group, equipment, type and difficulty. Custom exercises with your own image, targeted muscles and equipment, which you can edit and delete. Duplicate names are blocked |
| **Progress** | Training frequency, weekly volume, estimated 1RM and top-weight progress per exercise, all personal records, body-weight trend |
| **Body** | Log weight, body fat %, chest, waist, arm and thigh, see the change since your last entry, view a chart per metric, edit and delete entries |
| **History** | Workouts grouped by month and searchable. Each one shows duration, volume, sets, PRs and every set. You can edit the name and notes, repeat the workout or delete it |
| **Nutrition** | Breakfast, lunch, dinner and snacks with several foods each. Search a built-in database of 146 foods (values per 100 g) by name or category, or millions of branded products through **Open Food Facts**. Enter grams and calories and macros are calculated automatically. Custom foods, favourites, frequent foods, saved meals, copy a previous meal, edit quantities, review past days. A daily dashboard shows consumed versus targets and the calories and macros remaining. Targets are customisable |
| **Profile** | Name, goal, target weight, weekly target, kg or lbs, dark, light or system theme, account and sync, export and import a JSON backup, sample data, reset |
| **PWA** | Manifest, iOS icons, standalone mode, safe-area aware layout, a service worker that caches every page for offline use, local data storage, sync when you're back online |

### How data works (local-first)
All data is saved in your browser's storage on the device, so the app works with **no internet and no account**. If you configure Supabase and sign in, the app syncs your changes to the cloud automatically: when you make changes, every minute, when the app comes back online, and when you reopen it. You can then use the same data on several devices. The active workout always stays on the device until you finish it.

---

## 1. Run it on your Windows PC

```powershell
npm install
npm run dev          
```

To test the production version, which is also the only mode where the service worker and offline support are on:

```powershell
npm run build
npm start            # http://localhost:3000
```

Other scripts: `npm run typecheck`, `npm run icons` (rebuilds the app icons), `npm run seed:sql` (rebuilds `supabase/schema.sql` from the exercise list).

---

## 2. (Optional) Turn on accounts and cloud sync with Supabase

Without this step the app runs in **local mode**, and everything still works.

1. Create a free project at <https://supabase.com>.
2. In the Supabase dashboard, open **SQL Editor → New query**. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates all tables, the relationships, the Row Level Security policies, a trigger that creates your profile when you sign up, the 118 built-in exercises and the 146 built-in foods. **Upgrading an existing v1 database?** Run the same file again. It is idempotent: it adds the new columns and tables, re-categorises old "Legs" exercises, and copies old `nutrition_logs` into meals. Your workout history is kept.
3. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
4. Copy `.env.example` to `.env.local` and fill in the two values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
5. (Recommended for personal use) Go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**, so you can sign in straight away.
6. Restart `npm run dev`. Then go to **Profile → Sign in or create account**.

When you deploy (step 3), add the same two variables in your hosting provider's settings.

**Database tables:** `profiles` (including `timer_settings`), `exercises`, `workout_programs`, `workouts` → `workout_exercises` (`group_id` for supersets, `technique`, `tempo`) → `workout_sets` (`rest_seconds`) → `workout_set_stages` (drops and mini-sets), `body_measurements`, `foods`, `meals` → `meal_items`, `saved_meals`, `personal_records`, `rest_timer_pushes`, plus the legacy `nutrition_logs`. Migrations live in `supabase/migrations/`, and `npm run seed:sql` rebuilds `schema.sql`. Row Level Security is on for every table: each user can only read and write their own rows. Built-in exercises can be read by everyone.

### (Optional) Locked-screen rest alerts with Web Push

Phones pause web apps in the background. While GYMTRACK is closed or the screen is locked, it can't play its own alarm or vibrate. The timer itself stays correct because it is based on the clock. To still get an alert on a locked phone:

1. Run `npm run vapid`. Put `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local` and in Vercel.
2. Deploy the Edge Function and set its secrets:
   ```
   npx supabase functions deploy rest-timer-push
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
   ```
3. On the iPhone, the app must be **installed to the Home Screen** (iOS 16.4 or later). Sign in, then turn on **Profile → Rest timer → Locked-screen push**.

When the app goes to the background with a rest timer running, it asks the function to send a push at the end time. If you reopen the app first, the push is cancelled. Pushes use the **system notification sound**, so a custom ringtone isn't possible.

---

## 3. Put it on your iPhone

iOS only enables service workers (offline mode) and a full home-screen install over **HTTPS**. The easiest way to get HTTPS is a free deploy on **Vercel**:

### Option A: Deploy to Vercel (recommended, about 5 minutes)
1. Create a free account at <https://vercel.com> and sign in with GitHub.
2. Push this folder to a new GitHub repository:
   ```powershell
   git init
   git add .
   git commit -m "GYMTRACK"
   git branch -M main
   git remote add origin https://github.com/<you>/gymtrack.git
   git push -u origin main
   ```
3. In Vercel, click **Add New → Project** and import the repository. Vercel detects Next.js on its own.
   If you set up Supabase, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Environment Variables**.
4. Click **Deploy**. You get a URL like `https://gymtrack-xyz.vercel.app`.

   (Alternative with no GitHub: run `npx vercel` in this folder and follow the prompts.)

### Install on the iPhone
1. Open the Vercel URL in **Safari**. It must be Safari, not Chrome.
2. Tap the **Share** button (the square with an arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open **GYMTRACK** from your home screen. It runs full-screen like a native app.
5. Open it once while online so it can cache itself. After that it works offline at the gym.

### Option B: Quick test on your Wi-Fi (no deploy, no offline mode)
```powershell
npm run build
npm run start:lan
```
Find your PC's IP with `ipconfig` (for example `192.168.1.20`). On the iPhone, on the same Wi-Fi, open `http://192.168.1.20:3000` in Safari. You may need to allow Node.js through Windows Firewall. This is fine for trying the app, but iOS turns off offline caching on plain `http`, so use Option A for daily use.

### Tips
- Your data lives in Safari's storage for the installed app. Use **Profile → Export backup** now and then, or turn on Supabase sync.
- iOS may clear storage for web apps you haven't opened in a long time. Cloud sync protects against this.
- The rest-timer beep needs your phone's ringer to be on. iOS doesn't allow web apps to vibrate.

---

## Project structure

```
src/
  app/                  # routes (all static, so they can be cached offline)
    page.tsx            # Dashboard
    workout/            # Workout tracker
    smart/              # Smart Workout preview (generated plan)
    recovery/           # Muscle recovery map
    programs/ (+edit/)  # Programs list and editor (?id=)
    exercises/          # Exercise library
    progress/           # Charts (?tab=overview|strength|records|body)
    body/  history/ (+view/)  nutrition/  profile/  login/
    manifest.ts         # PWA manifest
  components/           # AppShell, BottomNav, RestTimer, ExercisePicker, charts, ui/ kit
  data/                 # exercise database, muscle mapping (muscles.ts), program templates
  lib/
    store.ts            # Zustand store (persisted to localStorage) and all actions
    sync.ts             # Supabase push/pull sync engine
    stats.ts            # volume, e1RM, PRs, weekly trends
    recovery.ts         # muscle fatigue / recovery model
    generator.ts        # Smart Workout generator + exercise alternatives
    progression.ts      # progressive-overload suggestions
    supabase.ts auth.ts types.ts utils.ts sample-data.ts
public/sw.js            # service worker
supabase/schema.sql     # complete database schema + RLS + seed
```

To add exercises, edit `src/data/exercises.ts` and give them primary/secondary muscles in `src/data/muscles.ts` (then run `npm run seed:sql`). To add program templates, edit `src/data/programs.ts`.

> **Upgrading an existing Supabase project?** Re-run `supabase/schema.sql`. It is safe to run again and adds the new `profiles.preferences` column, which syncs equipment, favourites and smart-workout settings.
