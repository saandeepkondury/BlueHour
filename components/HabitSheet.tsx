"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logWater, toggleHabitStar } from "@/app/actions";
import { Icon, type IconName } from "@/components/Icon";
import { addDays, formatShort, startOfWeek, weekdayShort } from "@/lib/date";
import { HABITS, starKey, type HabitId } from "@/lib/habits/catalog";
import type { WidgetPlan, WidgetWater } from "@/lib/habits/widget";
import { CUP_OZ } from "@/lib/notify/water";
import { pingNative } from "@/lib/native";

const SHORT: Record<HabitId, string> = {
  sleep: "Sleep",
  meal_prep: "Meal prep",
  plan: "Plan",
};

function StarMark({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={on ? "star-mark star-mark--on" : "star-mark"}
    >
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

function StarSlot({
  date,
  habitId,
  label,
  icon,
  on,
  disabled,
  size = "hero",
  onFlip,
}: {
  date: string;
  habitId: HabitId;
  label: string;
  icon: IconName;
  on: boolean;
  disabled?: boolean;
  size?: "hero" | "cell";
  onFlip: (date: string, habitId: HabitId, next: boolean) => void;
}) {
  const [busy, start] = useTransition();

  function flip() {
    if (disabled) return;
    const next = !on;
    onFlip(date, habitId, next);
    const data = new FormData();
    data.set("date", date);
    data.set("habitId", habitId);
    start(() =>
      toggleHabitStar(data).then(() => pingNative("reloadWidgets")),
    );
  }

  return (
    <button
      type="button"
      className={`star-slot star-slot--${size}${on ? " star-slot--on" : ""}${busy ? " star-slot--busy" : ""}`}
      aria-pressed={on}
      aria-label={`${label}, ${weekdayShort(date)} ${formatShort(date)}`}
      disabled={disabled}
      onClick={flip}
    >
      <span className="star-slot__disc">
        {on ? <StarMark on size={size === "hero" ? 22 : 18} /> : <Icon name={icon} size={size === "hero" ? 18 : 16} />}
      </span>
      {size === "hero" ? <span className="star-slot__name">{SHORT[habitId]}</span> : null}
    </button>
  );
}

function WaterSlot({
  date,
  row,
  disabled,
  onAdd,
}: {
  date: string;
  row: WidgetWater;
  disabled?: boolean;
  onAdd: (date: string) => void;
}) {
  const [busy, start] = useTransition();
  const done = row.target !== null && row.oz >= row.target;
  const targetCups = row.cupsTarget ?? 0;

  function add() {
    if (disabled) return;
    onAdd(date);
    const data = new FormData();
    data.set("date", date);
    data.set("oz", String(CUP_OZ));
    start(() => logWater(data).then(() => pingNative("reloadWidgets")));
  }

  return (
    <button
      type="button"
      className={`star-slot star-slot--cell star-slot--water${done ? " star-slot--on" : ""}${busy ? " star-slot--busy" : ""}`}
      aria-label={`Water, ${weekdayShort(date)} ${formatShort(date)}`}
      aria-valuetext={
        targetCups > 0 ? `${row.cups} of ${targetCups} cups` : `${row.cups} cups`
      }
      disabled={disabled}
      onClick={add}
    >
      <span className="star-slot__disc">
        {row.cups > 0 ? (
          <span className="star-slot__cups">{row.cups}</span>
        ) : (
          <Icon name="water" size={16} />
        )}
      </span>
    </button>
  );
}

export function HabitSheet({
  today,
  weekStart,
  days,
  keys,
  streak,
  weekPossible,
  plan,
  water: waterIn,
  waterByDay,
  mealsLogged,
}: {
  today: string;
  weekStart: string;
  days: string[];
  keys: string[];
  streak: number;
  weekStars: number;
  weekPossible: number;
  plan: WidgetPlan;
  water: WidgetWater;
  waterByDay: Record<string, WidgetWater>;
  mealsLogged: number;
}) {
  const router = useRouter();
  const [starred, setStarred] = useState(() => new Set(keys));
  const [water, setWater] = useState(waterIn);
  const [cupsByDay, setCupsByDay] = useState(waterByDay);
  const [cupBusy, startCup] = useTransition();

  useEffect(() => {
    setStarred(new Set(keys));
  }, [keys]);

  useEffect(() => {
    setWater(waterIn);
  }, [waterIn]);

  useEffect(() => {
    setCupsByDay(waterByDay);
  }, [waterByDay]);

  function flip(date: string, habitId: HabitId, next: boolean) {
    const key = starKey(date, habitId);
    setStarred((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  }

  function addCup(date: string) {
    setCupsByDay((prev) => {
      const row = prev[date] ?? water;
      const oz = row.oz + CUP_OZ;
      return { ...prev, [date]: { ...row, oz, cups: Math.floor(oz / CUP_OZ) } };
    });
    if (date === today) {
      setWater((prev) => {
        const oz = prev.oz + CUP_OZ;
        return { ...prev, oz, cups: Math.floor(oz / CUP_OZ) };
      });
    }
  }

  function logCup(date: string) {
    addCup(date);
    const data = new FormData();
    data.set("date", date);
    data.set("oz", String(CUP_OZ));
    startCup(() => logWater(data).then(() => pingNative("reloadWidgets")));
  }

  const thisWeek = startOfWeek(today);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const canNext = nextWeek <= thisWeek;
  const todayCount = HABITS.filter((habit) => starred.has(starKey(today, habit.id))).length;
  const allIn = todayCount === HABITS.length;
  const liveWeekStars = days.reduce((total, date) => {
    return total + HABITS.filter((habit) => starred.has(starKey(date, habit.id))).length;
  }, 0);
  const pastDays = days.filter((date) => date <= today);
  const waterHits = pastDays.filter((date) => {
    const row = cupsByDay[date];
    return row && row.target !== null && row.oz >= row.target;
  }).length;
  const weekChecks = liveWeekStars + waterHits;
  const weekSlots = (weekPossible || HABITS.length * pastDays.length) + pastDays.length;
  const streakLine = allIn
    ? streak > 1
      ? `${streak} day streak`
      : "All in today"
    : `${HABITS.length - todayCount} left today`;
  const cupsTarget = water.cupsTarget ?? 0;

  function go(start: string) {
    const href = start === thisWeek ? "/habits" : `/habits?week=${start}`;
    router.push(href);
  }

  return (
    <>
      <section className="block block--tight">
        <div className="today-card">
          <div className="today-card__head">
            <span className="today-card__brand">Today</span>
          </div>

          <p className="today-card__count">
            {todayCount}
            <small> of {HABITS.length} habits</small>
          </p>
          <p className={`today-card__streak${allIn ? " today-card__streak--gold" : ""}`}>{streakLine}</p>

          <div className="today-card__stars">
            {HABITS.map((habit) => (
              <StarSlot
                key={habit.id}
                date={today}
                habitId={habit.id}
                label={habit.label}
                icon={habit.icon}
                on={starred.has(starKey(today, habit.id))}
                onFlip={flip}
              />
            ))}
          </div>

          <div className="water-panel">
            <Link className="water-panel__read" href="/water">
              <span className="water-panel__top">
                <span className="water-panel__label">
                  <Icon name="water" size={12} />
                  Water
                </span>
                <span className="water-panel__oz">
                  {water.target === null ? `${water.oz} oz` : `${water.oz} of ${water.target} oz`}
                </span>
              </span>
              {cupsTarget > 0 && cupsTarget <= 12 ? (
                <span className="water-panel__drops" aria-hidden="true">
                  {Array.from({ length: Math.max(cupsTarget, water.cups) }, (_, index) => (
                    <span
                      key={index}
                      className={index < water.cups ? "water-panel__drop water-panel__drop--on" : "water-panel__drop"}
                    />
                  ))}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              className={`water-panel__cup${cupBusy ? " water-panel__cup--busy" : ""}`}
              onClick={() => logCup(today)}
              aria-label="Log a cup of water"
            >
              + Cup
            </button>
          </div>

          <div className="today-card__foot">
            <Link className="plan-chip" href="/plan">
              <span className="plan-chip__kicker">
                <Icon name={plan.done ? "check" : "calendar"} size={12} />
                Plan
              </span>
              <span className="plan-chip__title">{plan.title}</span>
              <span className="plan-chip__detail">{plan.detail}</span>
            </Link>
            <Link className="log-meal-btn" href="/fuel?compose=1">
              <Icon name="camera" size={18} />
              Log meal
              {mealsLogged > 0 ? <span className="log-meal-btn__count">{mealsLogged}</span> : null}
            </Link>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="block__head">
          <h2 className="block__title">This week</h2>
          <span className="label">
            {liveWeekStars + waterHits}/{weekSlots}
          </span>
        </div>

        <div className="sticker">
          <div className="sticker__nav">
            <button
              type="button"
              className="iconbtn iconbtn--solid"
              aria-label="Previous week"
              onClick={() => go(prevWeek)}
            >
              <Icon name="back" size={18} />
            </button>
            <p className="sticker__range">
              {formatShort(days[0])} to {formatShort(days[6])}
            </p>
            <button
              type="button"
              className="iconbtn iconbtn--solid"
              aria-label="Next week"
              disabled={!canNext}
              onClick={() => canNext && go(nextWeek)}
            >
              <Icon name="chevron" size={18} />
            </button>
          </div>

          <div className="sticker__legend" aria-hidden="true">
            <span />
            {HABITS.map((habit) => (
              <span key={habit.id} className="sticker__col">
                <Icon name={habit.icon} size={14} />
                {SHORT[habit.id]}
              </span>
            ))}
            <span className="sticker__col">
              <Icon name="water" size={14} />
              Water
            </span>
          </div>

          <div className="sticker__days">
            {days.map((date) => {
              const future = date > today;
              const isToday = date === today;
              return (
                <div
                  key={date}
                  className={`sticker__day${isToday ? " sticker__day--today" : ""}${future ? " sticker__day--future" : ""}`}
                >
                  <div className="sticker__when">
                    <span className="sticker__dow">{weekdayShort(date)}</span>
                    <span className="sticker__num">{date.slice(8)}</span>
                  </div>
                  {HABITS.map((habit) => (
                    <StarSlot
                      key={habit.id}
                      date={date}
                      habitId={habit.id}
                      label={habit.label}
                      icon={habit.icon}
                      on={starred.has(starKey(date, habit.id))}
                      disabled={future}
                      size="cell"
                      onFlip={flip}
                    />
                  ))}
                  <WaterSlot
                    date={date}
                    row={cupsByDay[date] ?? { oz: 0, target: 80, cups: 0, cupsTarget: 5 }}
                    disabled={future}
                    onAdd={addCup}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
