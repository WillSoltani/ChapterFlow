"use client";

import { useCallback, useState } from "react";
import { getInlineUrl } from "../_lib/api-client";
import { canPreview, isPresignedUrlExpired, logPreviewHiddenReasonOnce, type PreviewCandidate } from "../_lib/preview";
import type { FilePreviewState } from "../components/FilePreviewModal";

type OpenPreviewArgs = PreviewCandidate & {
  section: "ready" | "converted";
  filename: string;
  formatLabel: string;
};

export function useFilePreview(projectId: string) {
  const [preview, setPreview] = useState<FilePreviewState | null>(null);

  const resolvePreviewUrl = useCallback(
    async (args: OpenPreviewArgs): Promise<string | null> => {
      const currentUrl = String(args.previewUrl ?? "").trim();
      const hasLocalSource = Boolean(args.hasLocalSource);
      if (hasLocalSource && currentUrl) return currentUrl;

      if (currentUrl && !isPresignedUrlExpired(currentUrl)) {
        return currentUrl;
      }

      if (!args.fileId) return null;
      return await getInlineUrl(projectId, args.fileId);
    },
    [projectId]
  );

  const openPreview = useCallback(
    async (args: OpenPreviewArgs) => {
      const eligibility = canPreview(args);
      if (!eligibility.canPreview) {
        const recoverable =
          args.fileId &&
          (eligibility.reason === "missing_url" || eligibility.reason === "url_expired");
        if (!recoverable) {
          logPreviewHiddenReasonOnce({
            section: args.section,
            fileId: args.fileId,
            reason: eligibility.reason,
            filename: args.filename,
            formatLabel: args.formatLabel,
            status: args.status,
          });
          return;
        }
        logPreviewHiddenReasonOnce({
          section: args.section,
          fileId: args.fileId,
          reason: eligibility.reason,
          filename: args.filename,
          formatLabel: args.formatLabel,
          status: args.status,
        });
      }

      setPreview({
        fileId: args.fileId,
        url: String(args.previewUrl ?? ""),
        filename: args.filename,
        format: args.formatLabel,
        zoom: 1,
        loading: true,
        error: null,
      });

      try {
        const nextUrl = await resolvePreviewUrl(args);
        if (!nextUrl) {
          setPreview((prev) =>
            prev
              ? {
                  ...prev,
                  loading: false,
                  error: "Preview source is unavailable right now. Try again in a moment.",
                }
              : prev
          );
          return;
        }
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                url: nextUrl,
                loading: false,
                error: null,
              }
            : prev
        );
      } catch (error: unknown) {
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : "Failed to load preview.",
              }
            : prev
        );
      }
    },
    [resolvePreviewUrl]
  );

  const closePreview = useCallback(() => setPreview(null), []);

  const zoomIn = useCallback(() => {
    setPreview((prev) => (prev ? { ...prev, zoom: Math.min(4, Number((prev.zoom + 0.25).toFixed(2))) } : prev));
  }, []);

  const zoomOut = useCallback(() => {
    setPreview((prev) => (prev ? { ...prev, zoom: Math.max(0.5, Number((prev.zoom - 0.25).toFixed(2))) } : prev));
  }, []);

  const retryPreview = useCallback(async () => {
    const fileId = preview?.fileId;
    if (!preview || !fileId) {
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              error: "Preview source is unavailable.",
            }
          : prev
      );
      return;
    }

    setPreview((prev) => (prev ? { ...prev, loading: true, error: null } : prev));
    try {
      const refreshed = await getInlineUrl(projectId, fileId);
      if (!refreshed) {
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: "Unable to refresh preview URL. Please try again.",
              }
            : prev
        );
        return;
      }
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: null,
              url: refreshed,
            }
          : prev
      );
    } catch (error: unknown) {
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: error instanceof Error ? error.message : "Retry failed.",
            }
          : prev
      );
    }
  }, [preview, projectId]);

  const onImageError = useCallback(() => {
    setPreview((prev) =>
      prev
        ? {
            ...prev,
            loading: false,
            error: "The file could not be loaded. The preview URL may have expired.",
          }
        : prev
    );
  }, []);

  return {
    preview,
    openPreview,
    closePreview,
    zoomIn,
    zoomOut,
    retryPreview,
    onImageError,
  };
}
