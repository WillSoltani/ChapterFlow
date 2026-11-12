import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PUBLIC_NAV_DESKTOP_QUERY,
  PUBLIC_NAV_LINKS,
  PUBLIC_NAV_MENU_ID,
  gatedRoutePrefetchProps,
  isPublicNavCurrent,
  parseNavLook,
  publicNavHref,
  publicNavPrefetchProps,
  shouldRenderPersistentCta,
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

test("public nav links prefetch: /books is public, so every nav route keeps Next's default", () => {
  // /books is the public catalog (middleware gate by whole segment), so the
  // nav prefetches it like /pricing, logged in or not.
  for (const link of PUBLIC_NAV_LINKS) {
    assert.deepEqual(publicNavPrefetchProps(link, false), {}, link.id);
    assert.deepEqual(publicNavPrefetchProps(link, true), {}, link.id);
  }
});

test("gatedRoutePrefetchProps: no prefetch into a sign-in redirect, Next's default otherwise", () => {
  // Public routes: default prefetch.
  for (const href of ["/books", "/books?q=habit", "/pricing", "/legal/terms", "/contact", "/#how-it-works"]) {
    assert.deepEqual(gatedRoutePrefetchProps(href), {}, href);
  }
  // Protected surfaces redirect a logged-out visitor to /auth/login and on to
  // Cognito (another origin): a prefetch trips CSP connect-src 'self'.
  for (const href of ["/book", "/book/library/atomic-habits", "/book/settings?upgrade=1", "/dashboard", "/app"]) {
    assert.deepEqual(gatedRoutePrefetchProps(href), { prefetch: false }, href);
    assert.deepEqual(gatedRoutePrefetchProps(href, false), { prefetch: false }, href);
    // Logged in, the route renders: Next's default prefetch.
    assert.deepEqual(gatedRoutePrefetchProps(href, true), {}, href);
  }
  // The auth routes themselves redirect to Cognito for everyone: never prefetched.
  for (const href of ["/auth/login?returnTo=%2Fbook", "/auth/logout"]) {
    assert.deepEqual(gatedRoutePrefetchProps(href), { prefetch: false }, href);
    assert.deepEqual(gatedRoutePrefetchProps(href, true), { prefetch: false }, href);
  }
});

test("parseNavLook: ?nav=1…5 picks the touch nav look over the film, default 1", () => {
  assert.equal(parseNavLook(""), 1);
  assert.equal(parseNavLook("?nav=3"), 3);
  assert.equal(parseNavLook("?hud=1&nav=5"), 5);
  assert.equal(parseNavLook("?nav=0"), 1);
  assert.equal(parseNavLook("?nav=6"), 1);
  assert.equal(parseNavLook("?nav=2.5"), 1);
});

test("a page whose hero carries its own start button (the film landing) shows the nav's as soon as that button is not shown", () => {
  const base = { hasSentinel: true, sentinelTop: 640, headerBottom: 88 };
  // The hero's button is shown: it is the start button on screen (a suppression zone).
  assert.equal(shouldShowPersistentCta({ ...base, suppressionVisible: true, hasHeroCta: true }), false);
  // It has faded (or scrolled away): the nav's shows, long before the hero-end sentinel.
  assert.equal(shouldShowPersistentCta({ ...base, suppressionVisible: false, hasHeroCta: true }), true);
  // Pages without a hero start button keep the sentinel rule.
  assert.equal(shouldShowPersistentCta({ ...base, suppressionVisible: false, hasHeroCta: false }), false);
  assert.equal(shouldShowPersistentCta({ ...base, suppressionVisible: false }), false);
});

test("the persistent start button renders while the session is unresolved only where the hero has its own start button", () => {
  // Phase 7 review: on the film landing the nav's button replaces the hero's
  // once it fades; a session endpoint left unresolved (useAuthStatus keeps
  // loading on repeated 5xx) must not leave the visitor with none.
  assert.equal(shouldRenderPersistentCta({ show: true, authResolved: false, hasHeroCta: true, mobileOpen: false }), true);
  // Other public pages (pricing, contact, legal, books) keep waiting for the session.
  assert.equal(shouldRenderPersistentCta({ show: true, authResolved: false, hasHeroCta: false, mobileOpen: false }), false);
  assert.equal(shouldRenderPersistentCta({ show: true, authResolved: true, hasHeroCta: false, mobileOpen: false }), true);
  // Never when hidden by the model, nor under the open mobile menu.
  assert.equal(shouldRenderPersistentCta({ show: false, authResolved: true, hasHeroCta: true, mobileOpen: false }), false);
  assert.equal(shouldRenderPersistentCta({ show: true, authResolved: true, hasHeroCta: true, mobileOpen: true }), false);
});
