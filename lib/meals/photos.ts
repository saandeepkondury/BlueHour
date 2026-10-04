import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

/**
 * Meal photos live in Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, and in
 * `data/meal-photos` otherwise (local dev). Either way the stored URL is an app
 * path, `/api/meal-photos/<userId>/<file>`, so the route can check the owner
 * before serving a byte.
 */

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const PREFIX = "/api/meal-photos/";
const FILE_PATTERN = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
const LOCAL_ROOT = path.join(process.cwd(), "data", "meal-photos");

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function useBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobAccess(): "public" | "private" {
  return process.env.BLOB_ACCESS === "public" ? "public" : "private";
}

function blobPath(userId: string, file: string): string {
  return `meal-photos/${userId}/${file}`;
}

export class PhotoError extends Error {}

export async function saveMealPhoto(userId: string, photo: File): Promise<string> {
  const ext = EXT[photo.type];
  if (!ext) throw new PhotoError("Use a JPEG, PNG, or WebP photo.");
  if (photo.size === 0) throw new PhotoError("That photo is empty.");
  if (photo.size > MAX_PHOTO_BYTES) throw new PhotoError("That photo is over 8 MB.");

  const file = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await photo.arrayBuffer());

  if (useBlob()) {
    await put(blobPath(userId, file), bytes, {
      access: blobAccess(),
      contentType: photo.type,
      addRandomSuffix: false,
    });
  } else {
    if (process.env.VERCEL) {
      throw new PhotoError("Photo storage is not set up. Add BLOB_READ_WRITE_TOKEN.");
    }
    const dir = path.join(LOCAL_ROOT, userId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, file), bytes);
  }

  return `${PREFIX}${encodeURIComponent(userId)}/${file}`;
}

/** Splits a stored photo URL back into owner and file, or null if it is not ours. */
export function parsePhotoUrl(url: string): { userId: string; file: string } | null {
  if (!url.startsWith(PREFIX)) return null;
  const [owner, file, ...rest] = url.slice(PREFIX.length).split("/");
  if (!owner || !file || rest.length > 0) return null;
  return parsePhotoParts(decodeURIComponent(owner), file);
}

export function parsePhotoParts(
  userId: string,
  file: string,
): { userId: string; file: string } | null {
  if (!FILE_PATTERN.test(file)) return null;
  if (!userId || userId.includes("/") || userId.includes("..")) return null;
  return { userId, file };
}

export async function deleteMealPhoto(url: string | null): Promise<void> {
  if (!url) return;
  const parts = parsePhotoUrl(url);
  if (!parts) return;
  try {
    if (useBlob()) {
      await del(blobPath(parts.userId, parts.file));
    } else {
      await unlink(path.join(LOCAL_ROOT, parts.userId, parts.file));
    }
  } catch {
    // A photo that is already gone should not block deleting the meal.
  }
}

/** Raw bytes for the photo route. Null when the file does not exist. */
export async function readMealPhoto(
  userId: string,
  file: string,
): Promise<{ body: ReadableStream<Uint8Array> | Buffer; contentType: string } | null> {
  const ext = file.split(".").pop() ?? "jpg";
  const contentType = CONTENT_TYPE[ext] ?? "image/jpeg";

  if (useBlob()) {
    const result = await get(blobPath(userId, file), { access: blobAccess() });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType || contentType };
  }

  try {
    return { body: await readFile(path.join(LOCAL_ROOT, userId, file)), contentType };
  } catch {
    return null;
  }
}
