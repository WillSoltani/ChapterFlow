import "./_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useOnboardingState } from "@/hooks/book/useOnboardingState";

// ACCT-03 / C10: the daily goal has a 5-minute floor, so the "5 min · Light"
// choice offered in Settings and onboarding is kept as 5, not raised to 10.

globalThis.fetch = (async () =>
  new Response(JSON.stringify({ onboardingCompleted: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;

const router = {
  push() {},
  replace() {},
  refresh() {},
  back() {},
  forward() {},
  prefetch() {},
} as unknown as AppRouterInstance;

function wrapper({ children }: { children: ReactNode }) {
  return <AppRouterContext.Provider value={router}>{children}</AppRouterContext.Provider>;
}

const STORAGE_KEY = "book-accelerator:onboarding:v5";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

test("a stored 5-minute goal is read back as 5", async () => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ setupComplete: true, currentStep: 4, dailyGoalMinutes: 5 }),
  );
  const { result } = renderHook(() => useOnboardingState(), { wrapper });
  await act(async () => {});
  assert.equal(result.current.state.dailyGoalMinutes, 5);
});

test("choosing 5 minutes keeps 5; anything lower stops at 5", async () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ setupComplete: true, currentStep: 4 }));
  const { result } = renderHook(() => useOnboardingState(), { wrapper });
  await act(async () => {});

  act(() => result.current.setDailyGoalMinutes(5));
  assert.equal(result.current.state.dailyGoalMinutes, 5);

  act(() => result.current.setDailyGoalMinutes(2));
  assert.equal(result.current.state.dailyGoalMinutes, 5);

  act(() => result.current.patchState({ dailyGoalMinutes: 5 }));
  assert.equal(result.current.state.dailyGoalMinutes, 5);
});
