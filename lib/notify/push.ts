import webpush from "web-push";
import { deletePushSubscriptions, listPushSubscriptions } from "@/lib/store";

/**
 * Web push to every device that has opted in. Subscriptions die quietly — a
 * reinstalled PWA, a cleared browser — so 404 and 410 responses prune
 * themselves rather than failing the send.
 */

export interface PushResult {
  sent: number;
  removed: number;
  reason?: string;
}

function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:sandeepkondury@gmail.com",
    publicKey,
    privateKey,
  );
  return true;
}

export async function sendPush(payload: {
  title: string;
  body: string;
  url: string;
}): Promise<PushResult> {
  if (!configure()) return { sent: 0, removed: 0, reason: "VAPID keys are not set" };

  const subscriptions = await listPushSubscriptions();
  if (subscriptions.length === 0) return { sent: 0, removed: 0, reason: "no subscriptions" };

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(row.endpoint);
      }
    }),
  );

  await deletePushSubscriptions(dead);
  return { sent, removed: dead.length };
}
