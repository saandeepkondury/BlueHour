"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { startOfWeek, todayISO } from "@/lib/date";
import { holdWeek, markDone, markPlanned, moveLongRun, skipWorkout } from "@/lib/plan/adapt";
import { recipeById } from "@/lib/nutrition/recipes";
import { saveManualHealth } from "@/lib/health/manual";
import {
  completeStrength,
  reopenStrength,
  skipStrength,
  toggleExercise,
} from "@/lib/strength/log";
import {
  applySuggestion,
  dismissSuggestion,
  expireOldSuggestions,
  refreshCoach,
} from "@/lib/coach/store";
import { KEYS, setSetting } from "@/lib/settings";
import { buildBrief } from "@/lib/notify/brief";
import { sendPush } from "@/lib/notify/push";
import {
  addFoodLog,
  addWater,
  deleteFoodLog,
  ensureWeekMeals,
  getProfile,
  replaceMeal,
  resetGroceryChecks,
  reshuffleWeekMeals,
  saveWorkoutLog,
  setMealEaten,
  setSupplementEnabled,
  toggleFuelCheck,
  toggleGroceryCheck,
  toggleSupplementTaken,
  updateProfile,
} from "@/lib/store";

function refresh(date?: string) {
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/fuel");
  revalidatePath("/fuel/grocery");
  revalidatePath("/fuel/supplements");
  revalidatePath("/progress");
  revalidatePath("/core");
  revalidatePath("/coach");
  if (date) revalidatePath(`/day/${date}`);
}

