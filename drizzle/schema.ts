import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";

/** Single-user app: the profile row is always id = 1. */
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(),
  raceName: text("race_name").notNull(),
  raceDate: text("race_date").notNull(),
  startDate: text("start_date").notNull(),
  experience: text("experience").notNull().default("beginner"),
  goal: text("goal").notNull().default("finish"),
  timeGoalSec: integer("time_goal_sec"),
  longRunDay: integer("long_run_day").notNull().default(6),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  age: integer("age"),
  sex: text("sex"),
  dietPref: text("diet_pref").notNull().default("omnivore"),
  allergies: text("allergies").notNull().default(""),
  email: text("email").notNull().default(""),
  reminderHour: integer("reminder_hour").notNull().default(6),
  remindersEnabled: integer("reminders_enabled").notNull().default(1),
  /** Second goal alongside the finish line: abs visible by race day. */
  absGoal: integer("abs_goal").notNull().default(1),
  targetBodyFatPct: real("target_body_fat_pct"),
  strengthDays: integer("strength_days").notNull().default(2),
  /** Coach suggestions are opt-in and never auto-apply. */
  aiEnabled: integer("ai_enabled").notNull().default(1),
  onboardedAt: text("onboarded_at"),
  updatedAt: text("updated_at"),
});

export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  week: integer("week").notNull(),
  weeksToRace: integer("weeks_to_race").notNull(),
  phase: text("phase").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  distanceMi: real("distance_mi").notNull().default(0),
  durationMin: integer("duration_min"),
  purpose: text("purpose").notNull().default(""),
  tip: text("tip"),
  status: text("status").notNull().default("planned"),
  skipReason: text("skip_reason"),
});

export const workoutLogs = sqliteTable("workout_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  distanceMi: real("distance_mi").notNull().default(0),
  durationSec: integer("duration_sec"),
  rpe: integer("rpe"),
  feel: text("feel"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  /** "manual" when typed in the app, "healthkit" when imported from the Watch. */
  source: text("source").notNull().default("manual"),
  externalId: text("external_id"),
  avgHr: integer("avg_hr"),
  maxHr: integer("max_hr"),
  activeKcal: integer("active_kcal"),
  startAt: text("start_at"),
  endAt: text("end_at"),
});

/**
 * One row per morning. Sleep is keyed by the day you woke up, so "last night's
 * sleep" on Today is simply the row for today's date.
 */
export const healthDays = sqliteTable("health_days", {
  date: text("date").primaryKey(),
  sleepStart: text("sleep_start"),
  sleepEnd: text("sleep_end"),
  asleepMin: integer("asleep_min"),
  inBedMin: integer("in_bed_min"),
  restingHr: integer("resting_hr"),
  hrvMs: real("hrv_ms"),
  steps: integer("steps"),
  activeKcal: integer("active_kcal"),
  /** Body composition, from the Watch/scale or typed in by hand. */
  weightKg: real("weight_kg"),
  bodyFatPct: real("body_fat_pct"),
  waistCm: real("waist_cm"),
  updatedAt: text("updated_at").notNull(),
});

/** Single row (id = 1) so Today can show when the phone last handed over data. */
export const healthSync = sqliteTable("health_sync", {
  id: integer("id").primaryKey(),
  lastSyncAt: text("last_sync_at").notNull(),
  device: text("device"),
  daysSeen: integer("days_seen").notNull().default(0),
  workoutsSeen: integer("workouts_seen").notNull().default(0),
});

export const mealPlans = sqliteTable(
  "meal_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    slot: text("slot").notNull(),
    recipeId: text("recipe_id"),
    name: text("name").notNull(),
    calories: integer("calories").notNull().default(0),
    protein: integer("protein").notNull().default(0),
    carbs: integer("carbs").notNull().default(0),
    fat: integer("fat").notNull().default(0),
    eaten: integer("eaten").notNull().default(0),
  },
  (t) => [unique("meal_plans_date_slot").on(t.date, t.slot)],
);

export const foodLogs = sqliteTable("food_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  name: text("name").notNull(),
  calories: integer("calories").notNull().default(0),
  protein: integer("protein").notNull().default(0),
  carbs: integer("carbs").notNull().default(0),
  fat: integer("fat").notNull().default(0),
  source: text("source").notNull().default("custom"),
  mealPlanId: integer("meal_plan_id"),
  createdAt: text("created_at").notNull(),
});

