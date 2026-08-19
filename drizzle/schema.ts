import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * Every training row belongs to exactly one account. `userId` is required on all
 * of them and is part of each primary key or unique constraint, so two runners
 * can hold the same date without colliding.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Lowercased at write time; the login identity. */
  email: text("email").notNull().unique(),
  /** Null for accounts that only ever signed in with Apple. */
  passwordHash: text("password_hash"),
  name: text("name").notNull().default(""),
  /** Apple's stable subject claim, once the runner has used Sign in with Apple. */
  appleSub: text("apple_sub").unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Server-side sessions. The id is a SHA-256 of the cookie token, never the token. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

/**
 * Long-lived bearer tokens for the iPhone shell: Health ingest, the day
 * snapshot, the notification schedule, and Siri. One row per device so a lost
 * phone can be revoked without touching the others.
 */
export const deviceTokens = sqliteTable(
  "device_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    label: text("label").notNull().default("iPhone"),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
  },
  (t) => [index("device_tokens_user").on(t.userId)],
);

export const profile = sqliteTable(
  "profile",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().unique(),
    raceName: text("race_name").notNull(),
    raceDate: text("race_date").notNull(),
    startDate: text("start_date").notNull(),
    experience: text("experience").notNull().default("beginner"),
    goal: text("goal").notNull().default("finish"),
    timeGoalSec: integer("time_goal_sec"),
    longRunDay: integer("long_run_day").notNull().default(6),
    /** IANA zone the plan's days, reminders, and crons are measured in. */
    timeZone: text("time_zone").notNull().default("America/Chicago"),
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
  },
  (t) => [index("profile_user").on(t.userId)],
);

export const workouts = sqliteTable(
  "workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
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
  },
  (t) => [unique("workouts_user_date").on(t.userId, t.date)],
);

export const workoutLogs = sqliteTable(
  "workout_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
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
  },
  (t) => [unique("workout_logs_user_date").on(t.userId, t.date)],
);

/**
 * One row per morning. Sleep is keyed by the day you woke up, so "last night's
 * sleep" on Today is simply the row for today's date. All sleep blocks that end
 * that morning (night + naps) are summed into the minute fields.
 */
export const healthDays = sqliteTable(
  "health_days",
  {
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    sleepStart: text("sleep_start"),
    sleepEnd: text("sleep_end"),
    asleepMin: integer("asleep_min"),
    inBedMin: integer("in_bed_min"),
    /** Staged minutes from Apple Sleep (REM / Core / Deep). */
    remMin: integer("rem_min"),
    coreMin: integer("core_min"),
    deepMin: integer("deep_min"),
    /** Average heart rate across asleep windows that day. */
    sleepHr: integer("sleep_hr"),
    restingHr: integer("resting_hr"),
    /** Apple's walking heart-rate average for the day. */
    walkingHr: integer("walking_hr"),
    /** Daytime continuous heart-rate range from the Watch. */
    hrMin: integer("hr_min"),
    hrAvg: integer("hr_avg"),
    hrMax: integer("hr_max"),
    hrvMs: real("hrv_ms"),
    /** Day's HRV (SDNN) range across Watch readings. */
    hrvMin: real("hrv_min"),
    hrvMax: real("hrv_max"),
    hrvCount: integer("hrv_count"),
    steps: integer("steps"),
    activeKcal: integer("active_kcal"),
    /** Body composition, from the Watch/scale or typed in by hand. */
    weightKg: real("weight_kg"),
    bodyFatPct: real("body_fat_pct"),
    waistCm: real("waist_cm"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/** One row per account so Today can show when that phone last handed over data. */
export const healthSync = sqliteTable("health_sync", {
  userId: text("user_id").primaryKey(),
  lastSyncAt: text("last_sync_at").notNull(),
  device: text("device"),
  daysSeen: integer("days_seen").notNull().default(0),
  workoutsSeen: integer("workouts_seen").notNull().default(0),
});

export const mealPlans = sqliteTable(
  "meal_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
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
  (t) => [unique("meal_plans_user_date_slot").on(t.userId, t.date, t.slot)],
);

export const foodLogs = sqliteTable(
  "food_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    name: text("name").notNull(),
    calories: integer("calories").notNull().default(0),
    protein: integer("protein").notNull().default(0),
    carbs: integer("carbs").notNull().default(0),
    fat: integer("fat").notNull().default(0),
    source: text("source").notNull().default("custom"),
    mealPlanId: integer("meal_plan_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("food_logs_user_date").on(t.userId, t.date)],
);

export const dayLogs = sqliteTable(
  "day_logs",
  {
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    waterOz: integer("water_oz").notNull().default(0),
    sodiumMg: integer("sodium_mg").notNull().default(0),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const groceryChecks = sqliteTable(
  "grocery_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    weekStart: text("week_start").notNull(),
    itemKey: text("item_key").notNull(),
    checked: integer("checked").notNull().default(0),
  },
  (t) => [unique("grocery_user_week_item").on(t.userId, t.weekStart, t.itemKey)],
);

/** Persistent pantry: ingredients you already have at home. */
export const pantryItems = sqliteTable(
  "pantry_items",
  {
    userId: text("user_id").notNull(),
    itemKey: text("item_key").notNull(),
    haveAtHome: integer("have_at_home").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemKey] })],
);

export const supplementPrefs = sqliteTable(
  "supplement_prefs",
  {
    userId: text("user_id").notNull(),
    id: text("id").notNull(),
    enabled: integer("enabled").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const supplementLogs = sqliteTable(
  "supplement_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    supplementId: text("supplement_id").notNull(),
    taken: integer("taken").notNull().default(0),
  },
  (t) => [unique("supp_log_user_date_id").on(t.userId, t.date, t.supplementId)],
);

export const fuelChecks = sqliteTable(
  "fuel_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    stage: text("stage").notNull(),
    checked: integer("checked").notNull().default(0),
  },
  (t) => [unique("fuel_user_date_stage").on(t.userId, t.date, t.stage)],
);

/** Endpoint stays globally unique — a browser subscription has one owner. */
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("push_subscriptions_user").on(t.userId)],
);

