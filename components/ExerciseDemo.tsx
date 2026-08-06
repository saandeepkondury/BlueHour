"use client";

import { useState } from "react";

/**
 * WorkoutX occasionally returns 503 for a catalog id even when the exercise
 * metadata is fine. Hide the broken frame instead of leaving a blank square.
 */
export function ExerciseDemo({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <p className="card__sub">{fallback}</p>;
  }

  return (
    <div className="exercise-demo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onError={() => setFailed(true)} />
    </div>
  );
}
