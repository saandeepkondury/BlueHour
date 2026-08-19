/**
 * Copy for HealthKit empty / missing-metric states.
 *
 * iOS never reports which read permissions were refused, so a missing vital
 * shows as "—" — pilots need an actionable path, not a false "no data yet."
 */

export type HealthShareFocus = "sleep" | "heart" | "hrv" | "workouts" | "vitals";

export const HEALTH_SHARE_PATH = "Health → Sharing → Apps → Blue Hour";

const FOCUS_LABEL: Record<HealthShareFocus, string> = {
  sleep: "Sleep",
  heart: "Heart Rate and Resting Heart Rate",
  hrv: "Heart Rate Variability",
  workouts: "Workouts",
  vitals: "Sleep, Heart Rate, Heart Rate Variability, and Workouts",
};

export function healthShareEmpty(focus: HealthShareFocus, synced: boolean): {
  title: string;
  body: string;
} {
  if (!synced) {
    return {
      title: "Connect Apple Health",
      body: `Open Blue Hour on iPhone and Allow Health. You can change what it can see later in ${HEALTH_SHARE_PATH} — turn on ${FOCUS_LABEL[focus]}.`,
    };
  }

  switch (focus) {
    case "sleep":
      return {
        title: "Waiting on Sleep",
        body: `Blue Hour can only read what Health sharing allows. Turn on Sleep in ${HEALTH_SHARE_PATH} — without it, Today stays empty overnight. If Sleep is already on, the Watch may not have written last night yet.`,
      };
    case "heart":
      return {
        title: "Waiting on resting HR",
        body: `Blue Hour can only read what Health sharing allows. Turn on Heart Rate and Resting Heart Rate in ${HEALTH_SHARE_PATH}. If those are already on, the Watch may not have written this morning yet.`,
      };
    case "hrv":
      return {
        title: "Waiting on HRV",
        body: `Blue Hour can only read what Health sharing allows. Turn on Heart Rate Variability in ${HEALTH_SHARE_PATH}. If it is already on, the Watch may not have written this morning yet.`,
      };
    case "workouts":
      return {
        title: "Waiting on Watch runs",
        body: `Blue Hour can only read what Health sharing allows. Turn on Workouts in ${HEALTH_SHARE_PATH}. If Workouts is already on, finish a walk or run on the Watch, then sync.`,
      };
    case "vitals":
      return {
        title: "Waiting on Watch data",
        body: `Blue Hour can only read what Health sharing allows. Turn on Sleep, Heart Rate, Heart Rate Variability, and Workouts in ${HEALTH_SHARE_PATH}. Missing nights or runs often mean Sleep or Workouts is off.`,
      };
  }
}

/** Soft line when a hero metric is "—" after a successful sync. */
export function healthShareMissingTip(focus: HealthShareFocus): string {
  switch (focus) {
    case "sleep":
      return `If this stays empty overnight, turn on Sleep in ${HEALTH_SHARE_PATH} — or the Watch has not written yet.`;
    case "heart":
      return `If this stays empty, turn on Heart Rate / Resting Heart Rate in ${HEALTH_SHARE_PATH} — or the Watch has not written yet.`;
    case "hrv":
      return `If this stays empty, turn on Heart Rate Variability in ${HEALTH_SHARE_PATH} — or the Watch has not written yet.`;
    case "workouts":
      return `If runs stay missing, turn on Workouts in ${HEALTH_SHARE_PATH} — or the Watch has not written yet.`;
    case "vitals":
      return `If scores stay empty, check Sleep and Workouts in ${HEALTH_SHARE_PATH} — or the Watch has not written yet.`;
  }
}
