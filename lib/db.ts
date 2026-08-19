import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/drizzle/schema";

/**
 * Rows that predate accounts are parked under this owner and handed to the
 * first account created on the deploy, so upgrading a personal install does not
 * lose its training history. See `adoptLegacyData` in lib/auth/users.ts.
 */
export const LEGACY_USER_ID = "legacy";

const TABLES: Record<string, string> = {
  users: `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL DEFAULT '',
    apple_sub TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  sessions: `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent TEXT
  )`,
  device_tokens: `CREATE TABLE IF NOT EXISTS device_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT 'iPhone',
    created_at TEXT NOT NULL,
    last_used_at TEXT
  )`,
  profile: `CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    race_name TEXT NOT NULL,
    race_date TEXT NOT NULL,
    start_date TEXT NOT NULL,
    experience TEXT NOT NULL DEFAULT 'beginner',
    goal TEXT NOT NULL DEFAULT 'finish',
    time_goal_sec INTEGER,
    long_run_day INTEGER NOT NULL DEFAULT 6,
    time_zone TEXT NOT NULL DEFAULT 'America/Chicago',
    height_cm REAL,
    weight_kg REAL,
    age INTEGER,
    sex TEXT,
    diet_pref TEXT NOT NULL DEFAULT 'omnivore',
    allergies TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    reminder_hour INTEGER NOT NULL DEFAULT 6,
    reminders_enabled INTEGER NOT NULL DEFAULT 1,
    abs_goal INTEGER NOT NULL DEFAULT 1,
    target_body_fat_pct REAL,
    strength_days INTEGER NOT NULL DEFAULT 2,
    ai_enabled INTEGER NOT NULL DEFAULT 1,
    onboarded_at TEXT,
    updated_at TEXT
  )`,
  workouts: `CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
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
  workout_logs: `CREATE TABLE IF NOT EXISTS workout_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    distance_mi REAL NOT NULL DEFAULT 0,
    duration_sec INTEGER,
    rpe INTEGER,
    feel TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    avg_hr INTEGER,
    max_hr INTEGER,
    active_kcal INTEGER,
    start_at TEXT,
    end_at TEXT
  )`,
  health_days: `CREATE TABLE IF NOT EXISTS health_days (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
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
    steps INTEGER,
    active_kcal INTEGER,
    weight_kg REAL,
    body_fat_pct REAL,
    waist_cm REAL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
  )`,
  health_sync: `CREATE TABLE IF NOT EXISTS health_sync (
    user_id TEXT PRIMARY KEY,
    last_sync_at TEXT NOT NULL,
    device TEXT,
    days_seen INTEGER NOT NULL DEFAULT 0,
    workouts_seen INTEGER NOT NULL DEFAULT 0
  )`,
  meal_plans: `CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    recipe_id TEXT,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL DEFAULT 0,
    protein INTEGER NOT NULL DEFAULT 0,
    carbs INTEGER NOT NULL DEFAULT 0,
    fat INTEGER NOT NULL DEFAULT 0,
    eaten INTEGER NOT NULL DEFAULT 0
  )`,
  food_logs: `CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
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
  day_logs: `CREATE TABLE IF NOT EXISTS day_logs (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    water_oz INTEGER NOT NULL DEFAULT 0,
    sodium_mg INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    PRIMARY KEY (user_id, date)
  )`,
  grocery_checks: `CREATE TABLE IF NOT EXISTS grocery_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    item_key TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0
  )`,
  pantry_items: `CREATE TABLE IF NOT EXISTS pantry_items (
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    have_at_home INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, item_key)
  )`,
  supplement_prefs: `CREATE TABLE IF NOT EXISTS supplement_prefs (
    user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, id)
  )`,
  supplement_logs: `CREATE TABLE IF NOT EXISTS supplement_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    supplement_id TEXT NOT NULL,
    taken INTEGER NOT NULL DEFAULT 0
  )`,
  fuel_checks: `CREATE TABLE IF NOT EXISTS fuel_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    stage TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0
  )`,
  push_subscriptions: `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  reminder_runs: `CREATE TABLE IF NOT EXISTS reminder_runs (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    channels TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
  )`,
  strength_sessions: `CREATE TABLE IF NOT EXISTS strength_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
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
  strength_checks: `CREATE TABLE IF NOT EXISTS strength_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    load TEXT
  )`,
  strength_logs: `CREATE TABLE IF NOT EXISTS strength_logs (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    minutes INTEGER,
    rpe INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
  )`,
  coach_suggestions: `CREATE TABLE IF NOT EXISTS coach_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
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
    fingerprint TEXT NOT NULL
  )`,
  settings: `CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  )`,
};

/**
 * Tables whose rows belong to an account. A database created before accounts
 * existed has these without `user_id`, which is what triggers the rebuild.
 */
const TENANT_TABLES = [
  "profile",
  "workouts",
  "workout_logs",
  "health_days",
  "health_sync",
  "meal_plans",
  "food_logs",
  "day_logs",
  "grocery_checks",
  "pantry_items",
  "supplement_prefs",
  "supplement_logs",
  "fuel_checks",
  "push_subscriptions",
  "reminder_runs",
  "strength_sessions",
  "strength_checks",
  "strength_logs",
  "coach_suggestions",
  "settings",
];

/**
 * Unique indexes are declared separately rather than inline so a later schema
 * change can drop and rebuild them — SQLite cannot drop an inline constraint.
 */
const INDEXES = [
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS device_tokens_user ON device_tokens (user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS profile_user_unique ON profile (user_id)`,
  `CREATE INDEX IF NOT EXISTS profile_user ON profile (user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workouts_user_date ON workouts (user_id, date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_user_date ON workout_logs (user_id, date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_user_date_slot ON meal_plans (user_id, date, slot)`,
  `CREATE INDEX IF NOT EXISTS food_logs_user_date ON food_logs (user_id, date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS grocery_user_week_item ON grocery_checks (user_id, week_start, item_key)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS supp_log_user_date_id ON supplement_logs (user_id, date, supplement_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS fuel_user_date_stage ON fuel_checks (user_id, date, stage)`,
  `CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions (user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS strength_sessions_user_date ON strength_sessions (user_id, date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS strength_check_user_date_ex ON strength_checks (user_id, date, exercise_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS coach_user_fingerprint ON coach_suggestions (user_id, fingerprint)`,
];

