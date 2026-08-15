# Blue Hour for iPhone

A small native shell: it reads Apple Health, shows the Blue Hour web app, and fires **local notifications** for the morning brief and water reminders. Apple Health has no web API, so a Safari tab can never see your Watch data — this app is the bridge.

It reads and never writes: HealthKit sleep, resting HR, walking HR, HRV, daytime heart-rate range, and workouts are synced, but the server only keeps days on or after your training start date so pre-app history does not crowd Sleep, Rest HR, HRV, or Runs. Agents can read a day snapshot from `GET /api/health/day` with the same sync key. **Settings → Apple Health** also has a Sync button that asks this shell to pull again. Siri can log water, read today's plan, sync Health, and open screens without tapping.

## One-time setup

### 1. Install Xcode

Xcode is not on this Mac yet — only the Command Line Tools. Install **Xcode** (free) from the Mac App Store, open it once to accept the license, then:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 2. Set a sync key

The server refuses Health data unless `HEALTH_INGEST_SECRET` is set. Generate one:

```bash
openssl rand -hex 32
```

Put it in `.env.local` for local runs, and in Vercel's environment variables for the deployed site.

### 3. Build to your iPhone

1. Open `ios/BlueHour.xcodeproj`.
2. Select the **BlueHour** target, then **Signing & Capabilities**.
3. Set **Team** to your personal Apple ID (Add an Account… if the list is empty).
4. If signing complains the bundle ID is taken, change **Bundle Identifier** to something unique such as `com.yourname.bluehour`.
5. Plug in the iPhone, pick it in the device menu, press **Run**.
6. On the phone: **Settings → General → VPN & Device Management** → trust your developer certificate.

### 4. Connect it

On first launch the app asks for two things:

- **Address** — the deployed site (`https://…vercel.app`), or `http://192.168.1.174:3000` while `npm run dev` is running on this Mac and the phone is on the same Wi-Fi. `npm run dev` listens on every interface so the phone can reach the Mac.
- **Sync key** — the same value as `HEALTH_INGEST_SECRET`.

It verifies both before asking for anything else. Then iOS shows the Health permission sheet: turn on **Workouts**, **Sleep**, **Heart Rate**, **Resting Heart Rate**, and **Heart Rate Variability**, and tap Allow. Shortly after, it asks to send notifications — allow that too.

The key is stored in the iPhone keychain, not in this repo. You only enter it once in this native Connect screen — not in the web UI.

## Notifications

These are native local notifications on this phone, not Safari web push.

- **Morning brief** — at the reminder hour in Settings (default 6am Austin), with that day's workout copy.
- **Water** — one reminder per target cup, evenly spaced from 9am to 8pm Austin; skipped when intake is already on pace or the day's target is logged. Each water banner includes a **+ Cup** action that logs 18 oz (≈540 ml) without opening the app.
- Both stop if morning reminders are paused on the website.

Open the app (or return to it) to refresh the next few days of copy. Gear → **Send a test notification** to confirm iOS will show banners (the test includes the + Cup button).

On a locked phone: long-press or pull down the banner to reveal **+ Cup**.

If you denied the prompt: **Settings → Notifications → Blue Hour → Allow**.

## Siri

The shell registers App Intents so you can talk to Blue Hour without opening it:

| Say… | What happens |
| --- | --- |
| “Hey Siri, log a cup in Blue Hour” | Posts one cup (18 oz / ≈540 ml) via `/api/water/log` |
| “Hey Siri, what's today's plan in Blue Hour” | Speaks today's workout + water snapshot |
| “Hey Siri, sync Health in Blue Hour” | Pulls Apple Watch data and posts ingest |
| “Hey Siri, open Water in Blue Hour” | Opens that screen in the WebView |

Connect the app once (address + sync key) before Siri can reach the trainer. Phrases also appear under **Shortcuts → Apps → Blue Hour**.

**After every Xcode rebuild:** open Blue Hour once on the phone. Launch re-registers the App Shortcuts so they show up again in the Shortcuts app (a debug reinstall clears the previous index). Then force-quit and reopen **Shortcuts** if the list still looks empty.

Deep links work the same way: `bluehour://water`, `bluehour://coach`, `bluehour://sync`, etc.

## Daily use

Open the app. It syncs Health, reschedules notifications, and reloads Today when new data lands. The status strip at the top shows what happened; the arrow re-syncs by hand, the gear reopens the connection settings. On the Apple Health page, **Sync from Apple Health** does the same pull.

## The seven-day thing

Apps signed with a free Apple ID stop working after 7 days. When Blue Hour refuses to open, plug the phone in and press **Run** again — about thirty seconds, and your data is untouched. A paid Apple Developer account ($99/year) removes this, but nothing else here costs money.

## Permission notes

- HealthKit denials are silent by design: iOS never tells an app which read permissions you refused, so a missing metric shows as "—" rather than an error.
- To change what it can see later: **Health app → Sharing → Apps → Blue Hour**. Turn on **Sleep** as well as heart rate and workouts — without Sleep, Today stays empty for overnight hours.
- Health sync happens only while the app is open. Notifications are scheduled on-device for the next few days, so briefs and water pings still fire if you do not open the app that morning.
