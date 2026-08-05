import Link from "next/link";
import { notFound } from "next/navigation";
import { saveExerciseLoad, toggleStrengthExercise } from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { Check } from "@/components/Check";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatShort, todayISO } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { exerciseById } from "@/lib/strength/exercises";
import { checkFor, historyForExercise } from "@/lib/strength/log";
import { getWorkoutXExercise, resolveDemo, workoutxConfigured } from "@/lib/workoutx/client";

export const dynamic = "force-dynamic";

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: rawDate } = await searchParams;
  const exercise = exerciseById(id);
  if (!exercise) notFound();

  const today = todayISO();
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const back = date === today ? "/" : `/day/${date}`;

  const [pending, check, history, demo] = await Promise.all([
    pendingCount(),
    checkFor(date, id),
    historyForExercise(id),
    resolveDemo(id),
  ]);

  const detail = demo?.id ? await getWorkoutXExercise(demo.id) : null;
  const gifId = detail?.id || demo?.id;
  const steps = detail?.instructions?.filter(Boolean) ?? [];

  return (
    <>
      <Shell>
        <AppBar title={exercise.name} subtitle={exercise.prescription} back={back} pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card card--pad-lg">
              {gifId ? (
                <div className="exercise-demo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/workoutx/gif/${gifId}`} alt={`${exercise.name} demonstration`} />
                </div>
              ) : (
                <p className="card__sub">
                  {workoutxConfigured()
                    ? "No matching WorkoutX demo for this move yet. Cue below still stands."
                    : "Add WORKOUTX_API_KEY in .env.local to load the looping demo."}
                </p>
              )}
              <p className="card__sub" style={{ marginTop: gifId ? "0.85rem" : "0.35rem" }}>
                {exercise.cue}
              </p>
              {detail?.target || detail?.equipment ? (
                <div className="btnrow" style={{ marginTop: "0.75rem", gap: "0.35rem" }}>
                  {detail.target ? <span className="pill">{detail.target}</span> : null}
                  {detail.equipment ? <span className="pill">{detail.equipment}</span> : null}
                  {detail.bodyPart ? <span className="pill">{detail.bodyPart}</span> : null}
                </div>
              ) : null}
            </div>

            <div className="card card--pad-lg">
              <div className="card__head">
                <div>
                  <p className="label">This session</p>
                  <h2 className="card__title" style={{ marginTop: "0.2rem" }}>
                    {formatShort(date)}
                  </h2>
                </div>
                <Check
                  action={toggleStrengthExercise}
                  on={check?.done === 1}
                  flag="done"
                  label={exercise.name}
                  fields={{ date, exerciseId: id }}
                />
              </div>
              <p className="card__sub">Prescribed {exercise.prescription}</p>
              <form action={saveExerciseLoad} className="stack" style={{ marginTop: "0.85rem" }}>
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="exerciseId" value={id} />
                <label className="field">
                  <span className="field__label">Load / notes for this move</span>
                  <input
                    name="load"
                    defaultValue={check?.load ?? ""}
                    placeholder="e.g. 40 lb × 3 × 10, or 30 sec"
                  />
                </label>
                <button className="btn btn--primary btn--block" type="submit">
                  Save load
                </button>
              </form>
            </div>

            {steps.length > 0 ? (
              <div className="card">
                <p className="label" style={{ marginBottom: "0.15rem" }}>
                  How to
                </p>
                <div className="rows">
                  {steps.map((step, index) => (
                    <div className="row" key={`${index}-${step.slice(0, 24)}`}>
                      <span className="row__lead">
                        <span className="strong">{index + 1}</span>
                      </span>
                      <span className="row__body">
                        <span className="row__sub row__sub--wrap" style={{ color: "var(--ink)" }}>
                          {step}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="card">
              <p className="label" style={{ marginBottom: "0.15rem" }}>
                Your history
              </p>
              {history.length === 0 ? (
                <p className="small sub" style={{ padding: "0.75rem 0" }}>
                  Nothing logged yet. Tick the move or save a load to start the trail.
                </p>
              ) : (
                <div className="rows">
                  {history.map((row) => (
                    <Link className="row" href={`/exercise/${id}?date=${row.date}`} key={row.date}>
                      <span className="row__body">
                        <span className="row__title">{formatShort(row.date)}</span>
                        <span className="row__sub row__sub--wrap">
                          {[row.title, row.load, row.notes].filter(Boolean).join(" · ") || "Logged"}
                        </span>
                      </span>
                      <span className="row__meta">
                        {row.done ? "Done" : "Open"}
                        {row.rpe ? ` · ${row.rpe}` : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </Shell>
      <Nav />
    </>
  );
}
