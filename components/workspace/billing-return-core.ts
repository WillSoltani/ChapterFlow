// ACCT-17 + DATA-17: after a Stripe checkout the webhook that turns the plan
// to Pro can land a few seconds after the reader is back on Home. Re-read the
// plan at fixed times until it says Pro, then stop; never claim Pro before.

/** When each re-read runs, in ms after the reader lands back on Home. */
export const BILLING_TRY_AT_MS = [1500, 3000, 5000] as const;

/** activating: re-reading · active: plan is Pro · pending: still Free after the last try. */
export type BillingReturnStatus = "activating" | "active" | "pending";

export function billingReturnKind(value: string | null): "success" | "cancelled" | null {
  return value === "success" || value === "cancelled" ? value : null;
}

type TimerHandle = unknown;

/**
 * Starts the re-reads. `check` resolves true once the plan is Pro (a failed
 * read counts as not yet). Returns a stop function: after it, no timer is left
 * and no status is reported, even for a read already in flight.
 */
export function startBillingReturnPoll({
  check,
  onStatus,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: {
  check: () => Promise<boolean>;
  onStatus: (status: BillingReturnStatus) => void;
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}): () => void {
  let stopped = false;
  let timer: TimerHandle | null = null;

  const schedule = (attempt: number) => {
    const previousAt = attempt === 0 ? 0 : BILLING_TRY_AT_MS[attempt - 1]!;
    timer = setTimer(() => {
      timer = null;
      void tryOnce(attempt);
    }, BILLING_TRY_AT_MS[attempt]! - previousAt);
  };

  const tryOnce = async (attempt: number) => {
    if (stopped) return;
    const isPro = await check().catch(() => false);
    if (stopped) return;
    if (isPro) {
      onStatus("active");
    } else if (attempt + 1 < BILLING_TRY_AT_MS.length) {
      schedule(attempt + 1);
    } else {
      onStatus("pending");
    }
  };

  onStatus("activating");
  schedule(0);

  return () => {
    stopped = true;
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
}
