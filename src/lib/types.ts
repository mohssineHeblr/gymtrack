import type { Muscle } from "@/data/muscles";

export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Forearms"
  | "Quadriceps"
  | "Hamstrings"
  | "Glutes"
  | "Calves"
  | "Abs"
  | "Cardio";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Quadriceps",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Abs",
  "Cardio",
];

/** Groups that existed in v1 and how they map to the current taxonomy. */
export const LEGACY_GROUPS: Record<string, MuscleGroup> = { Legs: "Quadriceps" };

export function normalizeGroup(g: string): MuscleGroup {
  if ((MUSCLE_GROUPS as string[]).includes(g)) return g as MuscleGroup;
  return LEGACY_GROUPS[g] ?? "Chest";
}

export type Difficulty = "beginner" | "intermediate" | "advanced";
export const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export type ExerciseType = "compound" | "isolation" | "cardio" | "plyometric" | "mobility";
export const EXERCISE_TYPES: ExerciseType[] = ["compound", "isolation", "cardio", "plyometric", "mobility"];
export const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  compound: "Compound",
  isolation: "Isolation",
  cardio: "Cardio",
  plyometric: "Plyometric",
  mobility: "Core & stability",
};

export type Equipment =
  | "Barbell"
  | "Dumbbell"
  | "Machine"
  | "Cable"
  | "Bodyweight"
  | "Kettlebell"
  | "Band"
  | "Other";

export const EQUIPMENT: Equipment[] = [
  "Barbell",
  "Dumbbell",
  "Machine",
  "Cable",
  "Bodyweight",
  "Kettlebell",
  "Band",
  "Other",
];

export interface Exercise {
  id: string;
  name: string;
  /** Primary muscle group */
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  description: string;
  instructions: string[];
  recommendedSets: number;
  recommendedReps: string;
  difficulty?: Difficulty;
  /** Exercise type / category (compound, isolation, cardio …) */
  type?: ExerciseType;
  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];
  /** Image as a compressed data URL or https URL */
  image?: string | null;
  isCustom?: boolean;
  updatedAt?: string;
}

/**
 * Training technique applied to an exercise.
 * Supersets / giant sets are expressed by grouping exercises (groupId), not by technique.
 */
export type Technique = "standard" | "dropset" | "rest_pause" | "myo_reps" | "tempo";
export const TECHNIQUES: Technique[] = ["standard", "dropset", "rest_pause", "myo_reps", "tempo"];

export interface ProgramExercise {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds: number;
  technique?: Technique;
  tempo?: string;
  /** Exercises sharing a groupId are performed as a superset (2) or giant set (3+) */
  groupId?: string | null;
}

export interface ProgramDay {
  id: string;
  name: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekdays: number[];
  exercises: ProgramExercise[];
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  isPreset: boolean;
  days: ProgramDay[];
  createdAt: string;
  updatedAt: string;
}

export type SetType = "normal" | "warmup" | "drop" | "failure";

/** An extra stage of the same set performed straight after it (drops or mini-sets). */
export interface SetStage {
  id: string;
  /** kilograms */
  weight: number | null;
  reps: number | null;
}

export interface WorkoutSet {
  id: string;
  /** Always stored in kilograms */
  weight: number | null;
  reps: number | null;
  completed: boolean;
  type: SetType;
  /** Rest after this set; overrides the exercise rest when set */
  restSeconds?: number | null;
  /** Additional stages of this set (dropset drops, rest-pause / myo-rep mini-sets) */
  stages?: SetStage[];
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  restSeconds: number;
  notes?: string;
  /** Rep range the set targets were built for (e.g. "8-12"), used for progression */
  targetReps?: string;
  /** Coaching tip from the progression engine (local only) */
  tip?: string;
  trend?: "up" | "same" | "down" | "new";
  technique?: Technique;
  /** Tempo prescription, e.g. "3-1-1-0" (eccentric-pause-concentric-pause) */
  tempo?: string;
  /** Exercises sharing a groupId form a superset (2) or giant set (3+) */
  groupId?: string | null;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string;
  programId?: string | null;
  programDayId?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  notes?: string;
  exercises: WorkoutExercise[];
  updatedAt: string;
}

export interface BodyMeasurement {
  id: string;
  date: string; // YYYY-MM-DD
  weight?: number | null; // kg
  bodyFat?: number | null; // %
  chest?: number | null; // cm
  waist?: number | null;
  arm?: number | null;
  thigh?: number | null;
  notes?: string;
  updatedAt: string;
}

/** @deprecated v1 flat nutrition entry — migrated into MealRecord on load. */
export interface NutritionLog {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  updatedAt: string;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type Macros = NutritionGoals;

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];
export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

