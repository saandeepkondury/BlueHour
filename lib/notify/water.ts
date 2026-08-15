/** One drinking cup ≈ 540 ml. Matches the Today stepper and the hydration push copy. */
export const CUP_OZ = 18;
/** Milliliters in one cup — keeps oz ↔ ml aligned with the measured bottle. */
export const CUP_ML = 540;

export function ozToMl(oz: number): number {
  return Math.round((oz * CUP_ML) / CUP_OZ);
}

export function formatCups(oz: number): string {
  const cups = oz / CUP_OZ;
  return Number.isInteger(cups) ? String(cups) : cups.toFixed(1);
}

/** First reminder hour (Austin). Inclusive. */
export const WATER_QUIET_START = 9;
/** Last reminder hour (Austin). Inclusive — 8pm, before evening run / bedtime. */
export const WATER_QUIET_END = 20;

/** Notification action id — keep in sync with public/sw.js and iOS. */
export const WATER_LOG_ACTION = "log-cup";

export interface WaterSlot {
  hour: number;
  minute: number;
  /** 0-based; expected cups by this ping = index + 1. */
  index: number;
}

export function cupsForTarget(targetOz: number): number {
  return Math.max(1, Math.ceil(Math.max(0, targetOz) / CUP_OZ));
}

export function loggedCups(ounces: number): number {
  return Math.floor(Math.max(0, ounces) / CUP_OZ);
}

/** Cups you should have by this slot; skip the ping when logged ≥ this. */
export function expectedCupsForSlot(slot: WaterSlot): number {
  return slot.index + 1;
}

export function behindPace(loggedOz: number, slot: WaterSlot): boolean {
  return loggedCups(loggedOz) < expectedCupsForSlot(slot);
}

/**
 * Evenly space one reminder per target cup from 9:00 through 20:00 Austin.
 * First slot is always 9:00; last is 20:00 when there are two or more cups.
 */
export function waterReminderSlots(targetOz: number): WaterSlot[] {
  const cups = cupsForTarget(targetOz);
  const startMin = WATER_QUIET_START * 60;
  const endMin = WATER_QUIET_END * 60;
  const span = endMin - startMin;
  const slots: WaterSlot[] = [];

  for (let i = 0; i < cups; i += 1) {
    const minuteOfDay =
      cups === 1 ? startMin : startMin + Math.round((i * span) / (cups - 1));
    slots.push({
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
      index: i,
    });
  }

  return slots;
}

/** Slot due in this Austin clock hour that we are still behind on, if any. */
export function dueWaterSlot(
  hour: number,
  targetOz: number,
  loggedOz: number,
): WaterSlot | null {
  for (const slot of waterReminderSlots(targetOz)) {
    if (slot.hour !== hour) continue;
    if (behindPace(loggedOz, slot)) return slot;
  }
  return null;
}

export function waterSlotKey(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function waterPush(appUrl: string, ounces: number, target: number, date?: string) {
  const left = Math.max(0, target - ounces);
  const cupsLeft = Math.max(1, Math.ceil(left / CUP_OZ));

  return {
    title: "Drink a glass of water",
    body:
      ounces > 0
        ? `${ounces} of ${target} oz (${ozToMl(ounces)} of ${ozToMl(target)} ml). ${cupsLeft === 1 ? "One more cup." : `${cupsLeft} cups left.`}`
        : "One cup now — tap + Cup to log it.",
    url: appUrl,
    tag: "water",
    date,
    actions: [{ action: WATER_LOG_ACTION, title: "+ Cup" }],
  };
}