export const dayLogs = sqliteTable("day_logs", {
  date: text("date").primaryKey(),
  waterOz: integer("water_oz").notNull().default(0),
  sodiumMg: integer("sodium_mg").notNull().default(0),
  notes: text("notes"),
});

export const groceryChecks = sqliteTable(
  "grocery_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weekStart: text("week_start").notNull(),
    itemKey: text("item_key").notNull(),
    checked: integer("checked").notNull().default(0),
  },
  (t) => [unique("grocery_week_item").on(t.weekStart, t.itemKey)],
);

export const supplementPrefs = sqliteTable("supplement_prefs", {
  id: text("id").primaryKey(),
  enabled: integer("enabled").notNull().default(1),
});

export const supplementLogs = sqliteTable(
  "supplement_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    supplementId: text("supplement_id").notNull(),
    taken: integer("taken").notNull().default(0),
  },
  (t) => [unique("supp_log_date_id").on(t.date, t.supplementId)],
);

export const fuelChecks = sqliteTable(
  "fuel_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    stage: text("stage").notNull(),
    checked: integer("checked").notNull().default(0),
  },
  (t) => [unique("fuel_date_stage").on(t.date, t.stage)],
);

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at").notNull(),
});

export const reminderRuns = sqliteTable("reminder_runs", {
  date: text("date").primaryKey(),
  sentAt: text("sent_at").notNull(),
  channels: text("channels").notNull(),
});

/**
 * Lifting and core sit beside the run plan rather than inside it: one row per
 * date that has strength work, with the exercise list stored as JSON.
 */
export const strengthSessions = sqliteTable("strength_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  week: integer("week").notNull(),
  phase: text("phase").notNull(),
  /** "full" full-body lift · "core" ab circuit · "mobility" taper-week work. */
  focus: text("focus").notNull(),
  title: text("title").notNull(),
  purpose: text("purpose").notNull().default(""),
  minutes: integer("minutes").notNull().default(0),
  level: integer("level").notNull().default(1),
  blocks: text("blocks").notNull(),
  status: text("status").notNull().default("planned"),
  skipReason: text("skip_reason"),
});

export const strengthChecks = sqliteTable(
  "strength_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    exerciseId: text("exercise_id").notNull(),
    done: integer("done").notNull().default(0),
    load: text("load"),
  },
  (t) => [unique("strength_check_date_ex").on(t.date, t.exerciseId)],
);

export const strengthLogs = sqliteTable("strength_logs", {
  date: text("date").primaryKey(),
  minutes: integer("minutes"),
  rpe: integer("rpe"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

/**
 * Every coach proposal, kept whether or not it was taken. Nothing here changes
 * the plan until the runner presses Apply.
 */
export const coachSuggestions = sqliteTable("coach_suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
  /** Training date the advice is about. */
  date: text("date").notNull(),
  origin: text("origin").notNull().default("rules"),
  model: text("model"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  confidence: text("confidence").notNull().default("medium"),
  /** JSON array of typed change operations the app knows how to perform. */
  changes: text("changes").notNull().default("[]"),
  status: text("status").notNull().default("pending"),
  decidedAt: text("decided_at"),
  /** The data snapshot the advice was based on, for later reading. */
  snapshot: text("snapshot"),
  /** Stable hash so the same nudge is not raised twice in a day. */
  fingerprint: text("fingerprint").notNull().unique(),
});

/** Small key/value bag for things that are neither profile nor training data. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Profile = typeof profile.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type HealthDay = typeof healthDays.$inferSelect;
export type HealthSync = typeof healthSync.$inferSelect;
export type MealPlanRow = typeof mealPlans.$inferSelect;
export type FoodLog = typeof foodLogs.$inferSelect;
export type DayLog = typeof dayLogs.$inferSelect;
export type StrengthSession = typeof strengthSessions.$inferSelect;
export type StrengthCheck = typeof strengthChecks.$inferSelect;
export type StrengthLog = typeof strengthLogs.$inferSelect;
export type CoachSuggestion = typeof coachSuggestions.$inferSelect;
