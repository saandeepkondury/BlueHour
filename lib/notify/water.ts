/** One US cup. Matches the Today stepper and the hydration push copy. */
export const CUP_OZ = 8;

export const WATER_QUIET_START = 8;
export const WATER_QUIET_END = 22;

/** Notification action id — keep in sync with public/sw.js and iOS. */
export const WATER_LOG_ACTION = "log-cup";

/** Even Austin hours from 8am through 10pm. */
export function waterSlotDue(hour: number): boolean {
  return hour >= WATER_QUIET_START && hour <= WATER_QUIET_END && hour % 2 === 0;
}

export function waterSlotKey(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, "0")}`;
}

export function waterPush(appUrl: string, ounces: number, target: number, date?: string) {
  const left = Math.max(0, target - ounces);
  const cupsLeft = Math.max(1, Math.ceil(left / CUP_OZ));

  return {
    title: "Drink a glass of water",
    body:
      ounces > 0
        ? `${ounces} of ${target} oz so far. ${cupsLeft === 1 ? "One more cup." : `${cupsLeft} cups left.`}`
        : "One cup now — tap + Cup to log it.",
    url: appUrl,
    tag: "water",
    date,
    actions: [{ action: WATER_LOG_ACTION, title: "+ Cup" }],
  };
}
