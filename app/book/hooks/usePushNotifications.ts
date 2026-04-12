"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

type PushState = "idle" | "unsupported" | "denied" | "granted" | "loading";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
    } else if (Notification.permission === "granted") {
      setState("granted");
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (state === "unsupported" || state === "denied") return false;
    setState("loading");

    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const { vapidPublicKey } = await fetchBookJson<{ vapidPublicKey: string | null }>(
        "/app/api/book/me/devices/vapid-key"
      );
      if (!vapidPublicKey) {
        setState("idle");
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return false;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      const json = subscription.toJSON();
      await fetchBookJson("/app/api/book/me/devices/register", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      setState("granted");
      return true;
    } catch (err) {
      console.error("[push] subscription failed:", err);
      setState("idle");
      return false;
    }
  }, [state]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetchBookJson("/app/api/book/me/devices/unregister", {
          method: "POST",
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("idle");
    } catch (err) {
      console.error("[push] unsubscribe failed:", err);
    }
  }, []);

  return { state, subscribe, unsubscribe };
}
