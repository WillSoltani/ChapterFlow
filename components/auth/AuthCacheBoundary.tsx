"use client";

import { useEffect } from "react";

import {
  announceBookCacheAuthGeneration,
  consumeBookCacheAuthReloadRequired,
  reconcileBookCacheAuthGeneration,
} from "@/lib/client/book-api-cache";
import {
  AUTH_CACHE_GENERATION_CHANGED_EVENT,
  AUTH_CACHE_GENERATION_STORAGE_KEY,
} from "@/lib/auth-cache-generation";
import { ensureLocalUserDataOwner } from "@/lib/client/local-user-data";

/** Clears and reloads an old document when shared auth cookies change identity. */
export function AuthCacheBoundary() {
  // DATA-01: drop the previous account's stored data before anything reads it.
  // This component renders ahead of the whole app in the root layout, and
  // render runs before every effect and every later sibling's state
  // initializer, so the check must happen here, synchronously, not in an
  // effect (parent effects run after their children's).
  if (typeof window !== "undefined") ensureLocalUserDataOwner();

  useEffect(() => {
    let reloading = false;

    const reconcileAndReload = () => {
      // Another tab signed in or out: re-scope storage before this page reloads.
      ensureLocalUserDataOwner();
      reconcileBookCacheAuthGeneration();
      if (!reloading && consumeBookCacheAuthReloadRequired()) {
        reloading = true;
        window.location.reload();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_CACHE_GENERATION_STORAGE_KEY || event.key === null) {
        reconcileAndReload();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") reconcileAndReload();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", reconcileAndReload);
    window.addEventListener("pageshow", reconcileAndReload);
    window.addEventListener(
      AUTH_CACHE_GENERATION_CHANGED_EVENT,
      reconcileAndReload,
    );
    document.addEventListener("visibilitychange", onVisibility);

    reconcileAndReload();
    if (!reloading) announceBookCacheAuthGeneration();

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", reconcileAndReload);
      window.removeEventListener("pageshow", reconcileAndReload);
      window.removeEventListener(
        AUTH_CACHE_GENERATION_CHANGED_EVENT,
        reconcileAndReload,
      );
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
