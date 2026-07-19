"use client";

import { useEffect } from "react";

import {
  announceBookCacheAuthGeneration,
  consumeBookCacheAuthReloadRequired,
  reconcileBookCacheAuthGeneration,
} from "@/app/book/_lib/book-api-cache";
import {
  AUTH_CACHE_GENERATION_CHANGED_EVENT,
  AUTH_CACHE_GENERATION_STORAGE_KEY,
} from "@/lib/auth-cache-generation";

/** Clears and reloads an old document when shared auth cookies change identity. */
export function AuthCacheBoundary() {
  useEffect(() => {
    let reloading = false;

    const reconcileAndReload = () => {
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
