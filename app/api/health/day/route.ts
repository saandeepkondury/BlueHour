import { NextResponse } from "next/server";
import { addDays, todayISO } from "@/lib/date";
import { guardIngest } from "@/lib/health/guard";
import {
  formatSleep,
  hasVitals,
  lastSync,
  logFor,
  recoveryFor,
} from "@/lib/health/read";
import { getDayLog, getWorkout } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read-only day snapshot for agents / nightly brain sync.
 * Auth: same Bearer sync key as Health ingest (`HEALTH_INGEST_SECRET`).
 *
 * GET /api/health/day?date=YYYY-MM-DD
 * Omit `date` for today (America/Chicago).
 */
export async function GET(request: Request) {
  const denied = await guardIngest(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const rawDate = url.searchParams.get("date")?.trim();
  const date = rawDate && rawDate.length > 0 ? rawDate : todayISO();

  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    const [recovery, workoutLog, dayLog, planned, sync] = await Promise.all([
      recoveryFor(date),
      logFor(date),
      getDayLog(date),
      getWorkout(date),
      lastSync(),
    ]);

    const day = recovery.day;
    const vitalsPresent = hasVitals(day);
    const asleepMin = day?.asleepMin ?? null;
    const hrvMs =
      day?.hrvMs === null || day?.hrvMs === undefined
        ? null
        : Math.round(day.hrvMs);

    return NextResponse.json({
      ok: true,
      date,
      timezone: "America/Chicago",
      hasData: Boolean(
        vitalsPresent ||
          workoutLog ||
          (dayLog.waterOz ?? 0) > 0 ||
          (day?.steps ?? 0) > 0,
      ),
      vitalsDate: recovery.vitalsDate,
      sleep: {
        asleepMin,
        asleepLabel: asleepMin === null ? null : formatSleep(asleepMin),
        inBedMin: day?.inBedMin ?? null,
        remMin: day?.remMin ?? null,
        coreMin: day?.coreMin ?? null,
        deepMin: day?.deepMin ?? null,
        sleepHr: day?.sleepHr ?? null,
        sleepStart: day?.sleepStart ?? null,
        sleepEnd: day?.sleepEnd ?? null,
      },
      heart: {
        restingHr: day?.restingHr ?? null,
        walkingHr: day?.walkingHr ?? null,
        hrMin: day?.hrMin ?? null,
        hrAvg: day?.hrAvg ?? null,
        hrMax: day?.hrMax ?? null,
        hrvMs,
        hrvMin:
          day?.hrvMin === null || day?.hrvMin === undefined
            ? null
            : Math.round(day.hrvMin),
        hrvMax:
          day?.hrvMax === null || day?.hrvMax === undefined
            ? null
            : Math.round(day.hrvMax),
        baselineRestingHr: recovery.baselineRestingHr,
        baselineHrvMs: recovery.baselineHrvMs,
      },
      activity: {
        steps: day?.steps ?? null,
        activeKcal: day?.activeKcal ?? null,
        workout: workoutLog
          ? {
              distanceMi: workoutLog.distanceMi,
              durationSec: workoutLog.durationSec,
              avgHr: workoutLog.avgHr,
              maxHr: workoutLog.maxHr,
              activeKcal: workoutLog.activeKcal,
              source: workoutLog.source,
              startAt: workoutLog.startAt,
              endAt: workoutLog.endAt,
              notes: workoutLog.notes,
            }
          : null,
        planned: planned
          ? {
              type: planned.type,
              title: planned.title,
              distanceMi: planned.distanceMi,
              status: planned.status,
            }
          : null,
      },
      water: {
        oz: dayLog.waterOz ?? 0,
      },
      readiness: {
        score: recovery.score,
        label: recovery.label,
        advisory: recovery.advisory,
        weekMi: recovery.racePrep?.weekMi ?? null,
        priorWeekMi: recovery.racePrep?.priorWeekMi ?? null,
        longestMi: recovery.racePrep?.longestMi ?? null,
        daysToRace: recovery.racePrep?.daysToRace ?? null,
      },
      lastSyncAt: sync?.at ?? recovery.lastSyncAt,
      lastSyncDevice: sync?.device ?? null,
      // Hint for nightly digests: if vitals lag, yesterday often still has sleep.
      previousDate: addDays(date, -1),
    });
  } catch (error) {
    console.error("health day read failed", error);
    return NextResponse.json({ error: "health day read failed" }, { status: 500 });
  }
}
