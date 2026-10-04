"use client";

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Downscales a camera photo to a JPEG under ~1600px on the long edge before it
 * leaves the phone. Falls back to the original file if the browser cannot
 * decode it (some desktop browsers and HEIC).
 */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("decode"));
        img.src = url;
      });

      const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", QUALITY),
      );
      if (!blob) return file;
      return new File([blob], "meal.jpg", { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return file;
  }
}