/**
 * Additive column adds for databases created by an earlier version of this
 * schema. SQLite has no "ADD COLUMN IF NOT EXISTS", so re-runs are expected to
 * fail and the duplicate-column error is swallowed.
 */
const COLUMN_ADDS = [
  `ALTER TABLE profile ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'America/Chicago'`,
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
 * Creates tables on first use and upgrades a pre-accounts database in place.
 * The schema is small enough that this replaces a separate migration step.
 */
export function ready(): Promise<void> {
  if (!g.__bhReady) {
    g.__bhReady = (async () => {
      for (const statement of Object.values(TABLES)) {
        await client().execute(statement);
      }

      for (const table of TENANT_TABLES) {
        await addTenancy(table);
      }

      for (const statement of COLUMN_ADDS) {
        try {
          await client().execute(statement);
        } catch (error) {
          if (!isDuplicateColumn(error)) throw error;
        }
      }

      // Indexes last: several of them reference user_id, which only exists once
      // the rebuild above has run.
      for (const statement of INDEXES) {
        await client().execute(statement);
      }
    })();
  }
  return g.__bhReady;
}

async function columnsOf(table: string): Promise<string[]> {
  const result = await client().execute(`PRAGMA table_info(${table})`);
  return result.rows.map((row) => String((row as Record<string, unknown>).name));
}

/**
 * Rebuilds one pre-accounts table: rename, recreate with the multi-tenant
 * shape, copy the rows across under the legacy owner, drop the original. A
 * rebuild is the only way to change a primary key or a unique constraint in
 * SQLite, and every one of these tables needs `user_id` inside its key.
 */
async function addTenancy(table: string): Promise<void> {
  const existing = await columnsOf(table);
  if (existing.length === 0) return;
  if (existing.includes("user_id")) return;

  const legacyName = `${table}__pre_accounts`;
  await client().execute(`DROP TABLE IF EXISTS ${legacyName}`);
  await client().execute(`ALTER TABLE ${table} RENAME TO ${legacyName}`);
  await client().execute(TABLES[table]);

  const target = await columnsOf(table);
  const shared = existing.filter((column) => target.includes(column) && column !== "user_id");
  const columnList = shared.join(", ");

  if (shared.length > 0) {
    await client().execute(
      `INSERT OR REPLACE INTO ${table} (user_id, ${columnList})
       SELECT '${LEGACY_USER_ID}', ${columnList} FROM ${legacyName}`,
    );
  }

  await client().execute(`DROP TABLE ${legacyName}`);
}

function isDuplicateColumn(error: unknown): boolean {
  return error instanceof Error && /duplicate column name/i.test(error.message);
}
