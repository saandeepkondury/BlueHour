"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMealPhoto, removeMeal, starMeal } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { MARK_NAME, SLOT_NAME, SOURCE_NAME, type MealEntry } from "@/lib/meals/catalog";
import { shrinkPhoto } from "./shrinkPhoto";

/** How far a short swipe stays open, wide enough for the Remove label. */
const REVEAL = 112;

function useMealSwipe({
  shut,
  onOpen,
  onClose,
  onCommit,
  onRemoved,
}: {
  shut: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCommit: () => void;
  onRemoved: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const xRef = useRef(0);
  const leavingRef = useRef(false);
  const suppressClick = useRef(false);
  const blockDeleteUntil = useRef(0);
  const removedOnce = useRef(false);
  const cancelled = useRef(false);
  const onRemovedRef = useRef(onRemoved);
  onRemovedRef.current = onRemoved;
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: number;
    axis: "x" | "y" | null;
    lastX: number;
    lastT: number;
    vx: number;
  } | null>(null);

  function setOffset(next: number) {
    xRef.current = next;
    setX(next);
  }

  function notifyRemoved() {
    if (cancelled.current || removedOnce.current) return;
    removedOnce.current = true;
    onRemovedRef.current();
  }

  useEffect(() => {
    if (shut && !leavingRef.current && !drag.current) setOffset(0);
  }, [shut]);

  useEffect(() => {
    if (!leaving || !shellRef.current) return;
    const shell = shellRef.current;
    shell.style.height = `${shell.offsetHeight}px`;
    const frame = requestAnimationFrame(() => {
      shell.style.height = "0px";
    });
    const fallback = window.setTimeout(notifyRemoved, 320);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [leaving]);

  function commit() {
    if (leavingRef.current) return;
    cancelled.current = false;
    leavingRef.current = true;
    drag.current = null;
    setDragging(false);
    setLeaving(true);
    setOffset(-(shellRef.current?.offsetWidth ?? REVEAL));
    onCommit();
  }

  function reveal() {
    if (leavingRef.current) return;
    setOffset(-REVEAL);
    onOpen();
  }

  /** True when the row was already taken out of the list, so the caller should put it back. */
  function abort() {
    const alreadyGone = removedOnce.current;
    cancelled.current = true;
    leavingRef.current = false;
    removedOnce.current = false;
    setLeaving(false);
    setDragging(false);
    setOffset(0);
    if (shellRef.current) shellRef.current.style.height = "";
    return alreadyGone;
  }

  function onDeleteClick() {
    if (performance.now() < blockDeleteUntil.current) return;
    commit();
  }

  function finish(next: number) {
    setDragging(false);
    setOffset(next);
    if (next === 0) onClose();
    else onOpen();
  }

  const faceProps = {
    onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
      if (leavingRef.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: xRef.current,
        axis: null,
        lastX: event.clientX,
        lastT: event.timeStamp,
        vx: 0,
      };
    },
    onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId || leavingRef.current) return;
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (!current.axis) {
        if (Math.hypot(dx, dy) < 8) return;
        current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (current.axis === "y") {
          drag.current = null;
          return;
        }
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // The pointer can already be gone. The swipe still tracks the move.
        }
        setDragging(true);
        onOpen();
      }
      const dt = event.timeStamp - current.lastT;
      if (dt > 0) current.vx = (event.clientX - current.lastX) / dt;
      current.lastX = event.clientX;
      current.lastT = event.timeStamp;
      const width = shellRef.current?.offsetWidth ?? 0;
      setOffset(Math.min(0, Math.max(-width, current.origin + dx)));
    },
    onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
      const current = drag.current;
      drag.current = null;
      if (!current || current.pointerId !== event.pointerId || current.axis !== "x") {
        setDragging(false);
        return;
      }
      suppressClick.current = true;
      blockDeleteUntil.current = performance.now() + 400;
      const width = shellRef.current?.offsetWidth ?? 0;
      const offset = xRef.current;
      const flung = current.vx < -0.65;
      if (offset <= -width * 0.42 || (flung && offset <= -REVEAL)) commit();
      else if (offset <= -REVEAL * 0.4 || flung) finish(-REVEAL);
      else finish(0);
    },
    onPointerCancel() {
      drag.current = null;
      if (leavingRef.current) return;
      setDragging(false);
      finish(xRef.current <= -REVEAL * 0.4 ? -REVEAL : 0);
    },
    onClickCapture(event: React.MouseEvent) {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (xRef.current < 0) {
        event.preventDefault();
        event.stopPropagation();
        finish(0);
      }
    },
  };

  const shellProps = {
    onTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
      if (event.target !== event.currentTarget || event.propertyName !== "height") return;
      notifyRemoved();
    },
  };

  return { shellRef, x, dragging, leaving, faceProps, shellProps, reveal, abort, onDeleteClick };
}

