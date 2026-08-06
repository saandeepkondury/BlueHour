import { exerciseById } from "@/lib/strength/exercises";
import { KEYS, getSetting, setSetting } from "@/lib/settings";
import { wxIdFor } from "./queries";

const BASE = "https://api.workoutxapp.com/v1";

/**
 * WorkoutX lists these ids but their watermarked GIF endpoint returns 503.
 * Fall back to a close cousin that still demos the same position.
 */
const GIF_FALLBACKS: Record<string, string> = {
  // Front Plank → Weighted Front Plank (same hold; plate is visible but the shape is right)
  "5202": "2135",
};

export type WorkoutXExercise = {
  id: string;
  name: string;
  gifUrl?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  instructions?: string[];
  description?: string;
  recommendedSets?: string;
  recommendedReps?: string;
};

type CacheMap = Record<string, { id: string; name: string; gifUrl?: string }>;

function apiKey(): string | undefined {
  return process.env.WORKOUTX_API_KEY?.trim() || undefined;
}

export function workoutxConfigured(): boolean {
  return Boolean(apiKey());
}

async function wxFetch(path: string): Promise<Response> {
  const key = apiKey();
  if (!key) throw new Error("WORKOUTX_API_KEY is not set");
  return fetch(`${BASE}${path}`, {
    headers: { "X-WorkoutX-Key": key },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
}

async function readCache(): Promise<CacheMap> {
  const raw = await getSetting(KEYS.workoutxCache);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CacheMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCache(cache: CacheMap): Promise<void> {
  await setSetting(KEYS.workoutxCache, JSON.stringify(cache));
}

export async function resolveDemo(exerciseId: string): Promise<WorkoutXExercise | null> {
  const wxId = wxIdFor(exerciseId);
  if (!wxId || !apiKey()) return null;

  const local = exerciseById(exerciseId);
  const cache = await readCache();
  const hit = cache[exerciseId];
  if (hit?.id === wxId) {
    return { id: hit.id, name: hit.name || local?.name || wxId, gifUrl: hit.gifUrl };
  }

  try {
    const detail = await getWorkoutXExercise(wxId);
    cache[exerciseId] = {
      id: wxId,
      name: detail?.name || local?.name || wxId,
      gifUrl: detail?.gifUrl,
    };
    await writeCache(cache);
    return detail ?? { id: wxId, name: local?.name || wxId };
  } catch {
    return { id: wxId, name: local?.name || wxId };
  }
}

export async function getWorkoutXExercise(wxId: string): Promise<WorkoutXExercise | null> {
  if (!apiKey() || !wxId) return null;
  try {
    const res = await wxFetch(`/exercises/exercise/${encodeURIComponent(wxId)}`);
    if (!res.ok) return null;
    return (await res.json()) as WorkoutXExercise;
  } catch {
    return null;
  }
}

function gifCandidates(wxId: string): string[] {
  const fallback = GIF_FALLBACKS[wxId];
  return fallback && fallback !== wxId ? [wxId, fallback] : [wxId];
}

async function pullGif(
  url: string,
  key: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  // Do not cache upstream failures — WorkoutX has returned multi-day 503s for
  // specific catalog ids (e.g. Front Plank 5202), and a long revalidate would
  // keep demos blank after a temporary outage.
  const res = await fetch(url, {
    headers: url.includes("api.workoutxapp.com") ? { "X-WorkoutX-Key": key } : undefined,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("image") && !contentType.includes("gif")) return null;
  return {
    body: await res.arrayBuffer(),
    contentType: contentType.includes("image") ? contentType : "image/gif",
  };
}

export async function fetchWorkoutXGif(
  wxId: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const key = apiKey();
  if (!key || !wxId) return null;

  const cached = await readCache();

  for (const id of gifCandidates(wxId)) {
    const gifUrl = Object.values(cached).find((row) => row.id === id)?.gifUrl;
    const urls = [
      gifUrl,
      `${BASE}/gifs/${encodeURIComponent(id)}.gif`,
    ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

    for (const url of urls) {
      try {
        const gif = await pullGif(url, key);
        if (gif) return gif;
      } catch {
        // try next candidate
      }
    }
  }

  return null;
}
