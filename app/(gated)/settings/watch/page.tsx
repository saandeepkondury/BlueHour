import Link from "next/link";
import { saveHealthEntry } from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { HealthSharingGuide } from "@/components/HealthSharingEmpty";
import { HealthSyncButton } from "@/components/HealthSyncButton";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { todayISO } from "@/lib/date";
import { lastSync } from "@/lib/health/read";
import { pendingCount } from "@/lib/coach/store";

export const dynamic = "force-dynamic";

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export default async function WatchPage() {
  const [sync, pending] = await Promise.all([lastSync(), pendingCount()]);

  return (
    <>
      <Shell>
        <AppBar title="Apple Health" subtitle="Watch sync" back="/settings" pending={pending} />

        <section className="block block--tight">
          <div className={sync ? "card card--good" : "card"}>
            <div className="row">
              <span className={`row__lead${sync ? " row__lead--good" : " row__lead--accent"}`}>
                <Icon name="watch" size={18} />
              </span>
              <div className="row__body">
                <span className="row__title">{sync ? "Syncing" : "Waiting for Health"}</span>
                <span className="row__sub">
                  {sync
                    ? `Last ${relativeTime(sync.at)}${sync.device ? ` from ${sync.device}` : ""}`
                    : "Opens Blue Hour on iPhone, then Allow every Health category"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="block">
          <HealthSyncButton />
        </section>

        <section className="block block--tight">
          <HealthSharingGuide synced={Boolean(sync)} />
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Log this morning</h2>
            <span className="label">By hand</span>
          </div>
          <div className="card">
            <form action={saveHealthEntry} className="stack">
              <input type="hidden" name="date" value={todayISO()} />
              <div className="grid3">
                <label className="field">
                  <span className="field__label">Slept hr</span>
                  <input
                    name="sleepHours"
                    type="number"
                    step="any"
                    min="0"
                    max="16"
                    inputMode="decimal"
                  />
                </label>
                <label className="field">
                  <span className="field__label">Rest HR</span>
                  <input name="restingHr" type="number" min="30" max="120" inputMode="numeric" />
                </label>
                <label className="field">
                  <span className="field__label">HRV ms</span>
                  <input name="hrvMs" type="number" min="5" max="250" inputMode="numeric" />
                </label>
              </div>
              <button className="btn btn--ghost btn--block" type="submit">
                Save
              </button>
            </form>
          </div>
        </section>

        <p className="fineprint">
          Health data stays in your own database. It is sent nowhere except, if you enable the coach,
          to OpenAI as a fourteen-day summary — <Link href="/settings">switch that off</Link> and the
          guardrails keep working.
        </p>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}
