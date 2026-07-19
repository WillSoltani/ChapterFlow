import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PUBLIC_NAV_DESKTOP_QUERY,
  PUBLIC_NAV_LINKS,
  PUBLIC_NAV_MENU_ID,
  isPublicNavCurrent,
  publicNavHref,
  shouldShowPersistentCta,
} from "./RecallNavModel";

test("public navigation exposes the approved Recall information architecture", () => {
  assert.deepEqual(
    PUBLIC_NAV_LINKS.map(({ label, kind, target }) => ({ label, kind, target })),
    [
      { label: "How it works", kind: "section", target: "how-it-works" },
      { label: "Why it works", kind: "section", target: "why-it-works" },
      { label: "Books", kind: "route", target: "/books" },
      { label: "Pricing", kind: "route", target: "/pricing" },
      { label: "Support", kind: "route", target: "/contact" },
    ],
  );
});

test("section links stay local on home and return to home from public routes", () => {
  const how = PUBLIC_NAV_LINKS[0];
  const why = PUBLIC_NAV_LINKS[1];

  assert.equal(publicNavHref("/", how), "#how-it-works");
  assert.equal(publicNavHref("/pricing", how), "/#how-it-works");
  assert.equal(publicNavHref("/", why), "#why-it-works");
  assert.equal(publicNavHref("/legal/privacy", why), "/#why-it-works");
});

test("route current-state matching is exact and descendant aware", () => {
  assert.equal(isPublicNavCurrent("/books", "/books"), true);
  assert.equal(isPublicNavCurrent("/books/featured", "/books"), true);
  assert.equal(isPublicNavCurrent("/bookshelf", "/books"), false);
  assert.equal(isPublicNavCurrent("/pricing", "/pricing"), true);
  assert.equal(isPublicNavCurrent("/pricing-preview", "/pricing"), false);
  assert.equal(isPublicNavCurrent("/contact", "/contact"), true);
  assert.equal(isPublicNavCurrent("/legal", "/contact"), false);
  assert.equal(isPublicNavCurrent("/", "/books"), false);
});

test("the persistent CTA appears only after the hero boundary, or immediately without one", () => {
  assert.equal(
    shouldShowPersistentCta({
      hasSentinel: false,
      sentinelTop: null,
      headerBottom: 88,
      suppressionVisible: false,
    }),
    true,
  );
  assert.equal(
    shouldShowPersistentCta({
      hasSentinel: true,
      sentinelTop: 640,
      headerBottom: 88,
      suppressionVisible: false,
    }),
    false,
  );
  assert.equal(
    shouldShowPersistentCta({
      hasSentinel: true,
      sentinelTop: 89,
      headerBottom: 88,
      suppressionVisible: false,
    }),
    false,
  );
  assert.equal(
    shouldShowPersistentCta({
      hasSentinel: true,
      sentinelTop: 88,
      headerBottom: 88,
      suppressionVisible: false,
    }),
    true,
  );
  assert.equal(
    shouldShowPersistentCta({
      hasSentinel: true,
      sentinelTop: -1,
      headerBottom: 88,
      suppressionVisible: false,
    }),
    true,
  );
  assert.equal(
    shouldShowPersistentCta({
      hasSentinel: true,
      sentinelTop: -1,
      headerBottom: 88,
      suppressionVisible: true,
    }),
    false,
    "an in-view page CTA must suppress the persistent header CTA",
  );
});

test("the public menu owns one stable id and the 1024px navigation breakpoint", () => {
  assert.equal(PUBLIC_NAV_MENU_ID, "chapterflow-public-navigation");
  assert.equal(PUBLIC_NAV_DESKTOP_QUERY, "(min-width: 1024px)");
});
