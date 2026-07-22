// Lightweight analytics shim. No-ops unless NEXT_PUBLIC_ANALYTICS_ID is set
// AND a provider is wired up. Call sites stay stable across providers.

type EventProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    __cfAnalyticsQueue?: Array<{ event: string; props?: EventProps; ts: number }>;
  }
}

export function track(event: string, props?: EventProps): void {
  if (typeof window === "undefined") return;
  try {
    const queue = (window.__cfAnalyticsQueue ||= []);
    queue.push({ event, ts: Date.now(), ...(props !== undefined ? { props } : {}) });
    // Cap queue to avoid unbounded growth before a provider drains it.
    if (queue.length > 200) queue.splice(0, queue.length - 200);
  } catch {
    // swallow — analytics must never break the app
  }
}
