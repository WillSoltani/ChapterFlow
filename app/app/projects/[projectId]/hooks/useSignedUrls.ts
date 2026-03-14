"use client";

import { useEffect, useRef, useState } from "react";
import type { FileRow } from "../../_lib/types";
import { getInlineUrl } from "../_lib/api-client";
import {
  isPresignedUrlExpired,
  previewLifecycleBlockedReason,
  supportsBrowserImagePreview,
} from "../_lib/preview";

const URL_FETCH_BATCH_SIZE = 10;
const URL_RETRY_BACKOFF_MS = 10000;

export function useSignedUrls(projectId: string, files: FileRow[]) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const retryAfterRef = useRef<Map<string, number>>(new Map());
  // Mirror of signedUrls as a ref so the fetch effect can read current values
  // without including signedUrls in its dependency array (which would cause a
  // self-triggering feedback loop: fetch → setState → re-run effect → fetch…).
  const signedUrlsRef = useRef<Record<string, string>>({});

  // Keep the ref in sync with state.
  useEffect(() => {
    signedUrlsRef.current = signedUrls;
  }, [signedUrls]);

  useEffect(() => {
    const validIds = new Set(
      files
        .map((f) => f.fileId)
        .filter((x): x is string => Boolean(x))
    );

    retryAfterRef.current.forEach((_value, key) => {
      if (!validIds.has(key)) retryAfterRef.current.delete(key);
    });
    inFlightRef.current.forEach((key) => {
      if (!validIds.has(key)) inFlightRef.current.delete(key);
    });

    setSignedUrls((prev) => {
      const keys = Object.keys(prev);
      const staleKeys = keys.filter((k) => !validIds.has(k));
      if (staleKeys.length === 0) return prev;
      const next = { ...prev };
      for (const key of staleKeys) delete next[key];
      return next;
    });
  }, [files]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const nowMs = Date.now();
      const ids = files
        .filter((f) => supportsBrowserImagePreview({
          filename: f.filename,
          contentType: f.contentType,
        }))
        .filter((f) => !previewLifecycleBlockedReason({ status: f.status }))
        .map((f) => f.fileId)
        .filter((x): x is string => Boolean(x));

      // Use the ref (not state) so this check doesn't re-trigger the effect.
      const need = ids.filter((id) => {
        if (inFlightRef.current.has(id)) return false;
        const retryAfter = retryAfterRef.current.get(id);
        if (retryAfter && nowMs < retryAfter) return false;
        const current = signedUrlsRef.current[id];
        if (!current) return true;
        return isPresignedUrlExpired(current);
      });
      if (!need.length) return;

      const batch = need.slice(0, URL_FETCH_BATCH_SIZE);
      for (const id of batch) inFlightRef.current.add(id);

      // Fetch all URLs in parallel instead of sequentially.
      const results = await Promise.all(
        batch.map(async (id) => {
          try {
            const url = await getInlineUrl(projectId, id);
            return { id, url };
          } catch {
            return { id, url: null };
          } finally {
            inFlightRef.current.delete(id);
          }
        })
      );

      if (cancelled) return;

      // Batch all new URLs into a single setState call → single re-render.
      const updates: Record<string, string> = {};
      for (const { id, url } of results) {
        if (url) {
          retryAfterRef.current.delete(id);
          updates[id] = url;
          continue;
        }
        retryAfterRef.current.set(id, Date.now() + URL_RETRY_BACKOFF_MS);
      }
      if (Object.keys(updates).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...updates }));
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId, files]); // signedUrls intentionally omitted — read via ref

  function dropSignedUrl(fileId: string) {
    setSignedUrls((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
    retryAfterRef.current.delete(fileId);
    inFlightRef.current.delete(fileId);
  }

  return { signedUrls, dropSignedUrl };
}