export const reminderRuns = sqliteTable(
  "reminder_runs",
  {
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    sentAt: text("sent_at").notNull(),
    channels: text("channels").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/**
 * Lifting and core sit beside the run plan rather than inside it: one row per
 * date that has strength work, with the exercise list stored as JSON.
 */
export const strengthSessions = sqliteTable(
  "strength_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
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
  },
  (t) => [unique("strength_sessions_user_date").on(t.userId, t.date)],
);

export const strengthChecks = sqliteTable(
  "strength_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    exerciseId: text("exercise_id").notNull(),
    done: integer("done").notNull().default(0),
    load: text("load"),
  },
  (t) => [unique("strength_check_user_date_ex").on(t.userId, t.date, t.exerciseId)],
);

export const strengthLogs = sqliteTable(
  "strength_logs",
  {
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    minutes: integer("minutes"),
    rpe: integer("rpe"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/**
 * Every coach proposal, kept whether or not it was taken. Nothing here changes
 * the plan until the runner presses Apply.
 */
export const coachSuggestions = sqliteTable(
  "coach_suggestions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
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
    /** pending | applied | dismissed | expired | deleted (tombstone, never shown). */
    status: text("status").notNull().default("pending"),
    decidedAt: text("decided_at"),
    /** The data snapshot the advice was based on, for later reading. */
    snapshot: text("snapshot"),
    /** Stable hash so the same nudge is not raised twice in a day. */
    fingerprint: text("fingerprint").notNull(),
  },
  (t) => [unique("coach_user_fingerprint").on(t.userId, t.fingerprint)],
);

/** Small key/value bag for things that are neither profile nor training data. */
export const settings = sqliteTable(
  "settings",
  {
    userId: text("user_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type DeviceToken = typeof deviceTokens.$inferSelect;
export type Profile = typeof profile.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type HealthDay = typeof healthDays.$inferSelect;
export type HealthSync = typeof healthSync.$inferSelect;
export type MealPlanRow = typeof mealPlans.$inferSelect;
export type FoodLog = typeof foodLogs.$inferSelect;
export type DayLog = typeof dayLogs.$inferSelect;
export type PantryItem = typeof pantryItems.$inferSelect;
export type StrengthSession = typeof strengthSessions.$inferSelect;
export type StrengthCheck = typeof strengthChecks.$inferSelect;
export type StrengthLog = typeof strengthLogs.$inferSelect;
export type CoachSuggestion = typeof coachSuggestions.$inferSelect;
