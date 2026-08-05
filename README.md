# Blue Hour

A personal training, fueling, and strength app for the Ascension Seton Austin Half Marathon on
14 February 2027. Twenty-eight weeks: base, build, specific (quality Tuesdays), peak, and taper,
with Strength A / Abs A / Strength B+Abs B locked to the long-run grid. Installable as a PWA on
iPhone, sends a morning push notification, reads Apple Watch data, and proposes plan changes it
will not make without permission.

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
   against its own baseline, HRV, sleep debt, missed runs, weekly mileage jumps, protein and
   calorie adherence, strength adherence, and whether the body-fat target still fits the calendar.
   They run on every page load and after every Watch sync. No API key, no data leaving the machine.
2. **The model** — press *Ask the coach* and a ~6 kB summary of the last fourteen days goes to
   OpenAI. No name, no email. It can only answer in the operation vocabulary in
   `lib/coach/types.ts`; anything else it invents is dropped, and out-of-range values are clamped.

Nothing either layer proposes is applied until you press Apply. Dismissed suggestions do not come
back — each one carries a fingerprint.

Add the key in **Settings → OpenAI** (stored in the database) or set `OPENAI_API_KEY` in the
environment, which takes precedence.

## Apple Watch

Free, no Xcode, no developer account: **Settings → Apple Health sync** mints a token and walks
through an iPhone Shortcut that posts a flat daily payload to `/api/health/ingest`.

```bash
curl -X POST "$APP_URL/api/health/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"date":"2027-01-04","asleepMin":455,"restingHr":54,"hrvMs":61,"weightLb":178,"waistIn":35.25}'
```

The same endpoint accepts structured `sleep`, `vitals`, and `workouts` arrays from the native shell
in `ios/`, which is optional. A posted run auto-completes the planned run for that day. A waist
measurement plus your height becomes a body-fat estimate, so the abs goal gets a real date.

There is a manual entry form for mornings the sync did not run.

## Deploying

1. **Database** — create a Turso database and set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`. Tables
   are created on first connection; there is no migration step to forget.
2. **Passcode** — set `APP_PASSCODE`. Without it the deployed app is open to anyone with the URL.
3. **Push** — `npm run keys:vapid`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   and `VAPID_SUBJECT`. Web push on iOS only works once the app is added to the home screen.
4. **Cron** — `vercel.json` runs `/api/cron/remind` daily at 12:00 UTC (Hobby limit). That is 6am
   Austin in winter and 7am in summer. The route also accepts the following hour so DST does not
   skip a send, and records the day so a retry cannot double up. Vercel provides `CRON_SECRET`.
   On Pro you can switch the schedule back to hourly.
5. **`NEXT_PUBLIC_APP_URL`** — the absolute URL, used in reminder links and the Shortcut setup.

Copy `.env.example` to `.env.local` for local overrides. Check the morning brief before you trust
it: **Settings → The morning brief** previews today's notification and can send a test push.

## Not medical advice

General guidance for a healthy adult training for a half marathon. Pain that changes how you run,
or anything that persists, belongs to a doctor or a physio.
