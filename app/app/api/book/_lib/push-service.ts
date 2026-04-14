import "server-only";

import webpush from "web-push";
import { getServerEnv } from "@/app/app/api/_lib/server-env";

let configured = false;

async function ensureConfigured() {
  if (configured) return;
  const publicKey = await getServerEnv("VAPID_PUBLIC_KEY");
  const privateKey = await getServerEnv("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  }
  webpush.setVapidDetails("mailto:info@chapterflow.ca", publicKey, privateKey);
  configured = true;
}

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: boolean; expired?: boolean; error?: string }> {
  try {
    await ensureConfigured();
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    );
    return { sent: true };
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 410 || statusCode === 404) {
      return { sent: false, expired: true };
    }
    console.error("[push-service] send failed:", String(error));
    return { sent: false, error: String(error) };
  }
}

export async function getVapidPublicKey(): Promise<string | undefined> {
  return getServerEnv("VAPID_PUBLIC_KEY");
}
