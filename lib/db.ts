import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/drizzle/schema";

const DDL = [
  `CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY,
    race_name TEXT NOT NULL,
    race_date TEXT NOT NULL,
    start_date TEXT NOT NULL,
    experience TEXT NOT NULL DEFAULT 'beginner',
    goal TEXT NOT NULL DEFAULT 'finish',
    time_goal_sec INTEGER,
    long_run_day INTEGER NOT NULL DEFAULT 6,
    height_cm REAL,
    weight_kg REAL,
    age INTEGER,
    sex TEXT,
    diet_pref TEXT NOT NULL DEFAULT 'omnivore',
    allergies TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    reminder_hour INTEGER NOT NULL DEFAULT 6,
    reminders_enabled INTEGER NOT NULL DEFAULT 1,
    onboarded_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    week INTEGER NOT NULL,
    weeks_to_race INTEGER NOT NULL,
    phase TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    distance_mi REAL NOT NULL DEFAULT 0,
    duration_min INTEGER,
    purpose TEXT NOT NULL DEFAULT '',
    tip TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    skip_reason TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS workout_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    distance_mi REAL NOT NULL DEFAULT 0,
    duration_sec INTEGER,
    rpe INTEGER,
    feel TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    recipe_id TEXT,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL DEFAULT 0,
    protein INTEGER NOT NULL DEFAULT 0,
    carbs INTEGER NOT NULL DEFAULT 0,
    fat INTEGER NOT NULL DEFAULT 0,
    eaten INTEGER NOT NULL DEFAULT 0,
    UNIQUE (date, slot)
  )`,
  `CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL DEFAULT 0,
    protein INTEGER NOT NULL DEFAULT 0,
    carbs INTEGER NOT NULL DEFAULT 0,
    fat INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'custom',
    meal_plan_id INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS day_logs (
    date TEXT PRIMARY KEY,
    water_oz INTEGER NOT NULL DEFAULT 0,
    sodium_mg INTEGER NOT NULL DEFAULT 0,
    notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS grocery_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    item_key TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    UNIQUE (week_start, item_key)
  )`,
  `CREATE TABLE IF NOT EXISTS pantry_items (
    item_key TEXT PRIMARY KEY,
    have_at_home INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS supplement_prefs (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS supplement_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    supplement_id TEXT NOT NULL,
    taken INTEGER NOT NULL DEFAULT 0,
    UNIQUE (date, supplement_id)
  )`,
  `CREATE TABLE IF NOT EXISTS fuel_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    stage TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    UNIQUE (date, stage)
  )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reminder_runs (
    date TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL,
    channels TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS health_days (
    date TEXT PRIMARY KEY,
    sleep_start TEXT,
    sleep_end TEXT,
    asleep_min INTEGER,
    in_bed_min INTEGER,
    rem_min INTEGER,
    core_min INTEGER,
    deep_min INTEGER,
    sleep_hr INTEGER,
    resting_hr INTEGER,
    walking_hr INTEGER,
    hr_min INTEGER,
    hr_avg INTEGER,
    hr_max INTEGER,
    hrv_ms REAL,
    hrv_min REAL,
    hrv_max REAL,
    hrv_count INTEGER,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS health_sync (
    id INTEGER PRIMARY KEY,
    last_sync_at TEXT NOT NULL,
    device TEXT,
    days_seen INTEGER NOT NULL DEFAULT 0,
    workouts_seen INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS strength_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    week INTEGER NOT NULL,
    phase TEXT NOT NULL,
    focus TEXT NOT NULL,
    title TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT '',
    minutes INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    blocks TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    skip_reason TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS strength_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    load TEXT,
    UNIQUE (date, exercise_id)
  )`,
  `CREATE TABLE IF NOT EXISTS strength_logs (
    date TEXT PRIMARY KEY,
    minutes INTEGER,
    rpe INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS coach_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    date TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'rules',
    model TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    rationale TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'medium',
    changes TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    decided_at TEXT,
    snapshot TEXT,
    fingerprint TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

/**
 * Additive column adds for databases created before HealthKit import existed.
 * SQLite has no "ADD COLUMN IF NOT EXISTS", so re-runs are expected to fail.
 */
const COLUMN_ADDS = [
  `ALTER TABLE workout_logs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE workout_logs ADD COLUMN external_id TEXT`,
  `ALTER TABLE workout_logs ADD COLUMN avg_hr INTEGER`,
  `ALTER TABLE workout_logs ADD COLUMN max_hr INTEGER`,
  `ALTER TABLE workout_logs ADD COLUMN active_kcal INTEGER`,
  `ALTER TABLE workout_logs ADD COLUMN start_at TEXT`,
  `ALTER TABLE workout_logs ADD COLUMN end_at TEXT`,
  `ALTER TABLE health_days ADD COLUMN steps INTEGER`,
  `ALTER TABLE health_days ADD COLUMN active_kcal INTEGER`,
  `ALTER TABLE health_days ADD COLUMN weight_kg REAL`,
  `ALTER TABLE health_days ADD COLUMN body_fat_pct REAL`,
  `ALTER TABLE health_days ADD COLUMN waist_cm REAL`,
  `ALTER TABLE health_days ADD COLUMN rem_min INTEGER`,
  `ALTER TABLE health_days ADD COLUMN core_min INTEGER`,
  `ALTER TABLE health_days ADD COLUMN deep_min INTEGER`,
  `ALTER TABLE health_days ADD COLUMN sleep_hr INTEGER`,
  `ALTER TABLE health_days ADD COLUMN walking_hr INTEGER`,
  `ALTER TABLE health_days ADD COLUMN hr_min INTEGER`,
  `ALTER TABLE health_days ADD COLUMN hr_avg INTEGER`,
  `ALTER TABLE health_days ADD COLUMN hr_max INTEGER`,
  `ALTER TABLE health_days ADD COLUMN hrv_min REAL`,
  `ALTER TABLE health_days ADD COLUMN hrv_max REAL`,
  `ALTER TABLE health_days ADD COLUMN hrv_count INTEGER`,
  `ALTER TABLE profile ADD COLUMN abs_goal INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE profile ADD COLUMN target_body_fat_pct REAL`,
  `ALTER TABLE profile ADD COLUMN strength_days INTEGER NOT NULL DEFAULT 2`,
  `ALTER TABLE profile ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 1`,
];

type Global = typeof globalThis & {
  __bhClient?: Client;
  __bhReady?: Promise<void>;
};

const g = globalThis as Global;

function client(): Client {
  if (!g.__bhClient) {
    g.__bhClient = createClient({
      url:
        process.env.DATABASE_URL ||
        process.env.TURSO_DATABASE_URL ||
        "file:./local.db",
      authToken:
        process.env.DATABASE_AUTH_TOKEN ||
        process.env.TURSO_AUTH_TOKEN ||
        undefined,
    });
  }
  return g.__bhClient;
}

export const db: LibSQLDatabase<typeof schema> = drizzle(client(), { schema });

/**
 * Creates tables on first use. The schema is small and additive, so running the
 * DDL on boot keeps a single-user deploy from needing a migration step.
 */
export function ready(): Promise<void> {
  if (!g.__bhReady) {
    g.__bhReady = (async () => {
      for (const statement of DDL) {
        await client().execute(statement);
      }
      for (const statement of COLUMN_ADDS) {
        try {
          await client().execute(statement);
        } catch (error) {
          if (!isDuplicateColumn(error)) throw error;
        }
      }
    })();
  }
  return g.__bhReady;
}

function isDuplicateColumn(error: unknown): boolean {
  return error instanceof Error && /duplicate column name/i.test(error.message);
}
