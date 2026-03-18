"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import { Loader2, ZoomIn, ZoomOut, X } from "lucide-react";

export type FilePreviewState = {
  fileId?: string;
  url: string;
  filename: string;
  format: string;
  zoom: number;
  loading: boolean;
  error: string | null;
};

class PreviewErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("preview_modal_error_boundary", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[var(--cf-surface-muted)] p-6 text-center">
          <p className="text-sm font-semibold text-[var(--cf-danger-text)]">Preview failed to render.</p>
          <p className="max-w-md text-xs text-[var(--cf-text-3)]">
            Close and reopen preview. If this continues, refresh the page and try again.
          </p>
          <button
            type="button"
            onClick={this.props.onClose}
            className="cf-btn cf-btn-secondary rounded-xl px-3 py-1.5 text-xs"
          >
            Close
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function FilePreviewModal(props: {
  preview: FilePreviewState | null;
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRetry: () => void;
  onImageError: () => void;
}) {
  const { preview, onClose, onZoomIn, onZoomOut, onRetry, onImageError } = props;

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        onZoomIn();
        return;
      }
      if (event.key === "-") {
        onZoomOut();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview, onClose, onZoomIn, onZoomOut]);

  if (!preview) return null;

  return (
    <div
      className="cf-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${preview.filename}`}
      onClick={onClose}
    >
      <div
        className="cf-panel-strong flex h-[92dvh] w-full max-w-6xl flex-col rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cf-divider)] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--cf-text-1)]">{preview.filename}</div>
            <div className="text-xs text-[var(--cf-text-3)]">Format: {preview.format}</div>
          </div>
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              type="button"
              onClick={onZoomOut}
              disabled={preview.loading || Boolean(preview.error)}
              className="cf-btn cf-btn-secondary h-9 w-9 rounded-lg px-0"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <div className="w-14 text-center text-xs font-semibold text-[var(--cf-text-2)]">
              {Math.round(preview.zoom * 100)}%
            </div>
            <button
              type="button"
              onClick={onZoomIn}
              disabled={preview.loading || Boolean(preview.error)}
              className="cf-btn cf-btn-secondary h-9 w-9 rounded-lg px-0"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cf-btn cf-btn-secondary ml-1 h-9 w-9 rounded-lg px-0"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <PreviewErrorBoundary onClose={onClose}>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[var(--cf-page-bg-alt)]/70 p-2 sm:p-4">
            {preview.loading ? (
              <div className="flex flex-col items-center gap-3 text-[var(--cf-text-2)]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <div className="text-sm">Loading preview…</div>
              </div>
            ) : preview.error ? (
              <div className="cf-banner cf-banner-danger mx-auto max-w-md rounded-2xl p-4 text-center">
                <p className="text-sm font-semibold">Could not load preview.</p>
                <p className="mt-1 text-xs opacity-90">{preview.error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="cf-btn cf-btn-secondary mt-3 rounded-xl px-3 py-1.5 text-xs"
                >
                  Retry
                </button>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- preview content uses runtime signed URLs and zoom transforms.
              <img
                src={preview.url}
                alt={preview.filename}
                className="max-h-full max-w-full object-contain transition-transform duration-100"
                style={{ transform: `scale(${preview.zoom})`, transformOrigin: "center center" }}
                onError={onImageError}
              />
            )}
          </div>
        </PreviewErrorBoundary>
      </div>
    </div>
  );
}
