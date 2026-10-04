import { redirect } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { HabitSheet } from "@/components/HabitSheet";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { startOfWeek, todayISO } from "@/lib/date";
import { pendingCount, weekDays, weekSheet } from "@/lib/habits/store";
import { weekWaterMap, widgetToday } from "@/lib/habits/widget";

export const dynamic = "force-dynamic";

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const today = todayISO();
  const requested = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  const weekStart = startOfWeek(requested);
  if (weekStart > startOfWeek(today)) redirect("/habits");

  const [sheet, pending, todayCard, waterByDay] = await Promise.all([
    weekSheet(weekStart),
    pendingCount(),
    widgetToday(),
    weekWaterMap(weekDays(weekStart)),
  ]);

  return (
    <>
      <Shell>
        <AppBar title="Habits" subtitle="Tap a star. Log a cup. Open the plan." pending={pending} />
        <HabitSheet
          {...sheet}
          plan={todayCard.plan}
          water={todayCard.water}
          waterByDay={waterByDay}
          mealsLogged={todayCard.mealsLogged}
        />
        <p className="fineprint">
          Sleep, the food you packed, the plan, and the cups. The home screen widget is this card.
        </p>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
