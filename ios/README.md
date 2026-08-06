# Blue Hour for iPhone

A small native shell: it reads Apple Health, shows the Blue Hour web app, and fires **local notifications** for the morning brief and water reminders. Apple Health has no web API, so a Safari tab can never see your Watch data — this app is the bridge.

It reads and never writes: workouts, sleep, resting heart rate, and HRV from the last 14 days, posted to `/api/health/ingest` every time you open or return to the app. **Settings → Apple Health** also has a Sync button that asks this shell to pull again.

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
- **Water** — every even hour from 8am to 10pm Austin, skipped once the day's water target is logged. Each water banner includes a **+ Cup** action that logs 8 oz without opening the app.
- Both stop if morning reminders are paused on the website.

Open the app (or return to it) to refresh the next few days of copy. Gear → **Send a test notification** to confirm iOS will show banners (the test includes the + Cup button).

On a locked phone: long-press or pull down the banner to reveal **+ Cup**.

If you denied the prompt: **Settings → Notifications → Blue Hour → Allow**.

## Daily use

Open the app. It syncs Health, reschedules notifications, and reloads Today when new data lands. The status strip at the top shows what happened; the arrow re-syncs by hand, the gear reopens the connection settings. On the Apple Health page, **Sync from Apple Health** does the same pull.

## The seven-day thing

Apps signed with a free Apple ID stop working after 7 days. When Blue Hour refuses to open, plug the phone in and press **Run** again — about thirty seconds, and your data is untouched. A paid Apple Developer account ($99/year) removes this, but nothing else here costs money.

## Permission notes

- HealthKit denials are silent by design: iOS never tells an app which read permissions you refused, so a missing metric shows as "—" rather than an error.
- To change what it can see later: **Health app → Sharing → Apps → Blue Hour**. Turn on **Sleep** as well as heart rate and workouts — without Sleep, Today stays empty for overnight hours.
- Health sync happens only while the app is open. Notifications are scheduled on-device for the next few days, so briefs and water pings still fire if you do not open the app that morning.
