import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import {
  HEALTH_SHARE_PATH,
  healthShareEmpty,
  healthShareMissingTip,
  type HealthShareFocus,
} from "@/lib/health/sharing";

/** History / list empty state when HealthKit has nothing for this metric. */
export function HealthSharingEmpty({
  icon,
  focus,
  synced,
}: {
  icon: IconName;
  focus: HealthShareFocus;
  synced: boolean;
}) {
  const copy = healthShareEmpty(focus, synced);

  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={20} />
      </span>
      <p className="card__title">{copy.title}</p>
      <p className="small sub">{copy.body}</p>
      <Link className="btn btn--ghost btn--sm" href="/settings/watch">
        Apple Health sync
      </Link>
    </div>
  );
}

/**
 * Quiet tip under a "—" hero when sync has already run — prefer permission /
 * Watch-not-writing guidance over "no data yet."
 */
export function HealthSharingTip({
  focus,
  synced,
  missing,
}: {
  focus: HealthShareFocus;
  synced: boolean;
  /** True when the metric the screen cares about is absent. */
  missing: boolean;
}) {
  if (!synced || !missing) return null;

  return <p className="small muted">{healthShareMissingTip(focus)}</p>;
}

/** Settings → Apple Health explainer — always useful, calm. */
export function HealthSharingGuide({ synced }: { synced: boolean }) {
  return (
    <div className="card">
      <div className="row">
        <span className="row__lead row__lead--accent">
          <Icon name="watch" size={18} />
        </span>
        <div className="row__body">
          <span className="row__title">What Blue Hour can read</span>
          <span className="row__sub row__sub--wrap">
            {synced
              ? `Only what Health sharing allows. In the Health app: ${HEALTH_SHARE_PATH}. Turn on Sleep, Heart Rate, Resting Heart Rate, Heart Rate Variability, Workouts, Steps, and Active Energy. iOS never says which ones were refused — a missing metric shows as —. Without Steps or Active Energy, day activity stays —.`
              : `Open Blue Hour on iPhone and Allow Health. Later: ${HEALTH_SHARE_PATH}. Turn on Sleep, Steps, and Active Energy as well as heart rate and workouts — without Sleep, Today stays empty overnight; without Steps or Active Energy, day activity stays —.`}
          </span>
        </div>
      </div>
    </div>
  );
}