export type FoodCategory =
  | "Meat & Poultry"
  | "Fish & Seafood"
  | "Dairy & Eggs"
  | "Grains & Bread"
  | "Pasta & Rice"
  | "Fruit"
  | "Vegetables"
  | "Legumes"
  | "Nuts & Seeds"
  | "Fats & Oils"
  | "Snacks & Sweets"
  | "Drinks"
  | "Supplements"
  | "Prepared Meals"
  | "Other";

export const FOOD_CATEGORIES: FoodCategory[] = [
  "Meat & Poultry",
  "Fish & Seafood",
  "Dairy & Eggs",
  "Grains & Bread",
  "Pasta & Rice",
  "Fruit",
  "Vegetables",
  "Legumes",
  "Nuts & Seeds",
  "Fats & Oils",
  "Snacks & Sweets",
  "Drinks",
  "Supplements",
  "Prepared Meals",
  "Other",
];

export interface Food {
  id: string;
  name: string;
  brand?: string;
  category: FoodCategory;
  /** Nutrition per 100 g (or 100 ml) */
  per100: Macros;
  /** Typical serving in grams */
  servingGrams?: number | null;
  servingLabel?: string;
  source: "builtin" | "custom" | "off";
  barcode?: string;
  updatedAt?: string;
}

export interface MealItem {
  id: string;
  foodId?: string | null;
  name: string;
  brand?: string;
  /** Quantity in grams. null = fixed portion (quick entry / legacy log) */
  grams: number | null;
  /** Per-100 g values used to recalculate when grams change */
  per100: Macros | null;
  /** Actual nutrition for this item */
  macros: Macros;
}

export interface MealRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: MealType;
  items: MealItem[];
  updatedAt: string;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: Omit<MealItem, "id">[];
  updatedAt: string;
}

export type Units = "kg" | "lbs";
export type Theme = "dark" | "light" | "system";
export type FitnessGoal = "build_muscle" | "lose_fat" | "strength" | "endurance" | "maintain";

export type SplitFocus = "auto" | "push" | "pull" | "legs" | "upper" | "lower" | "full";

export interface SmartSettings {
  /** Target workout length in minutes */
  duration: number;
  split: SplitFocus;
  /** Add ramp-up warm-up sets before the first compound lift */
  warmups: boolean;
}

export type AlarmSound = "beep" | "chime" | "bell" | "digital" | "boxing";
export const ALARM_SOUNDS: { id: AlarmSound; label: string }[] = [
  { id: "beep", label: "Beep" },
  { id: "chime", label: "Chime" },
  { id: "bell", label: "Bell" },
  { id: "digital", label: "Digital" },
  { id: "boxing", label: "Boxing bell" },
];

export interface TimerSettings {
  sound: boolean;
  alarm: AlarmSound;
  /** 0..1 */
  volume: number;
  vibration: boolean;
  /** System notification when the timer ends while the app is in the background */
  notifications: boolean;
  /** Server push fallback for a suspended / locked app (needs Supabase + VAPID setup) */
  push: boolean;
  /** Start the rest timer automatically after completing a set */
  autoStart: boolean;
  /** Default rest for the manual timer */
  defaultRest: number;
}

export interface Profile {
  name: string;
  fitnessGoal: FitnessGoal;
  goalDescription: string;
  targetWeight: number | null; // kg
  weeklyGoal: number;
  units: Units;
  theme: Theme;
  nutritionGoals: NutritionGoals;
  activeProgramId: string | null;
  /** Equipment available at the user's gym */
  equipment: Equipment[];
  favoriteExercises: string[];
  excludedExercises: string[];
  smart: SmartSettings;
  timer: TimerSettings;
  favoriteFoods: string[];
  updatedAt: string;
}

export interface RestTimerState {
  /** Epoch ms when the countdown reaches zero (null when paused / idle) */
  endsAt: number | null;
  /** Total length in seconds (progress ring + reset) */
  duration: number;
  /** Seconds left while paused */
  pausedRemaining: number | null;
  /** endsAt value whose alarm already fired (prevents double alarms after reload) */
  alertedFor?: number | null;
  /** Context shown in the timer, e.g. "Superset A done" */
  label?: string | null;
}

export type SyncTable =
  | "exercises"
  | "workout_programs"
  | "workouts"
  | "body_measurements"
  | "nutrition_logs"
  | "foods"
  | "meals"
  | "saved_meals";

export interface PendingDeletion {
  table: SyncTable;
  id: string;
}

export interface SyncState {
  lastSyncedAt: string | null;
  pendingDeletions: PendingDeletion[];
  status: "idle" | "syncing" | "error" | "offline";
  error?: string | null;
}

export interface PersonalRecord {
  exerciseId: string;
  bestWeight: number;
  bestWeightReps: number;
  bestE1rm: number;
  bestVolumeSet: number;
  maxReps: number;
  achievedAt: string;
  workoutId: string;
}
