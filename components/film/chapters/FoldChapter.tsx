"use client";

/** palace-00 — The Pop-up Book. A closed book opens, a paper tower rises from the gutter, the camera pushes into its doorway. HERO. */

import { ArrowRight, ChevronRight } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { FREE_OFFER_LABEL } from "@/lib/pricing";
import { CATALOG_BOOK_COUNT, CATALOG_MEDIAN_CHAPTER_MINUTES } from "@/lib/catalog-stats";
import { FilmSegment } from "../FilmSegment";
import { SkipFilmLink } from "../SkipFilmLink";
import { FramePin } from "../FramePin";
import { pin, reducedStops } from "../pins";
import { filmCount, filmKeys, key } from "../timeline";
import type { FilmManifest } from "../types";

const F = "palace-00";
const last = filmCount(F) - 1;
const book = key(F, "book");
const doorway = key(F, "doorway");
const pushIn = key(F, "push_in");

/** Every pin's timing; the JSX below and the reduced-motion stops read the same values. */
const P = {
  headHalo: pin(book, pushIn, { ease: 10 }),
  label: pin(book, pushIn, { ease: 8 }),
  h1: pin(book, pushIn, { ease: 10 }),
  footHalo: pin(book, pushIn, { ease: 10 }),
  lede: pin(book, pushIn, { ease: 10 }),
  ctas: pin(book, pushIn, { ease: 10 }),
  noCard: pin(doorway - 30, pushIn, { ease: 10 }),
  through: pin(pushIn + 20, last, { ease: 12, hold: true }),
};
const STOPS = reducedStops(filmCount(F), filmKeys(F), [
  { scrim: P.headHalo, pins: [P.label, P.h1] },
  { scrim: P.footHalo, pins: [P.lede, P.ctas, P.noCard] },
  P.through,
]);

export function FoldChapter({ film, index }: { film: FilmManifest; index: number }) {
  return (
    <FilmSegment id="hero" film={film} index={index} pace={4} breath={0.012} stops={STOPS} ariaLabel="Stop forgetting what you read">
      {/* The book, then the tower, sit CENTRED in the render, so the hero stacks
          over them: headline above the object, lede + CTAs below, both with a
          halo scrim. Once the camera pushes into the doorway (push_in) the copy
          clears the frame — and so do the halos (scrim pins). */}
      <div className="film-stage-grid" data-split="center" data-stack="hero">
        <FramePin scrim {...P.headHalo} className="film-halo flex flex-col items-center gap-3 text-center">
          <FramePin {...P.label} as="p" className="film-label">
            For people who read to remember
          </FramePin>
          <FramePin {...P.h1} as="h1" className="film-h1">
            Stop forgetting what you read.
          </FramePin>
        </FramePin>
        <FramePin scrim {...P.footHalo} className="film-halo flex flex-col items-center gap-4 text-center">
          <FramePin {...P.lede} as="p" className="film-lede">
            Every chapter becomes a {CATALOG_MEDIAN_CHAPTER_MINUTES}-minute read, a quick quiz, and a
            review that comes back right before you would forget.
          </FramePin>
          {/* The hero's start button: while it shows, the nav's persistent
              one stays hidden; once it fades the nav's takes over
              (startCta). Its halo fades on the same curve, so it shows at
              o²: the switch is at o = √½, where the button is at one half. */}
          <FramePin {...P.ctas} interactive startCta="hero" ctaOnAt={Math.SQRT1_2} className="flex flex-wrap items-center justify-center gap-4">
            {/* External (Cognito) URL: a plain <a>, like every other auth CTA on
                the public site — a Next <Link> would try to prefetch it and
                trip CSP connect-src 'self' in the console. */}
            <a href={AUTH_LOGIN_BOOK_URL} className="film-btn film-btn-primary">
              Start reading free <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
            </a>
            <a href="#how-it-works" className="film-btn film-btn-ghost">
              Step inside <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
            </a>
            {/* Reduced motion only (globals.css): the way past the film, in view. */}
            <SkipFilmLink className="film-btn film-btn-ghost film-skip-reduced" />
          </FramePin>
          <FramePin {...P.noCard} as="p" className="film-label">
            No card · {FREE_OFFER_LABEL} · {CATALOG_BOOK_COUNT} titles
          </FramePin>
        </FramePin>
      </div>
      {/* Through the doorway: a single beat of mono text in the dark. */}
      <div className="film-stage-grid" data-anchor="bottom">
        <FramePin {...P.through} as="p" className="film-label">
          Every book is a building. Step inside.
        </FramePin>
      </div>
    </FilmSegment>
  );
}
