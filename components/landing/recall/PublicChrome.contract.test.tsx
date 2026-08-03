import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { Footer } from "@/components/sections/Footer";
import { RecallClose } from "./RecallClose";

const source = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("RecallNav owns the shared skip link and accessible fullscreen mobile dialog", () => {
  const nav = source("components/landing/recall/RecallNav.tsx");

  assert.match(nav, /^"use client";/);
  assert.match(nav, /href="#main"/);
  assert.match(nav, />\s*Skip to main content\s*</);
  assert.match(nav, /<Dialog[\s\S]*size="fullscreen"[\s\S]*className="[^"]*landing-dark[^"]*"/);
  assert.match(nav, /initialFocusRef=\{closeButtonRef\}/);
  assert.match(nav, /aria-haspopup="dialog"/);
  assert.match(nav, /aria-expanded=\{mobileOpen\}/);
  assert.match(nav, /aria-controls=\{PUBLIC_NAV_MENU_ID\}/);
  assert.match(nav, /className="[^"]*h-11 w-11[^"]*"/);
  assert.match(nav, /data-public-hero-end/);
  assert.match(nav, /PUBLIC_NAV_DESKTOP_QUERY/);
  assert.match(nav, /aria-current=\{current \? "page" : undefined\}/);
  assert.match(nav, /data-public-current-marker/);
  assert.doesNotMatch(nav, /accent-cyan|SPEC v1\.0|§\d/);
});

test("the canonical footer uses Recall links, legal hub coverage, and mobile touch rows", () => {
  const html = renderToStaticMarkup(createElement(Footer));

  for (const href of [
    "/#how-it-works",
    "/#why-it-works",
    "/books",
    "/pricing",
    "/contact",
    "/legal",
    "/legal/terms",
    "/legal/privacy",
    "/legal/refund",
    "/legal/cookies",
    "/legal/copyright",
    "/legal/data-rights",
  ]) {
    assert.match(html, new RegExp(`href="${href.replaceAll("/", "\\/")}"`));
  }

  assert.match(html, /landing-dark/);
  assert.match(html, /min-h-11/);
  assert.match(html, /Guided reading that makes what you read last/);
  assert.match(html, /Research foundations/);
  assert.match(html, /Ebbinghaus 1885/);
  assert.match(html, /Karpicke &amp; Roediger, Science 2008/);
  assert.match(html, /Cepeda et al\. 2006/);
  assert.match(html, /FSRS-5 spaced repetition/);
  assert.doesNotMatch(html, /accent-cyan|SPEC v1\.0|§\d|>Manual</);
});

test("RecallClose is only the closing CTA section and no longer owns a footer", () => {
  const close = source("components/landing/recall/RecallClose.tsx");
  const html = renderToStaticMarkup(createElement(RecallClose));

  assert.match(close, /return \(\s*<section/);
  assert.doesNotMatch(close, /<footer|SECTION_LINKS|LEGAL_LINKS|CHAPTERFLOW_NAME/);
  assert.match(html, /^<section/);
  assert.doesNotMatch(html, /<footer/);
  assert.match(html, /Read it once\. Keep it for good\./);
  assert.match(html, /min-h-11/);
});