function num(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

// ---------- training ----------

export async function completeWorkout(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;

  const distance = num(formData.get("distanceMi"));
  const minutes = num(formData.get("minutes"));
  const seconds = num(formData.get("seconds"));
  const hasTime = minutes !== null || seconds !== null;

  await saveWorkoutLog({
    date,
    distanceMi: distance ?? 0,
    durationSec: hasTime ? Math.round((minutes ?? 0) * 60 + (seconds ?? 0)) : null,
    rpe: num(formData.get("rpe")),
    feel: str(formData.get("feel")) || null,
    notes: str(formData.get("notes")) || null,
  });
  await markDone(date);
  refresh(date);
}

export async function completeRestDay(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;
  await markDone(date);
  refresh(date);
}

export async function skipDay(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;
  await skipWorkout(date, str(formData.get("reason")));
  refresh(date);
}

export async function reopenDay(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;
  await markPlanned(date);
  refresh(date);
}

export async function holdCurrentWeek(formData: FormData): Promise<void> {
  const weekStart = str(formData.get("weekStart")) || startOfWeek(todayISO());
  await holdWeek(weekStart);
  refresh();
}

export async function moveLongRunTo(formData: FormData): Promise<void> {
  const weekStart = str(formData.get("weekStart")) || startOfWeek(todayISO());
  const dow = num(formData.get("dow"));
  if (dow === null) return;
  await moveLongRun(weekStart, dow);
  refresh();
}

// ---------- nutrition ----------

export async function toggleMeal(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const slot = str(formData.get("slot"));
  const eaten = str(formData.get("eaten")) === "1";
  if (!date || !slot) return;
  await setMealEaten(date, slot, eaten);
  refresh(date);
}

export async function swapMeal(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const slot = str(formData.get("slot"));
  const recipeId = str(formData.get("recipeId"));
  if (!date || !slot) return;

  const recipe = recipeById(recipeId);
  if (!recipe) return;

  await replaceMeal(date, slot, {
    slot: recipe.slot,
    recipeId: recipe.id,
    name: recipe.name,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
  });
  refresh(date);
}

export async function addCustomFood(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const name = str(formData.get("name"));
  if (!date || !name) return;

  await addFoodLog({
    date,
    name,
    calories: Math.max(0, num(formData.get("calories")) ?? 0),
    protein: Math.max(0, num(formData.get("protein")) ?? 0),
    carbs: Math.max(0, num(formData.get("carbs")) ?? 0),
    fat: Math.max(0, num(formData.get("fat")) ?? 0),
  });
  refresh(date);
}

export async function removeFood(formData: FormData): Promise<void> {
  const id = num(formData.get("id"));
  const date = str(formData.get("date"));
  if (id === null) return;
  await deleteFoodLog(id);
  refresh(date);
}

export async function logWater(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const oz = num(formData.get("oz"));
  if (!date || oz === null) return;
  await addWater(date, oz);
  refresh(date);
}

export async function toggleFuelStage(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const stage = str(formData.get("stage"));
  const checked = str(formData.get("checked")) === "1";
  if (!date || !stage) return;
  await toggleFuelCheck(date, stage, checked);
  refresh(date);
}

export async function toggleSupplement(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const id = str(formData.get("id"));
  const taken = str(formData.get("taken")) === "1";
  if (!date || !id) return;
  await toggleSupplementTaken(date, id, taken);
  refresh(date);
}

export async function setSupplementPref(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  const enabled = str(formData.get("enabled")) === "1";
  if (!id) return;
  await setSupplementEnabled(id, enabled);
  refresh();
}

export async function toggleGroceryItem(formData: FormData): Promise<void> {
  const weekStart = str(formData.get("weekStart"));
  const itemKey = str(formData.get("itemKey"));
  const checked = str(formData.get("checked")) === "1";
  if (!weekStart || !itemKey) return;
  await toggleGroceryCheck(weekStart, itemKey, checked);
  revalidatePath("/fuel/grocery");
}

export async function clearGrocery(formData: FormData): Promise<void> {
  const weekStart = str(formData.get("weekStart"));
  if (!weekStart) return;
  await resetGroceryChecks(weekStart);
  revalidatePath("/fuel/grocery");
}

/** Reshuffles a week of meals — useful when the plan stops sounding appetizing. */
export async function reshuffleWeek(formData: FormData): Promise<void> {
  const weekStart = str(formData.get("weekStart"));
  if (!weekStart) return;
  await ensureWeekMeals(weekStart);
  await reshuffleWeekMeals(weekStart);
  await resetGroceryChecks(weekStart);
  refresh();
}

// ---------- profile ----------

export async function saveProfile(formData: FormData): Promise<void> {
  const current = await getProfile();

  const heightIn = num(formData.get("heightIn"));
  const weightLb = num(formData.get("weightLb"));

  await updateProfile({
    raceName: str(formData.get("raceName")) || current.raceName,
    raceDate: str(formData.get("raceDate")) || current.raceDate,
    startDate: str(formData.get("startDate")) || current.startDate,
    longRunDay: num(formData.get("longRunDay")) ?? current.longRunDay,
    goal: str(formData.get("goal")) || current.goal,
    timeGoalSec: num(formData.get("timeGoalMin")) ? Math.round((num(formData.get("timeGoalMin")) ?? 0) * 60) : null,
    heightCm: heightIn !== null ? Math.round(heightIn * 2.54 * 10) / 10 : current.heightCm,
    weightKg: weightLb !== null ? Math.round((weightLb / 2.20462) * 10) / 10 : current.weightKg,
    age: num(formData.get("age")) ?? current.age,
    sex: str(formData.get("sex")) || current.sex,
    dietPref: str(formData.get("dietPref")) || current.dietPref,
    allergies: str(formData.get("allergies")),
    reminderHour: num(formData.get("reminderHour")) ?? current.reminderHour,
    remindersEnabled: str(formData.get("remindersEnabled")) === "1" ? 1 : 0,
    onboardedAt: current.onboardedAt ?? new Date().toISOString(),
  });

  refresh();
  revalidatePath("/settings");
}

export async function saveGoals(formData: FormData): Promise<void> {
  const current = await getProfile();
  const absGoal = str(formData.get("absGoal")) === "1" ? 1 : 0;
  const target = num(formData.get("targetBodyFatPct"));

  await updateProfile({
    absGoal,
    targetBodyFatPct: target === null ? null : Math.max(8, Math.min(30, target)),
    strengthDays: Math.max(0, Math.min(3, num(formData.get("strengthDays")) ?? current.strengthDays)),
    aiEnabled: str(formData.get("aiEnabled")) === "1" ? 1 : 0,
  });

  refresh();
  revalidatePath("/settings");
}

// ---------- strength & core ----------

export async function toggleStrengthExercise(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const exerciseId = str(formData.get("exerciseId"));
  const done = str(formData.get("done")) === "1";
  if (!date || !exerciseId) return;
  await toggleExercise(date, exerciseId, done);
  refresh(date);
}

export async function finishStrength(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;
  await completeStrength(date, {
    minutes: num(formData.get("minutes")),
    rpe: num(formData.get("rpe")),
    notes: str(formData.get("notes")) || null,
  });
  refresh(date);
}

export async function skipStrengthSession(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;
  await skipStrength(date, str(formData.get("reason")));
  refresh(date);
}

export async function reopenStrengthSession(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;
  await reopenStrength(date);
  refresh(date);
}

// ---------- health by hand ----------

export async function saveHealthEntry(formData: FormData): Promise<void> {
  const date = str(formData.get("date")) || todayISO();
  const sleepHours = num(formData.get("sleepHours"));
  const weightLb = num(formData.get("weightLb"));
  const waistIn = num(formData.get("waistIn"));

  await saveManualHealth({
    date,
    asleepMin: sleepHours === null ? null : Math.round(sleepHours * 60),
    restingHr: num(formData.get("restingHr")),
    hrvMs: num(formData.get("hrvMs")),
    weightKg: weightLb === null ? null : Math.round((weightLb / 2.20462) * 10) / 10,
    bodyFatPct: num(formData.get("bodyFatPct")),
    waistCm: waistIn === null ? null : Math.round(waistIn * 2.54 * 10) / 10,
  });

  refresh(date);
  revalidatePath("/settings/watch");
}

// ---------- coach ----------

/** Asks for advice now. Suggestions land as proposals; nothing changes yet. */
export async function askCoach(): Promise<void> {
  const current = await getProfile();
  await expireOldSuggestions();
  await refreshCoach(current, { useModel: true });
  refresh();
}

export async function applySuggestionAction(formData: FormData): Promise<void> {
  const id = num(formData.get("id"));
  if (id === null) return;
  const current = await getProfile();
  await applySuggestion(id, current);
  refresh();
}

export async function dismissSuggestionAction(formData: FormData): Promise<void> {
  const id = num(formData.get("id"));
  if (id === null) return;
  await dismissSuggestion(id);
  refresh();
}

export async function saveCoachSettings(formData: FormData): Promise<void> {
  const key = str(formData.get("openaiKey"));
  const model = str(formData.get("openaiModel"));

  // An empty field clears the stored value rather than writing an empty string.
  if (key !== "" || str(formData.get("clearKey")) === "1") {
    await setSetting(KEYS.openaiKey, key);
  }
  await setSetting(KEYS.openaiModel, model);

  refresh();
  revalidatePath("/settings");
}

export async function clearFuelOverrides(): Promise<void> {
  await setSetting(KEYS.calorieDelta, "");
  await setSetting(KEYS.proteinFloor, "");
  refresh();
}

/**
 * Sends the morning brief as a push notification right now, ignoring the
 * reminder hour. Use it to confirm the device is subscribed before race week.
 */
export async function sendTestBrief(): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const brief = await buildBrief(todayISO(), appUrl);
  if (!brief) return;

  await sendPush(brief.push);
  revalidatePath("/settings");
}

/** Mints the bearer token the iPhone Shortcut sends with every sync. */
export async function rotateIngestToken(): Promise<void> {
  await setSetting(KEYS.ingestToken, randomBytes(24).toString("base64url"));
  revalidatePath("/settings/watch");
}
