import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("the shared public shell owns the single navigation and footer", () => {
  const shell = source("components/marketing/PublicSiteShell.tsx");

  assert.match(shell, /import \{ RecallNav \}/);
  assert.match(shell, /import \{ Footer \}/);
  assert.match(shell, /landing-dark cf-public-site/);
  assert.doesNotMatch(shell, /href="#main"|Skip to main content/);
  assert.equal((shell.match(/<RecallNav\b/g) ?? []).length, 1);
  assert.equal((shell.match(/<Footer\b/g) ?? []).length, 1);
});

test("every owner route uses the shell and owns one focusable main landmark", () => {
  for (const path of [
    "app/page.tsx",
    "app/pricing/page.tsx",
    "app/books/page.tsx",
    "app/contact/page.tsx",
    "app/legal/layout.tsx",
  ]) {
    const route = source(path);
    assert.match(route, /<PublicSiteShell\b/, `${path} must mount the public shell`);
    assert.equal(
      (route.match(/<main\b/g) ?? []).length,
      1,
      `${path} must own exactly one main landmark`,
    );
    assert.match(route, /<main[^>]*id="main"[^>]*tabIndex=\{-1\}/);
    assert.doesNotMatch(route, /<RecallNav\b|<Footer\b/);
  }
});

test("every route masthead or hero owns a post-hero CTA boundary", () => {
  const home = source("app/page.tsx");
  const catalog = source("components/website/BrowseLibraryPage.tsx");
  const pricing = source("app/pricing/page.tsx");
  const contact = source("app/contact/page.tsx");
  const legal = source("app/legal/layout.tsx");

  assert.match(home, /<RecallHeroSplit\s*\/>\s*<div[^>]*data-public-hero-end/);
  assert.match(catalog, /<BrowseLibraryHero[\s\S]*?\/>\s*<div[^>]*data-public-hero-end/);
  for (const route of [pricing, contact, legal]) {
    assert.match(route, /<PublicMasthead[\s\S]*?\/>\s*<div[^>]*data-public-hero-end/);
  }
  assert.match(home, /import \{ RecallClose \}/);
  assert.match(home, /<RecallClose\s*\/>/);
  assert.doesNotMatch(home, /function RecallFinalCta/);
});

test("equivalent public CTA zones suppress the persistent header action", () => {
  const catalog = source("components/website/BrowseLibraryPage.tsx");
  const close = source("components/landing/recall/RecallClose.tsx");
  const homePricing = source("components/landing/recall/RecallPricing.tsx");
  const routePricing = source("components/sections/Pricing.tsx");
  const footer = source("components/sections/Footer.tsx");
  const nav = source("components/landing/recall/RecallNav.tsx");

  for (const [label, content] of [
    ["catalog", catalog],
    ["home close", close],
    ["home pricing", homePricing],
    ["pricing route", routePricing],
    ["shared footer", footer],
  ] as const) {
    assert.match(
      content,
      /data-public-sticky-cta-suppress/,
      `${label} must yield the persistent action while its own CTA is visible`,
    );
  }
  assert.match(nav, /\[data-public-sticky-cta-suppress\]/);
});

test("pricing preserves a client island without internal spec-sheet jargon", () => {
  const route = source("app/pricing/page.tsx");
  const pricing = source("components/sections/Pricing.tsx");

  assert.match(route, /<Pricing\s*\/>/);
  assert.match(route, /cf-paper-folio/);
  assert.doesNotMatch(route, /PricingPageClient/);
  assert.doesNotMatch(pricing, /§05|CF-FREE|CF-PRO|SPEC v1\.0/);
  assert.doesNotMatch(pricing, />\s*Footnotes\s*</);
  assert.match(pricing, /min-h-11/);
});

test("books, contact, and legal documents use intentional paper surfaces", () => {
  const catalog = source("components/website/BrowseLibraryPage.tsx");
  const contact = source("app/contact/page.tsx");
  const legalLayout = source("app/legal/layout.tsx");

  assert.match(catalog, /cf-paper-folio/);
  assert.doesNotMatch(catalog, /components\/sections\/(Navbar|Footer)/);
  assert.match(contact, /<PublicMasthead\b/);
  assert.match(contact, /cf-paper-folio/);
  assert.match(legalLayout, /<PublicMasthead\b/);
  assert.match(legalLayout, /cf-paper-folio/);
});

test("the legal hub links every existing policy and support", () => {
  const legalHub = source("app/legal/page.tsx");
  const requiredLinks = [
    "/legal/terms",
    "/legal/privacy",
    "/legal/refund",
    "/legal/cookies",
    "/legal/copyright",
    "/legal/data-rights",
  ];

  for (const href of requiredLinks) {
    assert.ok(legalHub.includes(`href: "${href}"`), `legal hub must define ${href}`);
  }
  assert.match(legalHub, /<Link\s+href=\{policy\.href\}/);
  assert.match(legalHub, /mailto:/);
  assert.equal((legalHub.match(/<main\b/g) ?? []).length, 0);
});

test("cookie inventories stack on phones and retain a fixed desktop table", () => {
  const cookies = source("app/legal/cookies/page.tsx");

  assert.match(cookies, /<dl[^>]*className="[^"]*sm:hidden[^"]*"/);
  assert.match(cookies, /<table[^>]*className="[^"]*table-fixed[^"]*sm:table[^"]*"/);
  assert.match(cookies, />\s*Duration\s*</);
  assert.doesNotMatch(cookies, /overflow-x-auto/);
});
