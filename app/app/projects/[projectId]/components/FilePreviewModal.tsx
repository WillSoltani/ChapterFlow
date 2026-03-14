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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-black/30 p-6 text-center">
          <p className="text-sm font-semibold text-rose-200">Preview failed to render.</p>
          <p className="max-w-md text-xs text-slate-400">
            Close and reopen preview. If this continues, refresh the page and try again.
          </p>
          <button
            type="button"
            onClick={this.props.onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${preview.filename}`}
      onClick={onClose}
    >
      <div
        className="flex h-[92dvh] w-full max-w-6xl flex-col rounded-2xl border border-white/15 bg-slate-950/95 shadow-[0_20px_70px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">{preview.filename}</div>
            <div className="text-xs text-slate-400">Format: {preview.format}</div>
          </div>
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              type="button"
              onClick={onZoomOut}
              disabled={preview.loading || Boolean(preview.error)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-slate-200 hover:bg-white/10 disabled:opacity-40"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <div className="w-14 text-center text-xs font-semibold text-slate-300">
              {Math.round(preview.zoom * 100)}%
            </div>
            <button
              type="button"
              onClick={onZoomIn}
              disabled={preview.loading || Boolean(preview.error)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-slate-200 hover:bg-white/10 disabled:opacity-40"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-slate-200 hover:bg-white/10"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <PreviewErrorBoundary onClose={onClose}>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/30 p-2 sm:p-4">
            {preview.loading ? (
              <div className="flex flex-col items-center gap-3 text-slate-300">
                <Loader2 className="h-6 w-6 animate-spin" />
                <div className="text-sm">Loading preview…</div>
              </div>
            ) : preview.error ? (
              <div className="mx-auto max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center">
                <p className="text-sm font-semibold text-rose-200">Could not load preview.</p>
                <p className="mt-1 text-xs text-rose-100/80">{preview.error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
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
