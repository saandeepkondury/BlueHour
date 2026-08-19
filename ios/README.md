# Blue Hour for iPhone

A small native shell: it reads Apple Health, shows the Blue Hour web app, and fires **local notifications** for the morning brief and water reminders. Apple Health has no web API, so a Safari tab can never see your Watch data — this app is the bridge.

It reads and never writes: HealthKit sleep, resting HR, walking HR, HRV, daytime heart-rate range, **steps**, **active energy**, and workouts are synced, but the server only keeps days on or after your training start date so pre-app history does not crowd Sleep, Rest HR, HRV, or Runs. Agents can read a day snapshot from `GET /api/health/day` with the same device token, scoped to that account. **Settings → Apple Health** also has a Sync button that asks this shell to pull again. Siri can log water, read today's plan, sync Health, and open screens without tapping.

Sync runs when you open the app, when HealthKit delivers new samples in the background, and on a periodic background refresh — so Today should not stay empty just because you skipped opening the app that morning.

## One-time setup

### 1. Install Xcode

Xcode is not on this Mac yet — only the Command Line Tools. Install **Xcode** (free) from the Mac App Store, open it once to accept the license, then:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 2. Build to your iPhone

1. Open `ios/BlueHour.xcodeproj`.
2. Select the **BlueHour** target, then **Signing & Capabilities**.
3. Set **Team** to your personal Apple ID (Add an Account… if the list is empty).
4. If signing complains the bundle ID is taken, change **Bundle Identifier** to something unique such as `com.yourname.bluehour`.
5. Plug in the iPhone, pick it in the device menu, press **Run**.
6. On the phone: **Settings → General → VPN & Device Management** → trust your developer certificate.

### 3. Sign in

On first launch the app asks for:

- **Address** — the deployed site (`https://…vercel.app`), or `http://192.168.1.174:3000` while `npm run dev` is running on this Mac and the phone is on the same Wi-Fi. `npm run dev` listens on every interface so the phone can reach the Mac.
- **Email and password** — your Blue Hour account. Flip **Create a new account** to sign up from the phone instead of the browser.

Signing in exchanges the password for a device token, which is stored in the iPhone keychain and never leaves it. Every request this app makes — Health ingest, the day snapshot, the notification schedule, Siri — carries that token, so the server only ever writes to your account. There is no shared secret to paste.

The embedded web pages are signed in for you: the app trades its device token for a session cookie (`/api/auth/web-session`) and installs it in the web view, so you do not sign in twice. If the session lapses, the app quietly mints another.

Sign out on this phone from the same gear sheet. That revokes nothing else — your other devices keep working, and **More → Account** on the site can revoke any device by name.

Then iOS shows the Health permission sheet: turn on **Workouts**, **Sleep**, **Heart Rate**, **Resting Heart Rate**, **Heart Rate Variability**, **Steps**, and **Active Energy**, and tap Allow. Shortly after, it asks to send notifications — allow that too.

#### Upgrading a phone set up before accounts existed

A phone still holding the old `HEALTH_INGEST_SECRET` keeps syncing as long as the deploy has exactly one account, so nothing breaks the moment you upgrade. Sign in from the gear sheet when convenient; the keychain entry is replaced with a device token and the old secret can be dropped from the environment.

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

Sign in once (address + account) before Siri can reach the trainer. Phrases also appear under **Shortcuts → Apps → Blue Hour**.

**After every Xcode rebuild:** open Blue Hour once on the phone. Launch re-registers the App Shortcuts so they show up again in the Shortcuts app (a debug reinstall clears the previous index). Then force-quit and reopen **Shortcuts** if the list still looks empty.

Deep links work the same way: `bluehour://water`, `bluehour://coach`, `bluehour://sync`, etc.

## Daily use

Open the app. It syncs Health, reschedules notifications, and reloads Today when new data lands. The status strip at the top shows what happened; the arrow re-syncs by hand, the gear reopens the connection settings. On the Apple Health page, **Sync from Apple Health** does the same pull.

## The seven-day thing

Apps signed with a free Apple ID stop working after 7 days. When Blue Hour refuses to open, plug the phone in and press **Run** again — about thirty seconds, and your data is untouched. A paid Apple Developer account ($99/year) removes this, but nothing else here costs money.

## Permission notes

- HealthKit denials are silent by design: iOS never tells an app which read permissions you refused, so a missing metric shows as "—" rather than an error.
- To change what it can see later: **Health app → Sharing → Apps → Blue Hour**. Turn on **Sleep**, **Steps**, and **Active Energy** as well as heart rate and workouts — without Sleep, Today stays empty for overnight hours; without Steps / Active Energy, day snapshots show "—" for activity.
- Health sync also runs in the background (new samples + periodic refresh). Open the app once after installing this build so observers and the refresh task register. Notifications are still scheduled on-device for the next few days, so briefs and water pings fire even if you do not open the app that morning.
