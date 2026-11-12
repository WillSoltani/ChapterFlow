"use client";

/**
 * palace-04 The Lights · palace-05 The City · palace-06 Home
 * Spaced review, the library skyline, and the close.
 *
 * Copy columns sit inside `scrim` FramePins (see HallChapters) so their
 * gradients fade with the words.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";
import { FilmSegment } from "../FilmSegment";
import { FramePin } from "../FramePin";
import { pin, reducedStops } from "../pins";
import { filmCount, filmKeys, key } from "../timeline";
import type { FilmManifest } from "../types";

type P = { film: FilmManifest; index: number };

/*
 * Each chapter's pin timings live in one object: the JSX and the
 * reduced-motion stops (pins.ts reducedStops) read the same values.
 */

const LIGHTS = (() => {
  const F = "palace-04";
  const last = filmCount(F) - 1;
  const floors = key(F, "floors");
  const l1 = key(F, "light_1");
  const l4 = key(F, "light_4");
  const l12 = key(F, "light_12");
  const l36 = key(F, "light_36");
  const p = {
    box: pin(floors, last, { hold: true }),
    label: pin(floors, last, { hold: true }),
    h2: pin(l1 - 10, last, { hold: true }),
    lede: pin(l4, last, { hold: true }),
    alone: pin(key(F, "lift"), l1 - 6, { ease: 8 }),
    day1: pin(l1, l4 - 4, { ease: 4 }),
    day4: pin(l4, l12 - 4, { ease: 4 }),
    day12: pin(l12, l36 - 4, { ease: 4 }),
    day36: pin(l36, last, { ease: 4, hold: true }),
  };
  const tree = [{ scrim: p.box, pins: [p.label, p.h2, p.lede] }, p.alone, p.day1, p.day4, p.day12, p.day36];
  const dissolve = 14;
  return { p, dissolve, stops: reducedStops(filmCount(F), filmKeys(F), tree, { start: dissolve }) };
})();

export function LightsChapter({ film, index }: P) {
  const { p } = LIGHTS;
  return (
    <FilmSegment id="why-it-works" film={film} index={index} pace={4} dissolveIn={LIGHTS.dissolve} stops={LIGHTS.stops} ariaLabel="Spaced review">
      {/* The tower render is centred; its LEFT side is the darker face. */}
      <div className="film-stage-grid" data-split="left">
        <FramePin scrim {...p.box} className="film-box flex flex-col gap-4">
          <FramePin {...p.label} as="p" className="film-label">04 · Spaced review</FramePin>
          <FramePin {...p.h2} as="h2" className="film-h2">
            It finds you again, right before you would forget.
          </FramePin>
          <FramePin {...p.lede} as="p" className="film-lede">
            FSRS-5 predicts the moment an idea is about to go dark and brings it back right then.
            Never more review than you need.
          </FramePin>
        </FramePin>
      </div>
      {/* Review-day ticks ride the lighting beats. Before the first light, the
          kept book sits alone in a dark room: that is the problem spaced review
          solves, so say it there and let the tower answer it. */}
      <div className="film-stage-grid" data-anchor="bottom">
        <FramePin {...p.alone} as="p" className="film-label">
          Left alone, even a kept book fades.
        </FramePin>
        <FramePin {...p.day1} as="p" className="film-label">Day 1 · one room lit</FramePin>
        <FramePin {...p.day4} as="p" className="film-label">Day 4 · four rooms lit</FramePin>
        <FramePin {...p.day12} as="p" className="film-label">Day 12 · twelve rooms lit</FramePin>
        <FramePin {...p.day36} as="p" className="film-label">Day 36 · the tower stays lit</FramePin>
      </div>
    </FilmSegment>
  );
}

/** The public catalog: Next's default prefetch, logged in or not. */
function BrowseBooksLink() {
  return (
    <Link href="/books" className="film-btn film-btn-ghost">
      Browse all {CATALOG_BOOK_COUNT_DISPLAY} books <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

const CITY = (() => {
  const F = "palace-05";
  const last = filmCount(F) - 1;
  const skyline = key(F, "skyline");
  const orbit = key(F, "orbit");
  const p = {
    halo: pin(skyline, last, { hold: true }),
    label: pin(skyline, last, { hold: true }),
    h2: pin(skyline + 8, last, { hold: true }),
    browse: pin(orbit, last, { hold: true }),
  };
  const dissolve = 14;
  return { p, dissolve, stops: reducedStops(filmCount(F), filmKeys(F), [{ scrim: p.halo, pins: [p.label, p.h2, p.browse] }], { start: dissolve }) };
})();

export function CityChapter({ film, index }: P) {
  const { p } = CITY;
  return (
    <FilmSegment id="library" film={film} index={index} pace={3} dissolveIn={CITY.dissolve} stops={CITY.stops} ariaLabel="Library">
      {/* Dense halo (globals.css): a bright frame behind the copy (contrast gate). */}
      <div className="film-stage-grid" data-split="center" data-halo="dense">
        <FramePin scrim {...p.halo} className="film-halo flex flex-col items-center gap-4">
          <FramePin {...p.label} as="p" className="film-label">The library</FramePin>
          <FramePin {...p.h2} as="h2" className="film-h2">
            {CATALOG_BOOK_COUNT_DISPLAY} books. Every one a building.
          </FramePin>
          <FramePin {...p.browse} interactive>
            <BrowseBooksLink />
          </FramePin>
        </FramePin>
      </div>
    </FilmSegment>
  );
}

const HOME = (() => {
  const F = "palace-06";
  const last = filmCount(F) - 1;
  const window_ = key(F, "window");
  const warm = key(F, "lamp_warm");
  const p = {
    halo: pin(window_, last, { hold: true }),
    h2: pin(window_, last, { hold: true }),
    start: pin(warm, last, { hold: true }),
  };
  const dissolve = 12;
  return { p, dissolve, stops: reducedStops(filmCount(F), filmKeys(F), [{ scrim: p.halo, pins: [p.h2, p.start] }], { start: dissolve }) };
})();

export function HomeChapter({ film, index }: P) {
  const { p } = HOME;
  return (
    <FilmSegment id="home" film={film} index={index} pace={2.2} dissolveIn={HOME.dissolve} stops={HOME.stops} ariaLabel="Start free">
      {/* Dense halo (globals.css): a bright frame behind the copy (contrast gate). */}
      <div className="film-stage-grid" data-split="center" data-halo="dense">
        <FramePin scrim {...p.halo} className="film-halo flex flex-col items-center gap-6">
          {/* The body's RecallClose says "Read it once. Keep it for good." —
              this beat gets its own line so the two never repeat back to back. */}
          <FramePin {...p.h2} as="h2" className="film-h1">
            Finish the book.
            <br />
            Keep the ideas.
          </FramePin>
          {/* The Home chapter's own start button: the nav's is suppressed
              while it shows (startCta). "Start free" like every start button
              on the page but one: "Start your first book" is the closing
              section's (RecallClose), once. */}
          <FramePin {...p.start} interactive startCta="chapter">
            {/* External (Cognito) URL: plain <a>, see FoldChapter. */}
            <a href={AUTH_LOGIN_BOOK_URL} className="film-btn film-btn-primary">
              Start free <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
            </a>
          </FramePin>
        </FramePin>
      </div>
    </FilmSegment>
  );
}
