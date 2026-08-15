# Blue Hour

A personal training, fueling, and strength app for the Ascension Seton Austin Half Marathon on
14 February 2027. Twenty-eight weeks: base, build, specific (quality Tuesdays), peak, and taper,
with Strength A / Abs A / Strength B+Abs B locked to the long-run grid. The iPhone app in `ios/`
reads Apple Watch data and fires native local notifications (morning brief + water every two
hours). The site is also installable as a PWA, and proposes plan changes it will not make without
permission.

## Running it

```bash
npm install
npm run dev
```

Zero configuration required. The database defaults to a local SQLite file, the passcode gate stays
open, and the first page load generates the whole 28-week block from today back-to-front off the
race date.

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
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

The iPhone app in `ios/` reads HealthKit and posts to `/api/health/ingest` every time you open it.
Trusted agents can read a compact day snapshot from `GET /api/health/day?date=YYYY-MM-DD`
(same Bearer `HEALTH_INGEST_SECRET` as ingest).
**Settings → Apple Health** has a Sync button for an on-demand pull. A posted run auto-completes
the planned run for that day. There is a manual entry form for mornings the Watch has not landed yet.

Set `HEALTH_INGEST_SECRET` (see `ios/README.md`) so the phone can authenticate.

## Deploying

1. **Database** — create a Turso database and set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`. Tables
   are created on first connection; there is no migration step to forget.
2. **Passcode** — set `APP_PASSCODE`. Without it the deployed app is open to anyone with the URL.
3. **Push** — `npm run keys:vapid`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   and `VAPID_SUBJECT`. Web push on iOS only works once the app is added to the home screen.
4. **Cron** — `vercel.json` runs `/api/cron/remind` daily at 12:00 UTC (Hobby limit). That is 6am
   Austin in winter and 7am in summer. The route also accepts the following hour so DST does not
   skip a send, and records the day so a retry cannot double up. Set `CRON_SECRET` yourself (Vercel
   will use it for the morning job) and add the same value plus `APP_URL` as GitHub Actions secrets
   so `.github/workflows/water-reminder.yml` can hit `/api/cron/water` every hour. The route
   spaces one ping per target cup from 9am to 8pm Austin, skips when intake is already on pace,
   and stops once the day's water target is met.
5. **`NEXT_PUBLIC_APP_URL`** — the absolute URL, used in reminder links.
6. **`HEALTH_INGEST_SECRET`** — required for Apple Health sync from the iPhone app.

Copy `.env.example` to `.env.local` for local overrides. On the iPhone app, notifications are native: allow them when asked, then use the gear sheet's
test button. Web push (VAPID) is only for the home-screen PWA. **Settings → Notifications**
previews today's morning brief.

## Not medical advice

General guidance for a healthy adult training for a half marathon. Pain that changes how you run,
or anything that persists, belongs to a doctor or a physio.
