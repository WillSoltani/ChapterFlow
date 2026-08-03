import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, afterEach, test } from "node:test";
import {
  createElement,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

const phaseTimerId = 987_654 as unknown as ReturnType<typeof setTimeout>;
let scheduledPhaseAdvance: (() => void) | null = null;

const MotionDiv = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
  }
>(function MotionDiv(props, ref) {
  const domProps = { ...props };
  delete domProps.initial;
  delete domProps.animate;
  delete domProps.exit;
  delete domProps.transition;
  return createElement("div", { ...domProps, ref });
});

const mockModules: Record<string, unknown> = {
  "framer-motion": {
    m: { div: MotionDiv },
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    useReducedMotion: () => false,
    useInView: () => true,
  },
  "@/components/reader/PhaseStepper": {
    PhaseStepper: () => createElement("nav", { "aria-label": "Learning phases" }),
  },
  "@/components/reader/SummaryCard": {
    SummaryCard: () =>
      createElement("button", { type: "button" }, "Focused summary control"),
  },
  "@/components/reader/ExamplesList": {
    ExamplesList: () => createElement("p", null, "Examples phase content"),
  },
  "@/components/reader/PracticePhase": {
    PracticePhase: () => createElement("p", null, "Practice phase content"),
  },
  "@/components/reader/ContinueButton": {
    ContinueButton: () => createElement("button", { type: "button" }, "Continue"),
  },
  "./AppWindowChrome": {
    AppWindowChrome: () => null,
  },
  "./MobileAppChrome": {
    MobileAppChrome: () => null,
  },
  "./DesktopQuizPanel": {
    DesktopQuizPanel: () => createElement("p", null, "Quiz phase content"),
  },
};

Module._load = function patchedLoad(request, parent, isMain) {
  if (request in mockModules) return mockModules[request];
  return originalLoad.call(this, request, parent, isMain);
};

globalThis.setTimeout = ((
  ...parameters: Parameters<typeof setTimeout>
) => {
  const [callback, delay, ...args] = parameters;
  if (delay === 12_000 || delay === 14_000) {
    scheduledPhaseAdvance = () => callback(...args);
    return phaseTimerId;
  }
  return originalSetTimeout(...parameters);
}) as typeof setTimeout;

globalThis.clearTimeout = ((timer) => {
  if (timer === phaseTimerId) {
    scheduledPhaseAdvance = null;
    return;
  }
  originalClearTimeout(timer);
}) as typeof clearTimeout;

function runScheduledPhaseAdvance() {
  const advance = scheduledPhaseAdvance;
  scheduledPhaseAdvance = null;
  advance?.();
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  scheduledPhaseAdvance = null;
});

after(() => {
  Module._load = originalLoad;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

test("focus within the demo pauses phase replacement and leaving resumes a fresh dwell", async () => {
  const { DesktopReaderShell } = await import("./DesktopReaderShell");
  const view = render(<DesktopReaderShell />);

  const summaryControl = view.getByRole("button", {
    name: "Focused summary control",
  });
  await waitFor(() => assert.ok(scheduledPhaseAdvance));

  act(() => summaryControl.focus());
  await waitFor(() => {
    assert.equal(document.activeElement, summaryControl);
    assert.equal(scheduledPhaseAdvance, null);
  });

  act(() => runScheduledPhaseAdvance());
  assert.ok(view.getByRole("button", { name: "Focused summary control" }));
  assert.equal(document.activeElement, summaryControl);

  const secondDemoControl = view.getByRole("button", { name: "Continue" });
  act(() => secondDemoControl.focus());
  await waitFor(() => {
    assert.equal(document.activeElement, secondDemoControl);
    assert.equal(scheduledPhaseAdvance, null);
  });

  const outsideControl = document.createElement("button");
  outsideControl.type = "button";
  outsideControl.textContent = "Outside the demo";
  document.body.appendChild(outsideControl);
  act(() => outsideControl.focus());

  await waitFor(() => {
    assert.equal(document.activeElement, outsideControl);
    assert.ok(scheduledPhaseAdvance);
  });

  act(() => runScheduledPhaseAdvance());
  assert.ok(view.getByText("Examples phase content"));
  assert.equal(document.activeElement, outsideControl);
});
