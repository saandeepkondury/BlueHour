import { addDays, todayISO, wallTimeInZone } from "@/lib/date";
import { buildBrief } from "@/lib/notify/brief";
import { WATER_QUIET_END, WATER_QUIET_START, waterPush, waterSlotDue } from "@/lib/notify/water";
import { getDayBundle, getDayLog, getProfile } from "@/lib/store";

export type LocalPingKind = "morning" | "water";

export interface LocalPing {
  id: string;
  kind: LocalPingKind;
  title: string;
  body: string;
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface LocalSchedule {
  enabled: boolean;
  timezone: string;
  reminderHour: number;
  items: LocalPing[];
}

const HORIZON_DAYS = 3;
const LEAD_MS = 20_000;

function splitISO(dateISO: string) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return { year, month, day };
}

function ping(
  id: string,
  kind: LocalPingKind,
  title: string,
  body: string,
  dateISO: string,
  hour: number,
  minute = 0,
): LocalPing | null {
  if (wallTimeInZone(dateISO, hour, minute).getTime() <= Date.now() + LEAD_MS) {
    return null;
  }
  return { id, kind, title, body, date: dateISO, ...splitISO(dateISO), hour, minute };
}

export async function buildLocalSchedule(appUrl: string): Promise<LocalSchedule> {
  const profile = await getProfile();
  const timezone = "America/Chicago";
  const start = todayISO();

  if (profile.remindersEnabled !== 1) {
    return { enabled: false, timezone, reminderHour: profile.reminderHour, items: [] };
  }

  const items: LocalPing[] = [];

  for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
    const date = addDays(start, offset);

    const brief = await buildBrief(date, appUrl);
    if (brief) {
      const morning = ping(
        `morning-${date}`,
        "morning",
        brief.push.title,
        brief.push.body,
        date,
        profile.reminderHour,
      );
      if (morning) items.push(morning);
    }

    const [log, bundle] = await Promise.all([getDayLog(date), getDayBundle(date)]);
    const target = bundle?.targets.waterOz ?? 80;
    if (log.waterOz >= target) continue;

    const copy = waterPush(appUrl, log.waterOz, target, date);
    for (let hour = WATER_QUIET_START; hour <= WATER_QUIET_END; hour += 1) {
      if (!waterSlotDue(hour)) continue;
      const water = ping(
        `water-${date}-${String(hour).padStart(2, "0")}`,
        "water",
        copy.title,
        copy.body,
        date,
        hour,
      );
      if (water) items.push(water);
    }
  }

  return {
    enabled: true,
    timezone,
    reminderHour: profile.reminderHour,
    items,
  };
}
