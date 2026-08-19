import { redirect } from "next/navigation";
import {
  deleteMyAccount,
  issueDeviceToken,
  revokeDevice,
  signOut,
  signOutEverywhere,
} from "@/app/auth-actions";
import { AppBar } from "@/components/AppBar";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { listDeviceTokens } from "@/lib/auth/tokens";
import { sessionUser } from "@/lib/auth/session";
import { pendingCount } from "@/lib/coach/store";
import { formatWithYear } from "@/lib/date";
import { getProfile, isOnboarded } from "@/lib/store";

export const metadata = { title: "Account · Blue Hour" };
export const dynamic = "force-dynamic";

/**
 * Deliberately outside the gated group: signing out and deleting the account
 * have to be reachable before onboarding is finished, not just after.
 */

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const user = await sessionUser();
  if (!user) redirect("/signin");

  const [devices, pending, profile] = await Promise.all([
    listDeviceTokens(user.id),
    pendingCount(),
    getProfile(),
  ]);
  const onboarded = isOnboarded(profile);

  return (
    <>
      <Shell>
        <AppBar title="Account" back={onboarded ? "/more" : "/onboard"} pending={pending} />

        {error ? <p className="notice notice--bad">{error}</p> : null}

        <section className="block block--tight">
          <div className="block__head">
            <h2 className="block__title">Signed in</h2>
          </div>
          <div className="card stack">
            <p className="row__title" style={{ margin: 0 }}>
              {user.name || "Runner"}
            </p>
            <p className="small muted" style={{ margin: 0 }}>
              {user.email} · joined {formatWithYear(user.createdAt.slice(0, 10))}
            </p>
            <hr className="card__divide" />
            <div className="grid2">
              <form action={signOut}>
                <button className="btn btn--quiet btn--block btn--sm" type="submit">
                  Sign out
                </button>
              </form>
              <form action={signOutEverywhere}>
                <button className="btn btn--quiet btn--block btn--sm" type="submit">
                  Sign out everywhere
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">iPhone sync</h2>
          </div>
          <div className="card stack">
            {token ? (
              <>
                <p className="notice notice--good">
                  Paste this into the iPhone app once. It is shown here only this time.
                </p>
                <code
                  className="small"
                  style={{ wordBreak: "break-all", display: "block", lineHeight: 1.5 }}
                >
                  {token}
                </code>
                <hr className="card__divide" />
              </>
            ) : null}

            <p className="small muted" style={{ margin: 0 }}>
              The iPhone app sends Apple Health data with a key tied to this account. Signing in
              from the app creates one automatically — issue one by hand only if you are pasting it
              in.
            </p>

            {devices.length > 0 ? (
              <div className="rows">
                {devices.map((device) => (
                  <div className="row" key={device.id}>
                    <span className="row__body">
                      <span className="row__title">{device.label}</span>
                      <span className="row__sub">
                        {device.lastUsedAt
                          ? `last synced ${formatWithYear(device.lastUsedAt.slice(0, 10))}`
                          : "never used"}
                      </span>
                    </span>
                    <form action={revokeDevice}>
                      <input type="hidden" name="id" value={device.id} />
                      <button className="btn btn--quiet btn--sm" type="submit">
                        Revoke
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : null}

            <form action={issueDeviceToken} className="stack">
              <label className="field">
                <span className="field__label">Device name</span>
                <input name="label" placeholder="iPhone" />
              </label>
              <button className="btn btn--ghost btn--block btn--sm" type="submit">
                Issue a sync key
              </button>
            </form>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Delete account</h2>
          </div>
          <div className="card stack">
            <p className="small muted" style={{ margin: 0 }}>
              Removes your plan, runs, meals, strength log, and every Apple Health day this app
              stored. It cannot be undone and nothing is kept.
            </p>
            <form action={deleteMyAccount} className="stack">
              <label className="field">
                <span className="field__label">Type your email to confirm</span>
                <input
                  name="confirmEmail"
                  type="email"
                  placeholder={user.email}
                  autoCapitalize="none"
                  required
                />
              </label>
              {user.passwordHash ? (
                <label className="field">
                  <span className="field__label">Password</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
              ) : null}
              <button className="btn btn--danger btn--block btn--sm" type="submit">
                Delete my account
              </button>
            </form>
          </div>
        </section>
      </Shell>
      {onboarded ? <Nav pending={pending} /> : null}
    </>
  );
}
