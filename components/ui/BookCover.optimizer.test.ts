import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getBookCoverImageProps,
  getBookCoverSourceCandidates,
} from "@/lib/use-book-cover-source";
import { BookCover } from "./BookCover";

const LOCAL_OPTIMIZER_PATH = "/_next/image?url=%2Fbook-covers%2Fatomic-habits.avif";

function assertUsesLocalOptimizer(html: string, branch: string): void {
  assert.match(
    html,
    /<img[^>]+srcSet="\/_next\/image\?url=%2Fbook-covers%2Fatomic-habits\.avif/,
    `${branch} must route its local raster through the Next image optimizer`,
  );
  assert.ok(html.includes(LOCAL_OPTIMIZER_PATH), `${branch} is missing the optimized local src`);
  assert.ok(!html.includes('src="/book-covers/atomic-habits.avif"'), `${branch} bypassed optimization`);
}

test("embedded BookCover sends its local AVIF through /_next/image", () => {
  const html = renderToStaticMarkup(
    createElement(BookCover, {
      bookId: "atomic-habits",
      title: "Atomic Habits",
      coverGradient: "linear-gradient(#111, #333)",
      fill: true,
      sizes: "120px",
    }),
  );

  assertUsesLocalOptimizer(html, "embedded branch");
});

test("tile BookCover sends its local AVIF through /_next/image", () => {
  const html = renderToStaticMarkup(
    createElement(BookCover, {
      bookId: "atomic-habits",
      title: "Atomic Habits",
      icon: "📘",
      sizes: "120px",
    }),
  );

  assertUsesLocalOptimizer(html, "tile branch");
});

test("only an external HTTP(S) fallback bypasses the optimizer", () => {
  assert.deepEqual(getBookCoverImageProps("/book-covers/atomic-habits.avif"), {});
  assert.deepEqual(getBookCoverImageProps(undefined), {});

  const remote = "https://chapterflow-covers.s3.amazonaws.com/atomic-habits.svg";
  const props = getBookCoverImageProps(remote);
  assert.equal(props.unoptimized, true);
  assert.equal(props.loader?.({ src: remote }), remote);
});

test("candidate fallback order keeps local AVIF/WebP first and remote last", () => {
  const remote = "https://chapterflow-covers.s3.amazonaws.com/atomic-habits.svg";
  const candidates = getBookCoverSourceCandidates("atomic-habits", remote);

  assert.deepEqual(candidates.slice(0, 2), [
    "/book-covers/atomic-habits.avif",
    "/book-covers/atomic-habits.webp",
  ]);
  assert.equal(candidates.at(-1), remote);
  assert.equal(candidates.filter((candidate) => candidate === remote).length, 1);

  const existingLocal = "/book-covers/atomic-habits.webp";
  const deduped = getBookCoverSourceCandidates("atomic-habits", existingLocal);
  assert.equal(deduped.at(1), existingLocal);
  assert.equal(deduped.filter((candidate) => candidate === existingLocal).length, 1);
});

test("catalog titles without committed rasters render their fallback immediately", () => {
  for (const bookId of [
    "behave",
    "decisive",
    "multipliers",
    "the-first-90-days",
    "the-now-habit",
  ]) {
    assert.deepEqual(
      getBookCoverSourceCandidates(bookId, `/book-covers/${bookId}.webp`),
      [],
    );
  }

  const html = renderToStaticMarkup(
    createElement(BookCover, {
      bookId: "behave",
      title: "Behave",
      icon: "📘",
    }),
  );
  assert.doesNotMatch(html, /<img\b/);
  assert.match(html, /Behave/);
});
