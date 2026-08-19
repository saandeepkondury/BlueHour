/**
 * Checks that a database created before accounts existed survives the upgrade.
 *
 *   node scripts/verify-legacy-upgrade.mjs seed   # writes a pre-accounts local.db
 *   npm run build && npm start
 *   node scripts/verify-legacy-upgrade.mjs check  # first account should inherit it
 *
 * The old schema keyed rows by date alone, so the upgrade has to rebuild each
 * table to put user_id inside the primary key. This is the check that the
 * rebuild keeps the rows.
 */

import { createClient } from "@libsql/client";

const BASE = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
const url = process.env.DATABASE_URL || "file:./local.db";

const LEGACY_SCHEMA = [
  `CREATE TABLE profile (
    id INTEGER PRIMARY KEY,
    race_name TEXT NOT NULL,
    race_date TEXT NOT NULL,
    start_date TEXT NOT NULL,
    experience TEXT NOT NULL DEFAULT 'beginner',
    goal TEXT NOT NULL DEFAULT 'finish',
    time_goal_sec INTEGER,
    long_run_day INTEGER NOT NULL DEFAULT 6,
    height_cm REAL, weight_kg REAL, age INTEGER, sex TEXT,
    diet_pref TEXT NOT NULL DEFAULT 'omnivore',
    allergies TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    reminder_hour INTEGER NOT NULL DEFAULT 6,
    reminders_enabled INTEGER NOT NULL DEFAULT 1,
    abs_goal INTEGER NOT NULL DEFAULT 1,
    target_body_fat_pct REAL,
    strength_days INTEGER NOT NULL DEFAULT 2,
    ai_enabled INTEGER NOT NULL DEFAULT 1,
    onboarded_at TEXT, updated_at TEXT
  )`,
  `CREATE TABLE workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    week INTEGER NOT NULL, weeks_to_race INTEGER NOT NULL,
    phase TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL,
    distance_mi REAL NOT NULL DEFAULT 0, duration_min INTEGER,
    purpose TEXT NOT NULL DEFAULT '', tip TEXT,
    status TEXT NOT NULL DEFAULT 'planned', skip_reason TEXT
  )`,
  `CREATE TABLE workout_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    distance_mi REAL NOT NULL DEFAULT 0, duration_sec INTEGER,
    rpe INTEGER, feel TEXT, notes TEXT, created_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual', external_id TEXT,
    avg_hr INTEGER, max_hr INTEGER, active_kcal INTEGER,
    start_at TEXT, end_at TEXT
  )`,
  `CREATE TABLE health_days (
    date TEXT PRIMARY KEY,
    sleep_start TEXT, sleep_end TEXT, asleep_min INTEGER, in_bed_min INTEGER,
    rem_min INTEGER, core_min INTEGER, deep_min INTEGER, sleep_hr INTEGER,
    resting_hr INTEGER, walking_hr INTEGER, hr_min INTEGER, hr_avg INTEGER,
    hr_max INTEGER, hrv_ms REAL, hrv_min REAL, hrv_max REAL, hrv_count INTEGER,
    steps INTEGER, active_kcal INTEGER, weight_kg REAL, body_fat_pct REAL,
    waist_cm REAL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE health_sync (
    id INTEGER PRIMARY KEY, last_sync_at TEXT NOT NULL, device TEXT,
    days_seen INTEGER NOT NULL DEFAULT 0, workouts_seen INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE day_logs (
    date TEXT PRIMARY KEY, water_oz INTEGER NOT NULL DEFAULT 0,
    sodium_mg INTEGER NOT NULL DEFAULT 0, notes TEXT
  )`,
  `CREATE TABLE settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
];

const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

async function seed() {
  const client = createClient({ url });
  for (const table of ["profile", "workouts", "workout_logs", "health_days", "health_sync", "day_logs", "settings"]) {
    await client.execute(`DROP TABLE IF EXISTS ${table}`);
  }
  for (const statement of LEGACY_SCHEMA) await client.execute(statement);

  await client.execute({
    sql: `INSERT INTO profile (id, race_name, race_date, start_date, onboarded_at, updated_at)
          VALUES (1, ?, ?, ?, ?, ?)`,
    args: ["Ascension Seton Austin Half Marathon", "2027-02-14", today, now, now],
  });
  await client.execute({
    sql: `INSERT INTO workouts (date, week, weeks_to_race, phase, type, title, distance_mi)
          VALUES (?, 1, 27, 'base', 'easy', 'Legacy easy run — 3 mi', 3)`,
    args: [today],
  });
  await client.execute({
    sql: `INSERT INTO workout_logs (date, distance_mi, duration_sec, created_at, source)
          VALUES (?, 3.2, 1980, ?, 'healthkit')`,
    args: [today, now],
  });
  await client.execute({
    sql: `INSERT INTO health_days (date, asleep_min, resting_hr, hrv_ms, updated_at)
          VALUES (?, 452, 49, 77, ?)`,
    args: [today, now],
  });
  await client.execute({
    sql: `INSERT INTO health_sync (id, last_sync_at, device) VALUES (1, ?, 'Legacy iPhone')`,
    args: [now],
  });
  await client.execute({
    sql: `INSERT INTO day_logs (date, water_oz) VALUES (?, 54)`,
    args: [today],
  });
  await client.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES ('calorie_delta', '-120', ?)`,
    args: [now],
  });
  // Pins the cup size so the unrelated 8oz-to-18oz water rescale does not fire
  // and change the number this check is asserting.
  await client.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES ('water_cup_oz', '18', ?)`,
    args: [now],
  });

  console.log("Seeded a pre-accounts database at", url);
  console.log("Now run: npm run build && npm start, then this script with 'check'.");
}

let failures = 0;
function check(label, condition, detail) {
  if (!condition) failures += 1;
  console.log(`${condition ? "pass" : "FAIL"}  ${label}${detail && !condition ? ` — ${detail}` : ""}`);
}

async function verify() {
  const signup = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `legacy-owner-${Date.now()}@example.test`,
      password: "correct horse battery",
      name: "Legacy owner",
    }),
  });
  const body = await signup.json();
  check("first account is created on the upgraded database", signup.status === 200, JSON.stringify(body));
  if (signup.status !== 200) return;

  const day = await fetch(`${BASE}/api/health/day?date=${today}`, {
    headers: { Authorization: `Bearer ${body.token}` },
  }).then((response) => response.json());

  check("legacy sleep was adopted", day?.sleep?.asleepMin === 452, JSON.stringify(day?.sleep));
  check("legacy resting HR was adopted", day?.heart?.restingHr === 49, String(day?.heart?.restingHr));
  check("legacy water was adopted", day?.water?.oz === 54, String(day?.water?.oz));
  check("legacy planned workout was adopted", day?.activity?.planned?.title === "Legacy easy run — 3 mi", JSON.stringify(day?.activity?.planned));
  check("legacy run log was adopted", day?.activity?.workout?.distanceMi === 3.2, JSON.stringify(day?.activity?.workout));
  check("legacy sync device was adopted", day?.lastSyncDevice === "Legacy iPhone", String(day?.lastSyncDevice));

  // A second account must NOT inherit anything.
  const second = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `second-owner-${Date.now()}@example.test`,
      password: "correct horse battery",
    }),
  }).then((response) => response.json());

  const secondDay = await fetch(`${BASE}/api/health/day?date=${today}`, {
    headers: { Authorization: `Bearer ${second.token}` },
  }).then((response) => response.json());

  check("a later account inherits nothing", secondDay?.sleep?.asleepMin === null && (secondDay?.water?.oz ?? 0) === 0, JSON.stringify({ sleep: secondDay?.sleep?.asleepMin, water: secondDay?.water?.oz }));

  const client = createClient({ url });
  const shape = await client.execute(`PRAGMA table_info(health_days)`);
  const pk = shape.rows.filter((row) => Number(row.pk) > 0).map((row) => String(row.name));
  check("health_days is now keyed by (user_id, date)", pk.join(",") === "user_id,date", pk.join(","));

  const leftovers = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%__pre_accounts'`,
  );
  check("no rebuild scratch tables were left behind", leftovers.rows.length === 0, JSON.stringify(leftovers.rows));

  console.log(failures === 0 ? "\nLegacy upgrade preserved the data." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

const mode = process.argv[2];
if (mode === "seed") await seed();
else if (mode === "check") await verify();
else {
  console.error("Usage: node scripts/verify-legacy-upgrade.mjs seed|check");
  process.exit(1);
}
