# Blue Hour

A training, fueling, and strength app for a half marathon. Each runner creates an account, names
their race, and gets weeks built backward from race day: base, build, specific (quality Tuesdays),
peak, and taper, with Strength A / Abs A / Strength B+Abs B locked to the long-run grid. The iPhone
app in `ios/` reads Apple Watch data and fires native local notifications (morning brief + water
every two hours). The site is also installable as a PWA, and proposes plan changes it will not make
without permission.

## Running it

```bash
npm install
npm run dev
```

Zero configuration required. The database defaults to a local SQLite file. Create an account, set
the race date and experience, and the app builds the block backward from race day — it does not
generate a plan until you confirm.

```bash
npm run typecheck        # tsc --noEmit
npm run build            # production build
npm run verify:isolation # two accounts cannot see each other's data
```

## Accounts

Every row belongs to exactly one account. `userId` is part of each table's primary key or unique
constraint, so two runners can hold the same date without colliding, and nothing in `lib/` reads or
writes without resolving an owner first through `uid()` in `lib/auth/current.ts`.

| Piece | Where |
| --- | --- |
| Password hashing (scrypt, no dependency) | `lib/auth/password.ts` |
| Sessions — a SHA-256 of the cookie token | `lib/auth/tokens.ts`, `lib/auth/session.ts` |
| Per-device bearer tokens for the iPhone | `lib/auth/tokens.ts` |
| Which account the current work belongs to | `lib/auth/scope.ts`, `lib/auth/current.ts` |
| API authentication (device token or cookie) | `lib/auth/request.ts` |
| Sign in with Apple, verified against Apple's keys | `lib/auth/apple.ts` |
| Account creation, deletion, legacy adoption | `lib/auth/users.ts` |

Requests with no session cookie are turned away by `middleware.ts` before a page renders; the
cookie is then checked against the sessions table in the gated layout. Crons have no cookie, so they
authenticate as each runner in turn with `runAsUser`.

Deleting an account removes every row it owns — required for App Store review, and reachable in the
app under **More → Account**.

### Upgrading a database from before accounts existed

Rows written by the single-user version are parked under a `legacy` owner on first boot and handed
to the first account created on the deploy, so a personal install keeps its history. SQLite cannot
change a primary key in place, so `lib/db.ts` rebuilds each affected table — rename, recreate with
`user_id` in the key, copy the rows, drop the original. To rehearse it against a throwaway database:

```bash
node scripts/verify-legacy-upgrade.mjs seed   # write a pre-accounts local.db
npm run build && npm start
node scripts/verify-legacy-upgrade.mjs check  # first account should inherit it
```

## What is in here

| Area | Where |
| --- | --- |
| Plan generation and adaptation | `lib/plan/` |
| Nutrition targets, recipes, meals, grocery | `lib/nutrition/` |
| Strength, core, and the abs math | `lib/strength/` |
| Apple Health ingest and readiness | `lib/health/` |
| Coach snapshot, guardrail rules, OpenAI | `lib/coach/` |
| Morning brief and web push | `lib/notify/` |
| Screens | `app/` |

Everything is a server component with server actions, so the client bundle stays near 100 kB and
the app works on a bad connection at 5 a.m.

## The coach

Two layers, and the first one is free:

1. **Guardrails** — deterministic rules in `lib/coach/rules.ts` that watch resting heart rate
   against its own baseline, HRV, sleep debt, missed runs, skipped rest, weekly mileage jumps,
   protein and calorie adherence, uneaten meals, ignored recipes, strength adherence, and whether
   the body-fat target still fits the calendar. They run on every page load and after every Watch
   sync. No API key, no data leaving the machine.
2. **Daily review** — once per Austin calendar day (morning cron, or the first open of Coach), a
   compact summary goes to OpenAI: planned versus completed running and rest, sleep, meals eaten or
   ignored, grocery checks, strength, body-fat trend, and which suggestions you already applied or
   dismissed. No name, no email, no chat prompt. It can only answer in the operation vocabulary in
   `lib/coach/types.ts`; anything else it invents is dropped, and out-of-range values are clamped.

Nothing either layer proposes is applied until you press Apply. **No thanks** archives the card
under Already decided. **Delete** removes it entirely. Dismissed fingerprints do not come back the
same week.

Add the key in **Settings → OpenAI** (stored in the database) or set `OPENAI_API_KEY` in the
environment, which takes precedence.

## Apple Watch

The iPhone app in `ios/` reads HealthKit and posts to `/api/health/ingest` every time you open it,
and also in the background when new Watch data lands (HealthKit background delivery) or on a
periodic refresh. Trusted agents can read a compact day snapshot from `GET /api/health/day?date=YYYY-MM-DD`
with the same Bearer device token as ingest — and only ever see that account's data.
**Settings → Apple Health** has a Sync button for an on-demand pull. A posted run auto-completes
the planned run for that day. There is a manual entry form for mornings the Watch has not landed yet.

The phone signs in once (`POST /api/auth/signin`) and keeps the device token it gets back in the
keychain; no shared secret is pasted anywhere. See `ios/README.md`.

## Deploying

1. **Database** — create a Turso database and set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`. Tables
   are created on first connection; there is no migration step to forget.
2. **Push** — `npm run keys:vapid`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   and `VAPID_SUBJECT`. Web push on iOS only works once the app is added to the home screen.
3. **Cron** — `vercel.json` runs `/api/cron/remind` daily at 12:00 UTC (Hobby limit). Every account
   is visited in turn and judged against its own timezone and reminder hour, so one runner in Austin
   and another in Berlin each get their brief in the morning. The route also accepts the following
   hour so DST does not skip a send, and records the day per account so a retry cannot double up.
   Set `CRON_SECRET` yourself (Vercel will use it for the morning job) and add the same value plus
   `APP_URL` as GitHub Actions secrets so `.github/workflows/water-reminder.yml` can hit
   `/api/cron/water` every hour. That route spaces one ping per target cup from 9am to 8pm local,
   skips when intake is already on pace, and stops once the day's water target is met.
4. **`NEXT_PUBLIC_APP_URL`** — the absolute URL, used in reminder links.
5. **`APPLE_CLIENT_ID`** — the app's bundle id, to accept Sign in with Apple. Comma-separated if
   more than one client signs in. Without it that route answers 503 and email sign-in still works.
6. **`HEALTH_INGEST_SECRET`** — optional, and only an upgrade path. A phone still holding the old
   shared key keeps syncing while the deploy has exactly one account. Drop it once the phone has
   signed in.

Before opening a deploy to other people, confirm the isolation suite passes against it:

```bash
APP_URL=https://your-deploy.vercel.app npm run verify:isolation
```

Copy `.env.example` to `.env.local` for local overrides. On the iPhone app, notifications are native: allow them when asked, then use the gear sheet's
test button. Web push (VAPID) is only for the home-screen PWA. **Settings → Notifications**
previews today's morning brief.

## Not medical advice

General guidance for a healthy adult training for a half marathon. Pain that changes how you run,
or anything that persists, belongs to a doctor or a physio.
