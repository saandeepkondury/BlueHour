import Link from "next/link";
import { Icon } from "@/components/Icon";
import { MealDay } from "@/components/meals/MealDay";
import { MealTags } from "@/components/meals/MealCard";
import { addDays, formatLong, formatShort, todayISO, weekdayShort } from "@/lib/date";
import { MARK_NAME, MEAL_MARKS, MEAL_SOURCES, SOURCE_NAME, type MealEntry } from "@/lib/meals/catalog";
import { getMealsForDate, getStarredMeals, recipeOptions } from "@/lib/meals/store";

export const dynamic = "force-dynamic";

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return `${weekdayShort(date)} ${formatShort(date)}`;
}

function Tally({ meals }: { meals: MealEntry[] }) {
  const sources = MEAL_SOURCES.map((source) => ({
    ...source,
    count: meals.filter((meal) => meal.source === source.id).length,
  })).filter((source) => source.count > 0);
  const marks = MEAL_MARKS.map((mark) => ({
    ...mark,
    count: meals.filter((meal) => meal.mark === mark.id).length,
  })).filter((mark) => mark.count > 0);

  if (meals.length === 0) return null;
  return (
    <div className="meal-tally">
      {sources.map((source) => (
        <span className={`pill meal-tag meal-tag--${source.id}`} key={source.id}>
          {source.count} {SOURCE_NAME[source.id].toLowerCase()}
        </span>
      ))}
      {marks.map((mark) => (
        <span className={`pill ${mark.id === "healthy" ? "pill--good" : "pill--warn"}`} key={mark.id}>
          {mark.count} {MARK_NAME[mark.id].toLowerCase()}
        </span>
      ))}
    </div>
  );
}

function ViewSwitch({ view, date, today }: { view: "day" | "starred"; date: string; today: string }) {
  const dayHref = date === today ? "/fuel" : `/fuel?d=${date}`;
  return (
    <div className="seg" role="tablist" aria-label="Meal log view">
      <Link href={dayHref} role="tab" aria-selected={view === "day"} prefetch>
        Day
      </Link>
      <Link href="/fuel?view=starred" role="tab" aria-selected={view === "starred"} prefetch>
        Starred
      </Link>
    </div>
  );
}

async function StarredView({ today }: { today: string }) {
  const meals = await getStarredMeals();
  return (
    <>
      <section className="block block--tight">
        <ViewSwitch view="starred" date={today} today={today} />
      </section>
      <section className="block block--tight">
        {meals.length === 0 ? (
          <div className="card">
            <div className="empty">
              <span className="empty__icon">
                <Icon name="star" size={20} />
              </span>
              <p className="small sub">Star a meal you liked and it shows up here with its photo.</p>
            </div>
          </div>
        ) : (
          <div className="meal-grid">
            {meals.map((meal) => (
              <Link
                className="meal-tile"
                key={meal.id}
                href={meal.date === today ? "/fuel" : `/fuel?d=${meal.date}`}
                prefetch={false}
              >
                <span className="meal-tile__media">
                  {meal.photoUrl ? (
                    <img src={meal.photoUrl} alt={meal.name} loading="lazy" />
                  ) : (
                    <Icon name="fuel" size={22} />
                  )}
                </span>
                <span className="meal-tile__name">{meal.name}</span>
                <span className="meal-tile__when">{formatShort(meal.date)}</span>
                <MealTags meal={meal} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default async function FuelLogPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; view?: string; log?: string; compose?: string }>;
}) {
  const { d, view, log, compose } = await searchParams;
  const today = todayISO();
  if (view === "starred") return <StarredView today={today} />;

  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today ? d : today;
  const [meals, recipes] = await Promise.all([getMealsForDate(date), recipeOptions()]);
  const previous = addDays(date, -1);
  const next = addDays(date, 1);
  const preset = log && recipes.some((recipe) => recipe.ref === log) ? log : undefined;

  return (
    <>
      <section className="block block--tight">
        <ViewSwitch view="day" date={date} today={today} />
      </section>

      <section className="block block--tight">
        <div className="card">
          <div className="day-nav">
            <Link className="iconbtn" href={`/fuel?d=${previous}`} aria-label="Previous day" prefetch>
              <Icon name="back" size={18} />
            </Link>
            <div className="day-nav__title">
              <p className="day-nav__day">{dayLabel(date, today)}</p>
              <p className="day-nav__date">{formatLong(date)}</p>
            </div>
            {date < today ? (
              <Link
                className="iconbtn"
                href={next === today ? "/fuel" : `/fuel?d=${next}`}
                aria-label="Next day"
                prefetch
              >
                <Icon name="chevron" size={18} />
              </Link>
            ) : (
              <span className="iconbtn" aria-hidden="true" />
            )}
          </div>
          <p className="day-nav__count">
            {meals.length === 0
              ? "No meals yet"
              : `${meals.length} meal${meals.length === 1 ? "" : "s"}`}
          </p>
          <Tally meals={meals} />
        </div>
      </section>

      <section className="block block--tight">
        <MealDay
          key={date}
          date={date}
          meals={meals}
          recipes={recipes}
          presetRecipe={preset}
          composeOnLoad={compose === "1"}
        />
      </section>
    </>
  );
}
