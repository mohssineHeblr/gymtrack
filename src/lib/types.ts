export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Legs"
  | "Glutes"
  | "Abs"
  | "Cardio";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Glutes",
  "Abs",
  "Cardio",
];

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
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  description: string;
  instructions: string[];
  recommendedSets: number;
  recommendedReps: string;
  isCustom?: boolean;
  updatedAt?: string;
}

export interface ProgramExercise {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds: number;
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

export interface WorkoutSet {
  id: string;
  /** Always stored in kilograms */
  weight: number | null;
  reps: number | null;
  completed: boolean;
  type: SetType;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  restSeconds: number;
  notes?: string;
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

export type Units = "kg" | "lbs";
export type Theme = "dark" | "light" | "system";
export type FitnessGoal = "build_muscle" | "lose_fat" | "strength" | "endurance" | "maintain";

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
  updatedAt: string;
}

export interface RestTimerState {
  endsAt: number | null;
  duration: number;
  pausedRemaining: number | null;
}

export type SyncTable =
  | "exercises"
  | "workout_programs"
  | "workouts"
  | "body_measurements"
  | "nutrition_logs";

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
