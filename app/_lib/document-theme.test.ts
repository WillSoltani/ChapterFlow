import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocumentThemeBootstrapScript, isWithinDarkWindow } from "./document-theme";

// SET-8 / D3: scheduled night mode applies app-wide. The window math lives in
// exactly one place (isWithinDarkWindow) and is mirrored, character for
// character, by the inline bootstrap string. These tests lock both so the
// app-wide path can never silently diverge from the reader effect in
// app/book/hooks/useBookPreferences.ts.

// Only getHours/getMinutes are consumed by the window math.
function at(hours: number, minutes: number): Date {
  return { getHours: () => hours, getMinutes: () => minutes } as unknown as Date;
}

test("isWithinDarkWindow: same-day window 06:00→22:00 (start inclusive, end exclusive)", () => {
  assert.equal(isWithinDarkWindow("06:00", "22:00", at(12, 0)), true);
  assert.equal(isWithinDarkWindow("06:00", "22:00", at(5, 59)), false);
  assert.equal(isWithinDarkWindow("06:00", "22:00", at(6, 0)), true); // start inclusive
  assert.equal(isWithinDarkWindow("06:00", "22:00", at(22, 0)), false); // end exclusive
  assert.equal(isWithinDarkWindow("06:00", "22:00", at(23, 30)), false);
});

test("isWithinDarkWindow: wrap-around window 20:00→07:00 across midnight", () => {
  assert.equal(isWithinDarkWindow("20:00", "07:00", at(22, 0)), true); // after start
  assert.equal(isWithinDarkWindow("20:00", "07:00", at(2, 0)), true); // before end (next day)
  assert.equal(isWithinDarkWindow("20:00", "07:00", at(20, 0)), true); // start inclusive
  assert.equal(isWithinDarkWindow("20:00", "07:00", at(7, 0)), false); // end exclusive
  assert.equal(isWithinDarkWindow("20:00", "07:00", at(12, 0)), false); // midday outside
  assert.equal(isWithinDarkWindow("20:00", "07:00", at(19, 59)), false);
});

test("isWithinDarkWindow: malformed times resolve to false (no override)", () => {
  assert.equal(isWithinDarkWindow("not-a-time", "07:00", at(2, 0)), false);
  assert.equal(isWithinDarkWindow("20:00", "", at(22, 0)), false);
  assert.equal(isWithinDarkWindow("", "", at(22, 0)), false);
});

// --- Bootstrap string: execute the SHIPPED IIFE against stubs + a fixed clock ---

type RootStub = {
  classList: { toggle(name: string, force?: boolean): void; contains(name: string): boolean };
  style: Record<string, string>;
  dataset: Record<string, string>;
};

function runBootstrap(
  payload: unknown,
  opts: { hours: number; minutes: number; systemDark?: boolean }
): { dark: boolean; colorScheme: string } {
  const classes = new Set<string>();
  const root: RootStub = {
    classList: {
      toggle(name: string, force?: boolean) {
        const shouldAdd = force === undefined ? !classes.has(name) : force;
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
      },
      contains: (name: string) => classes.has(name),
    },
    style: {},
    dataset: {},
  };
  const documentStub = { documentElement: root };
  const windowStub = { matchMedia: () => ({ matches: opts.systemDark === true }) };
  const localStorageStub = { getItem: () => JSON.stringify(payload) };
  class FakeDate {
    getHours() {
      return opts.hours;
    }
    getMinutes() {
      return opts.minutes;
    }
  }
  const script = buildDocumentThemeBootstrapScript();
  // The bootstrap is a self-contained IIFE that reads document/window/
  // localStorage and `new Date()` from its enclosing scope. Injecting them as
  // params exercises the real shipped string with a fixed clock.
  const fn = new Function("document", "window", "localStorage", "Date", script);
  fn(documentStub, windowStub, localStorageStub, FakeDate);
  return { dark: classes.has("dark"), colorScheme: root.style.colorScheme };
}

const scheduled = (theme: string, over: Record<string, unknown> = {}) => ({
  appearance: { theme },
  extended: { scheduledDarkMode: true, darkModeFrom: "20:00", darkModeTo: "07:00", ...over },
});

test("bootstrap string is valid JS and references the schedule fields", () => {
  const script = buildDocumentThemeBootstrapScript();
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /scheduledDarkMode/);
  assert.match(script, /darkModeFrom/);
  assert.match(script, /darkModeTo/);
});

test("bootstrap: in-window → dark on first paint (base light)", () => {
  const r = runBootstrap(scheduled("light"), { hours: 22, minutes: 0 });
  assert.equal(r.dark, true);
  assert.equal(r.colorScheme, "dark");
});

test("bootstrap: out-of-window → reverts to base light", () => {
  const r = runBootstrap(scheduled("light"), { hours: 12, minutes: 0 });
  assert.equal(r.dark, false);
  assert.equal(r.colorScheme, "light");
});

test("bootstrap: permanent-dark theme ignores schedule (stays dark out-of-window)", () => {
  const r = runBootstrap(scheduled("dark"), { hours: 12, minutes: 0 });
  assert.equal(r.dark, true);
});

test("bootstrap: system theme — active schedule window controls .dark", () => {
  const inWindow = runBootstrap(scheduled("system"), { hours: 23, minutes: 0, systemDark: false });
  assert.equal(inWindow.dark, true); // window forces dark even though system prefers light
  const outWindow = runBootstrap(scheduled("system"), { hours: 12, minutes: 0, systemDark: false });
  assert.equal(outWindow.dark, false); // outside window reverts (matches reader)
});

test("bootstrap: schedule off → base theme honored, no override", () => {
  const r = runBootstrap(scheduled("light", { scheduledDarkMode: false }), { hours: 23, minutes: 0 });
  assert.equal(r.dark, false);
});

test("bootstrap: schedule on but times missing → guarded, no theme blanking", () => {
  const r = runBootstrap(
    { appearance: { theme: "light" }, extended: { scheduledDarkMode: true } },
    { hours: 23, minutes: 0 }
  );
  assert.equal(r.dark, false);
  assert.equal(r.colorScheme, "light");
});
