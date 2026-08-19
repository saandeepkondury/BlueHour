/**
 * End-to-end check that two accounts cannot see each other's data.
 *
 *   npm run build && npm start        # in one terminal
 *   node scripts/verify-isolation.mjs # in another
 *
 * Creates two throwaway accounts, writes Apple Health and water data as each,
 * and asserts that every read is scoped to the account that wrote it.
 */

const BASE = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

let failures = 0;

function check(label, condition, detail) {
  const status = condition ? "pass" : "FAIL";
  if (!condition) failures += 1;
  console.log(`${status}  ${label}${detail && !condition ? ` — ${detail}` : ""}`);
}

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: response.status, json };
}

async function signUp(tag) {
  const email = `iso-${tag}-${Date.now()}@example.test`;
  const result = await api("/api/auth/signup", {
    method: "POST",
    body: { email, password: "correct horse battery", name: tag, label: `${tag} phone` },
  });
  if (result.status !== 200) {
    throw new Error(`signup for ${tag} failed: ${result.status} ${JSON.stringify(result.json)}`);
  }
  return { email, token: result.json.token };
}

const today = new Date().toISOString().slice(0, 10);

const a = await signUp("alice");
const b = await signUp("bob");

check("two accounts get different device tokens", a.token !== b.token);

// --- Apple Health lands only on the account that sent it -------------------

const ingestA = await api("/api/health/ingest", {
  method: "POST",
  token: a.token,
  body: {
    device: "Alice iPhone",
    days: [{ date: today, asleepMin: 431, restingHr: 47, hrvMs: 82, steps: 9100 }],
  },
});
check("account A can post Health data", ingestA.status === 200, JSON.stringify(ingestA.json));

const ingestB = await api("/api/health/ingest", {
  method: "POST",
  token: b.token,
  body: {
    device: "Bob iPhone",
    days: [{ date: today, asleepMin: 300, restingHr: 61, hrvMs: 40, steps: 2200 }],
  },
});
check("account B can post Health data", ingestB.status === 200, JSON.stringify(ingestB.json));

const dayA = await api(`/api/health/day?date=${today}`, { token: a.token });
const dayB = await api(`/api/health/day?date=${today}`, { token: b.token });

check("A reads back A's sleep", dayA.json?.sleep?.asleepMin === 431, JSON.stringify(dayA.json?.sleep));
check("B reads back B's sleep", dayB.json?.sleep?.asleepMin === 300, JSON.stringify(dayB.json?.sleep));
check("A's resting HR is not B's", dayA.json?.heart?.restingHr === 47);
check("B's resting HR is not A's", dayB.json?.heart?.restingHr === 61);
check(
  "each account sees its own device name",
  dayA.json?.lastSyncDevice === "Alice iPhone" && dayB.json?.lastSyncDevice === "Bob iPhone",
  `${dayA.json?.lastSyncDevice} / ${dayB.json?.lastSyncDevice}`,
);

// --- Water is per account --------------------------------------------------

await api("/api/water/log", { method: "POST", token: a.token, body: { date: today, oz: 18 } });
await api("/api/water/log", { method: "POST", token: a.token, body: { date: today, oz: 18 } });
const waterB = await api("/api/water/log", {
  method: "POST",
  token: b.token,
  body: { date: today, oz: 18 },
});

const afterA = await api(`/api/health/day?date=${today}`, { token: a.token });
check("A's water total counts only A's cups", afterA.json?.water?.oz === 36, String(afterA.json?.water?.oz));
check("B's water total counts only B's cups", waterB.json?.waterOz === 18, String(waterB.json?.waterOz));

// --- Unauthenticated and forged access ------------------------------------

const noToken = await api(`/api/health/day?date=${today}`);
check("no token is refused", noToken.status === 401, String(noToken.status));

const badToken = await api(`/api/health/day?date=${today}`, { token: "not-a-real-token" });
check("a forged token is refused", badToken.status === 401, String(badToken.status));

const ingestNoToken = await api("/api/health/ingest", {
  method: "POST",
  body: { days: [{ date: today, restingHr: 200 }] },
});
check("Health ingest without a token is refused", ingestNoToken.status === 401, String(ingestNoToken.status));

const siriNoToken = await api("/api/siri/today");
check("Siri route without a token is refused", siriNoToken.status === 401, String(siriNoToken.status));

const scheduleNoToken = await api("/api/notifications/schedule");
check("notification schedule without a token is refused", scheduleNoToken.status === 401, String(scheduleNoToken.status));

// --- Duplicate email -------------------------------------------------------

const duplicate = await api("/api/auth/signup", {
  method: "POST",
  body: { email: a.email, password: "correct horse battery" },
});
check("the same email cannot be registered twice", duplicate.status === 409, String(duplicate.status));

const wrongPassword = await api("/api/auth/signin", {
  method: "POST",
  body: { email: a.email, password: "wrong password entirely" },
});
check("a wrong password is refused", wrongPassword.status === 401, String(wrongPassword.status));

const rightPassword = await api("/api/auth/signin", {
  method: "POST",
  body: { email: a.email, password: "correct horse battery" },
});
check("the right password issues a new device token", rightPassword.status === 200 && Boolean(rightPassword.json.token));

console.log(failures === 0 ? "\nAll isolation checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
