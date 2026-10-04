"use server";

import { revalidatePath } from "next/cache";
import { startOfWeek, todayISO } from "@/lib/date";
import { holdWeek, markDone, markPlanned, moveLongRun, skipWorkout } from "@/lib/plan/adapt";
import { recipeById } from "@/lib/nutrition/recipes";
import { saveManualHealth } from "@/lib/health/manual";
import {
  completeStrength,
  reopenStrength,
  setExerciseLoad,
  skipStrength,
  toggleExercise,
} from "@/lib/strength/log";
import { isHabitId } from "@/lib/habits/catalog";
import { toggleStar } from "@/lib/habits/store";
import { uid } from "@/lib/auth/current";
import {
  isMealMark,
  isMealSlot,
  isMealSource,
  parseRecipeRef,
  SLOT_NAME,
} from "@/lib/meals/catalog";
import { deleteMealPhoto, PhotoError, saveMealPhoto } from "@/lib/meals/photos";
import {
  createMeal,
  deleteMeal,
  deleteUserRecipe,
  getMeal,
  linkMealRecipe,
  renameIngredient,
  saveUserRecipe,
  setMealPhoto,
  setMealStar,
  updateMeal,
} from "@/lib/meals/store";
import { KEYS, setSetting } from "@/lib/settings";
import { buildBrief } from "@/lib/notify/brief";
import { sendPush } from "@/lib/notify/push";
import {
  addFoodLog,
  addWater,
  annotateWorkoutLog,
  completeOnboarding,
  deleteFoodLog,
  getProfile,
  parseExperience,
  resetGroceryChecks,
  saveWorkoutLog,
  setPantryHave,
  setSupplementEnabled,
  toggleFuelCheck,
  toggleGroceryCheck,
  toggleSupplementTaken,
  updateProfile,
} from "@/lib/store";
import { redirect } from "next/navigation";

