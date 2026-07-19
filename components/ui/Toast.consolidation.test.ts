import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Toast } from "./Toast";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

test("canonical Toast exposes the shared polite status contract", () => {
  const html = renderToStaticMarkup(
    React.createElement(Toast, {
      open: true,
      message: "Saved",
      tone: "success",
      autoDismissMs: 0,
    }),
  );

  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-atomic="true"/);
});

test("legacy Card and Toast implementations are removed", () => {
  for (const path of [
    "app/book/components/ui/Card.tsx",
    "app/book/components/ui/Toast.tsx",
    "app/book/settings/components/SaveToast.tsx",
  ]) {
    assert.equal(existsSync(resolve(root, path)), false, `${path} must be deleted`);
  }
});

test("all local toast state routes through the canonical view and controller", () => {
  const controller = source("hooks/book/useToast.ts");
  assert.match(controller, /from "@\/components\/ui\/Toast"/);
  assert.match(controller, /export function useToast/);

  const routeShim = source("app/book/hooks/useToast.ts");
  assert.match(routeShim, /^export \{ useToast \} from "@\/hooks\/book\/useToast";\n$/);

  for (const path of [
    "app/book/settings/BookSettingsClient.tsx",
    "components/library/LibraryPage.tsx",
    "app/book/profile/BookProfileClient.tsx",
    "app/book/saved/SavedBooksClient.tsx",
  ]) {
    const contents = source(path);
    assert.doesNotMatch(contents, /@\/app\/book\/components\/ui\/Toast/);
    assert.match(contents, /@\/components\/ui\/Toast/);
    assert.match(contents, /useToast/);
  }

  const settings = source("app/book/settings/BookSettingsClient.tsx");
  assert.doesNotMatch(settings, /SaveToast|useSaveToast|triggerToast/);
  assert.match(settings, /showSavedToast/);
  assert.match(settings, /showToast\("Saved", "success"/);

  const library = source("components/library/LibraryPage.tsx");
  assert.doesNotMatch(library, /function CelebrationToast/);
  assert.match(library, /@\/hooks\/book\/useToast/);
  assert.doesNotMatch(library, /@\/app\/book\//);
});

test("Card consumers preserve the exact inlined base class contract", () => {
  const badgeCards = source("app/book/badges/components/BadgeSystemCards.tsx");
  const profile = source("app/book/profile/components/ProfilePrimitives.tsx");

  assert.doesNotMatch(badgeCards, /components\/ui\/Card/);
  assert.doesNotMatch(profile, /components\/ui\/Card/);
  assert.doesNotMatch(badgeCards, /className="cf-panel rounded-3xl p-5"/);
  assert.equal(
    badgeCards.match(/cf-panel rounded-3xl p-5/g)?.length,
    3,
    "all three badge Card sites must inline the base contract",
  );
  assert.match(profile, /cn\(\s*"cf-panel rounded-3xl p-5"/);
});