export function StarGlyph({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.15l2.62 5.31 5.86.85-4.24 4.13 1 5.83L12 16.5l-5.24 2.77 1-5.83-4.24-4.13 5.86-.85z"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={on ? 0 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MealTags({ meal }: { meal: Pick<MealEntry, "source" | "mark"> }) {
  return (
    <span className="meal-tags">
      <span className={`pill meal-tag meal-tag--${meal.source}`}>{SOURCE_NAME[meal.source]}</span>
      {meal.mark ? (
        <span className={`pill ${meal.mark === "healthy" ? "pill--good" : "pill--warn"}`}>
          {MARK_NAME[meal.mark]}
        </span>
      ) : null}
    </span>
  );
}

export function MealCard({
  meal,
  variant = "full",
  shut = false,
  onEdit,
  onOpen,
  onClose,
  onRemoved,
  onRestored,
}: {
  meal: MealEntry;
  variant?: "full" | "compact";
  /** Another row is open, so this one should slide shut. */
  shut?: boolean;
  onEdit: (meal: MealEntry) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onRemoved?: () => void;
  onRestored?: () => void;
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [starred, setStarred] = useState(meal.starred);
  const [uploading, startUpload] = useTransition();
  const [, startStar] = useTransition();
  const [, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const removedRef = useRef(onRemoved);
  const restoredRef = useRef(onRestored);
  const abortRef = useRef<() => boolean>(() => false);
  removedRef.current = onRemoved;
  restoredRef.current = onRestored;

  const swipe = useMealSwipe({
    shut,
    onOpen: () => onOpen?.(),
    onClose: () => onClose?.(),
    onCommit: () => {
      const data = new FormData();
      data.set("id", String(meal.id));
      data.set("date", meal.date);
      startRemove(async () => {
        try {
          await removeMeal(data);
          router.refresh();
        } catch {
          if (abortRef.current()) restoredRef.current?.();
        }
      });
    },
    onRemoved: () => removedRef.current?.(),
  });
  abortRef.current = swipe.abort;

  useEffect(() => setStarred(meal.starred), [meal.starred]);

  function flipStar() {
    const next = !starred;
    setStarred(next);
    const data = new FormData();
    data.set("id", String(meal.id));
    data.set("date", meal.date);
    data.set("starred", next ? "1" : "0");
    startStar(async () => {
      await starMeal(data);
      router.refresh();
    });
  }

  function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    startUpload(async () => {
      const data = new FormData();
      data.set("id", String(meal.id));
      data.set("photo", await shrinkPhoto(file));
      const result = await addMealPhoto(data);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div
      ref={swipe.shellRef}
      className={`meal-swipe meal-swipe--${variant}${swipe.leaving ? " meal-swipe--leaving" : ""}`}
      {...swipe.shellProps}
    >
      <div
        className={`meal-swipe__face${swipe.dragging ? " is-dragging" : ""}`}
        style={{ transform: `translate3d(${swipe.x}px, 0, 0)` }}
        {...swipe.faceProps}
      >
        <article className={`meal-card meal-card--${variant}`}>
      <div className="meal-card__media">
        {meal.photoUrl ? (
          <img className="meal-card__img" src={meal.photoUrl} alt={meal.name} loading="lazy" draggable={false} />
        ) : (
          <button
            type="button"
            className="meal-card__nophoto"
            disabled={uploading}
            onClick={() => photoRef.current?.click()}
          >
            <Icon name="camera" size={variant === "full" ? 24 : 18} />
            {variant === "full" ? <span>{uploading ? "Uploading…" : "Add photo"}</span> : null}
          </button>
        )}
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <button
          type="button"
          className={`meal-star${starred ? " meal-star--on" : ""}`}
          aria-pressed={starred}
          aria-label={starred ? `Unstar ${meal.name}` : `Star ${meal.name}`}
          onClick={flipStar}
        >
          <StarGlyph on={starred} size={variant === "full" ? 20 : 16} />
        </button>
      </div>

      <div className="meal-card__body">
        <p className="label">{SLOT_NAME[meal.slot]}</p>
        <p className="meal-card__name">{meal.name}</p>
        <MealTags meal={meal} />
        {meal.recipeHref && meal.recipeName ? (
          <Link className="meal-card__recipe" href={meal.recipeHref} prefetch={false}>
            <Icon name="book" size={14} />
            {meal.recipeName.trim().toLowerCase() === meal.name.trim().toLowerCase() ? "Recipe" : meal.recipeName}
            {meal.calories > 0 ? <span className="muted"> · {meal.calories} kcal</span> : null}
          </Link>
        ) : null}
        {error ? <p className="small" style={{ color: "var(--bad)" }}>{error}</p> : null}
      </div>

      <button
        type="button"
        className="iconbtn meal-card__edit"
        aria-label={`Edit ${meal.name}`}
        onClick={() => onEdit(meal)}
      >
        <Icon name="edit" size={17} />
      </button>
        </article>
      </div>
      <button
        type="button"
        className="meal-swipe__delete"
        aria-label={`Remove ${meal.name}`}
        disabled={swipe.leaving}
        onFocus={swipe.reveal}
        onClick={swipe.onDeleteClick}
      >
        <Icon name="trash" size={18} />
        <span>Remove</span>
      </button>
    </div>
  );
}
