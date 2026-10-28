"use client";

/** palace-00 — The Pop-up Book. A closed book opens, a paper tower rises from the gutter, the camera pushes into its doorway. HERO. */

import { ArrowRight, ChevronRight } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { FREE_OFFER_LABEL } from "@/lib/pricing";
import { CATALOG_BOOK_COUNT, CATALOG_MEDIAN_CHAPTER_MINUTES } from "@/lib/catalog-stats";
import { FilmSegment } from "../FilmSegment";
import { FramePin } from "../FramePin";
import { filmCount, key } from "../timeline";
import type { FilmManifest } from "../types";

const F = "palace-00";

export function FoldChapter({ film, index }: { film: FilmManifest; index: number }) {
  const last = filmCount(F) - 1;
  const book = key(F, "book");
  const doorway = key(F, "doorway");
  const pushIn = key(F, "push_in");

  return (
    <FilmSegment id="hero" film={film} index={index} pace={4} breath={0.012} ariaLabel="Stop forgetting what you read">
      {/* The book, then the tower, sit CENTRED in the render, so the hero stacks
          over them: headline above the object, lede + CTAs below, both with a
          halo scrim. Once the camera pushes into the doorway (push_in) the copy
          clears the frame — and so do the halos (scrim pins). */}
      <div className="film-stage-grid" data-split="center" data-stack="hero">
        <FramePin scrim from={book} to={pushIn} ease={10} className="film-halo flex flex-col items-center gap-3 text-center">
          <FramePin from={book} to={pushIn} ease={8} as="p" className="film-label">
            For people who read to remember
          </FramePin>
          <FramePin from={book} to={pushIn} ease={10} as="h1" className="film-h1">
            Stop forgetting what you read.
          </FramePin>
        </FramePin>
        <FramePin scrim from={book} to={pushIn} ease={10} className="film-halo flex flex-col items-center gap-4 text-center">
          <FramePin from={book} to={pushIn} ease={10} as="p" className="film-lede">
            Every chapter becomes a {CATALOG_MEDIAN_CHAPTER_MINUTES}-minute read, a quick quiz, and a
            review that comes back right before you would forget.
          </FramePin>
          <FramePin from={book} to={pushIn} ease={10} interactive className="flex flex-wrap items-center justify-center gap-4">
            {/* External (Cognito) URL: a plain <a>, like every other auth CTA on
                the public site — a Next <Link> would try to prefetch it and
                trip CSP connect-src 'self' in the console. */}
            <a href={AUTH_LOGIN_BOOK_URL} className="film-btn film-btn-primary">
              Start reading free <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
            </a>
            <a href="#how-it-works" className="film-btn film-btn-ghost">
              Step inside <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
            </a>
          </FramePin>
          <FramePin from={doorway - 30} to={pushIn} ease={10} as="p" className="film-label">
            No card · {FREE_OFFER_LABEL} · {CATALOG_BOOK_COUNT} titles
          </FramePin>
        </FramePin>
      </div>
      {/* Through the doorway: a single beat of mono text in the dark. */}
      <div className="film-stage-grid" data-anchor="bottom">
        <FramePin from={pushIn + 20} to={last} hold ease={12} as="p" className="film-label">
          Every book is a building. Step inside.
        </FramePin>
      </div>
    </FilmSegment>
  );
}
