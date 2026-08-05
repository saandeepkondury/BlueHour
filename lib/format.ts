export function formatMiles(value: number): string {
  if (value === 0) return "0";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatPace(seconds: number | null | undefined, miles: number): string {
  if (!seconds || seconds <= 0 || miles <= 0) return "—";
  const perMile = Math.round(seconds / miles);
  const mins = Math.floor(perMile / 60);
  const secs = perMile % 60;
  return `${mins}:${String(secs).padStart(2, "0")} /mi`;
}

export function kgToLb(kg: number | null): number | null {
  return kg === null ? null : Math.round(kg * 2.20462);
}

export function cmToIn(cm: number | null): number | null {
  return cm === null ? null : Math.round(cm / 2.54);
}

export function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}