function refresh(date?: string, exerciseId?: string) {
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/fuel");
  revalidatePath("/fuel/grocery");
  revalidatePath("/fuel/supplements");
  revalidatePath("/progress");
  revalidatePath("/core");
  revalidatePath("/habits");
  revalidatePath("/runs");
  revalidatePath("/meals");
  revalidatePath("/water");
  revalidatePath("/sleep");
  revalidatePath("/rest-hr");
  revalidatePath("/hrv");
  if (date) revalidatePath(`/day/${date}`);
  if (exerciseId) revalidatePath(`/exercise/${exerciseId}`);
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

/** Felt / effort / notes for a run already pulled from Apple Watch. */
export async function annotateWorkout(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;

  const ok = await annotateWorkoutLog({
    date,
    rpe: num(formData.get("rpe")),
    feel: str(formData.get("feel")) || null,
    notes: str(formData.get("notes")) || null,
  });
  if (!ok) return;

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

export async function togglePantryItem(formData: FormData): Promise<void> {
  const itemKey = str(formData.get("itemKey"));
  const have = str(formData.get("have")) === "1";
  if (!itemKey) return;
  await setPantryHave(itemKey, have);
  revalidatePath("/");
  revalidatePath("/fuel");
  revalidatePath("/fuel/grocery");
  revalidatePath("/fuel/recipes");
  revalidatePath("/recipe", "layout");
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
  const itemKey = str(formData.get("itemKey"));
  const checked = str(formData.get("checked")) === "1";
  if (!itemKey) return;
  await toggleGroceryCheck(undefined, itemKey, checked);
  revalidatePath("/fuel/grocery");
  revalidatePath("/fuel");
  revalidatePath("/fuel/recipes");
  revalidatePath("/");
  revalidatePath("/recipe", "layout");
}

/** Checked off at the store: stock pantry and remove from the buy list. */
export async function markGroceryBought(formData: FormData): Promise<void> {
  const itemKey = str(formData.get("itemKey"));
  if (!itemKey) return;
  await setPantryHave(itemKey, true);
  await toggleGroceryCheck(undefined, itemKey, false);
  revalidatePath("/fuel/grocery");
  revalidatePath("/fuel");
  revalidatePath("/fuel/recipes");
  revalidatePath("/");
  revalidatePath("/recipe", "layout");
}

export async function clearGrocery(_formData: FormData): Promise<void> {
  await resetGroceryChecks();
  revalidatePath("/fuel/grocery");
}

// ---------- meal log ----------

function mealRefresh(date?: string) {
  revalidatePath("/");
  revalidatePath("/fuel");
  revalidatePath("/fuel/recipes", "layout");
  revalidatePath("/fuel/grocery");
  revalidatePath("/meals");
  revalidatePath("/recipe", "layout");
  if (date) revalidatePath(`/day/${date}`);
}

function isoDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function photoFrom(formData: FormData): File | null {
  const value = formData.get("photo");
  return value instanceof File && value.size > 0 ? value : null;
}

function recipeNameFor(ref: string): string | null {
  const parsed = parseRecipeRef(ref);
  return parsed?.kind === "catalog" ? (recipeById(parsed.id)?.name ?? null) : null;
}

export type MealResult = { ok: true; id: number } | { ok: false; error: string };

/** Logs a new meal, or updates one when `id` is set. The photo is optional either way. */
export async function saveMeal(formData: FormData): Promise<MealResult> {
  const id = num(formData.get("id"));
  const date = isoDate(str(formData.get("date")));
  const slot = str(formData.get("slot"));
  const source = str(formData.get("source"));
  const mark = str(formData.get("mark"));
  const recipeRef = str(formData.get("recipeRef")) || null;
  if (!date && id === null) return { ok: false, error: "Pick a day for this meal." };
  if (!isMealSlot(slot)) return { ok: false, error: "Pick breakfast, lunch, dinner, or snack." };
  if (!isMealSource(source)) return { ok: false, error: "Pick where the meal came from." };

  const typedName = str(formData.get("name"));
  const name =
    typedName ||
    (recipeRef ? recipeNameFor(recipeRef) : null) ||
    (recipeRef ? str(formData.get("recipeName")) : "") ||
    SLOT_NAME[slot];

  const photo = photoFrom(formData);
  let photoUrl: string | null = null;
  if (photo) {
    try {
      photoUrl = await saveMealPhoto(await uid(), photo);
    } catch (error) {
      return { ok: false, error: error instanceof PhotoError ? error.message : "The photo did not upload." };
    }
  }

  const input = { slot, name, source, mark: isMealMark(mark) ? mark : null, recipeRef };
  let savedId: number;
  if (id !== null) {
    const existing = await getMeal(id);
    if (!existing) return { ok: false, error: "That meal is gone." };
    await updateMeal(id, input);
    if (photoUrl) await deleteMealPhoto(await setMealPhoto(id, photoUrl));
    else if (str(formData.get("removePhoto")) === "1") await deleteMealPhoto(await setMealPhoto(id, null));
    savedId = id;
    mealRefresh(existing.date);
  } else {
    savedId = await createMeal({ ...input, date: date!, photoUrl });
    mealRefresh(date!);
  }
  return { ok: true, id: savedId };
}

export async function addMealPhoto(formData: FormData): Promise<MealResult> {
  const id = num(formData.get("id"));
  const photo = photoFrom(formData);
  if (id === null || !photo) return { ok: false, error: "Pick a photo." };
  const meal = await getMeal(id);
  if (!meal) return { ok: false, error: "That meal is gone." };
  try {
    const url = await saveMealPhoto(await uid(), photo);
    await deleteMealPhoto(await setMealPhoto(id, url));
  } catch (error) {
    return { ok: false, error: error instanceof PhotoError ? error.message : "The photo did not upload." };
  }
  mealRefresh(meal.date);
  return { ok: true, id };
}

export async function starMeal(formData: FormData): Promise<void> {
  const id = num(formData.get("id"));
  if (id === null) return;
  await setMealStar(id, str(formData.get("starred")) === "1");
  mealRefresh(str(formData.get("date")) || undefined);
}

export async function removeMeal(formData: FormData): Promise<void> {
  const id = num(formData.get("id"));
  if (id === null) return;
  await deleteMealPhoto(await deleteMeal(id));
  mealRefresh(str(formData.get("date")) || undefined);
}

export type RecipeResult = { ok: true; id: number } | { ok: false; error: string };

/** Saves a recipe you wrote, then links it to a meal if one is waiting for it. */
export async function saveRecipe(input: {
  id?: number;
  name: string;
  steps: string[];
  ingredients: { name: string; amount: string }[];
  mealId?: number;
}): Promise<RecipeResult> {
  if (!str(input.name)) return { ok: false, error: "Give the recipe a name." };
  const id = await saveUserRecipe({
    id: input.id,
    name: input.name,
    steps: Array.isArray(input.steps) ? input.steps.map(String) : [],
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients.map((line) => ({ name: String(line?.name ?? ""), amount: String(line?.amount ?? "") }))
      : [],
  });
  if (id === null) return { ok: false, error: "That recipe is gone." };

  if (typeof input.mealId === "number") {
    const meal = await getMeal(input.mealId);
    if (meal) {
      await linkMealRecipe(meal.id, `user:${id}`);
      mealRefresh(meal.date);
    }
  }
  mealRefresh();
  revalidatePath(`/fuel/recipes/${id}`);
  return { ok: true, id };
}

export async function removeRecipe(formData: FormData): Promise<void> {
  const id = num(formData.get("id"));
  if (id === null) return;
  await deleteUserRecipe(id);
  mealRefresh();
  redirect("/fuel/recipes");
}

export async function renameIngredientLabel(formData: FormData): Promise<void> {
  const key = str(formData.get("key"));
  const label = str(formData.get("label"));
  if (!key || !label) return;
  await renameIngredient(key, label);
  mealRefresh();
}

// ---------- profile ----------

const GOAL_TIME_SEC: Record<string, number | null> = {
  finish: null,
  sub2: 2 * 60 * 60,
  sub145: 105 * 60,
  sub130: 90 * 60,
};

/** First-run setup: race + experience, then generate the 28-week block. */
export async function finishOnboarding(formData: FormData): Promise<void> {
  const raceName = str(formData.get("raceName")) || "Half marathon";
  const raceDate = str(formData.get("raceDate"));
  if (!raceDate) return;

  const goal = str(formData.get("goal")) || "finish";
  const longRunDay = num(formData.get("longRunDay"));
  if (longRunDay !== 0 && longRunDay !== 6) return;

  await completeOnboarding({
    raceName,
    raceDate,
    experience: parseExperience(str(formData.get("experience"))),
    goal,
    longRunDay,
    timeGoalSec: GOAL_TIME_SEC[goal] ?? null,
  });

  refresh();
  revalidatePath("/onboard");
  redirect("/");
}

export async function saveProfile(formData: FormData): Promise<void> {
  const current = await getProfile();

  const heightIn = num(formData.get("heightIn"));
  const weightLb = num(formData.get("weightLb"));
  const goal = str(formData.get("goal")) || current.goal;

  await updateProfile({
    raceName: str(formData.get("raceName")) || current.raceName,
    raceDate: str(formData.get("raceDate")) || current.raceDate,
    startDate: str(formData.get("startDate")) || current.startDate,
    longRunDay: num(formData.get("longRunDay")) ?? current.longRunDay,
    experience: parseExperience(str(formData.get("experience")) || current.experience),
    goal,
    timeGoalSec:
      num(formData.get("timeGoalMin")) !== null
        ? Math.round((num(formData.get("timeGoalMin")) ?? 0) * 60)
        : (GOAL_TIME_SEC[goal] ?? current.timeGoalSec),
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
  refresh(date, exerciseId);
}

export async function saveExerciseLoad(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const exerciseId = str(formData.get("exerciseId"));
  const load = str(formData.get("load")).trim() || null;
  if (!date || !exerciseId) return;
  await setExerciseLoad(date, exerciseId, load);
  refresh(date, exerciseId);
}

export async function finishStrength(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;
  const intent = str(formData.get("intent")) || "done";
  const notes = str(formData.get("notes")) || null;

  if (intent === "skip") {
    await skipStrength(date, notes ?? "");
  } else {
    await completeStrength(date, {
      minutes: num(formData.get("minutes")),
      rpe: num(formData.get("rpe")),
      notes,
    });
  }
  refresh(date);
}

export async function skipStrengthSession(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  if (!date) return;
  await skipStrength(date, str(formData.get("reason")) || str(formData.get("notes")));
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

// ---------- habits ----------

export async function toggleHabitStar(formData: FormData): Promise<void> {
  const date = str(formData.get("date"));
  const habitId = str(formData.get("habitId"));
  if (!date || !isHabitId(habitId)) return;
  await toggleStar(date, habitId);
  revalidatePath("/habits");
  revalidatePath("/");
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

