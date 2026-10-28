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
import { CATALOG_BOOK_COUNT } from "@/lib/catalog-stats";
import { FilmSegment } from "../FilmSegment";
import { FramePin } from "../FramePin";
import { filmCount, key } from "../timeline";
import type { FilmManifest } from "../types";

type P = { film: FilmManifest; index: number };

export function LightsChapter({ film, index }: P) {
  const F = "palace-04";
  const last = filmCount(F) - 1;
  const floors = key(F, "floors");
  const l1 = key(F, "light_1");
  const l4 = key(F, "light_4");
  const l12 = key(F, "light_12");
  const l36 = key(F, "light_36");
  return (
    <FilmSegment id="why-it-works" film={film} index={index} pace={4} dissolveIn={14} ariaLabel="Spaced review">
      {/* The tower render is centred; its LEFT side is the darker face. */}
      <div className="film-stage-grid" data-split="left">
        <FramePin scrim from={floors} to={last} hold className="film-box flex flex-col gap-4">
          <FramePin from={floors} to={last} hold as="p" className="film-label">04 · Spaced review</FramePin>
          <FramePin from={l1 - 10} to={last} hold as="h2" className="film-h2">
            It finds you again, right before you would forget.
          </FramePin>
          <FramePin from={l4} to={last} hold as="p" className="film-lede">
            FSRS-5 predicts the moment an idea is about to go dark and brings it back right then.
            Never more review than you need.
          </FramePin>
        </FramePin>
      </div>
      {/* Review-day ticks ride the lighting beats. Before the first light, the
          kept book sits alone in a dark room: that is the problem spaced review
          solves, so say it there and let the tower answer it. */}
      <div className="film-stage-grid" data-anchor="bottom">
        <FramePin from={key(F, "lift")} to={l1 - 6} ease={8} as="p" className="film-label">
          Left alone, even a kept book fades.
        </FramePin>
        <FramePin from={l1} to={l4 - 4} ease={4} as="p" className="film-label">Day 1 · one room lit</FramePin>
        <FramePin from={l4} to={l12 - 4} ease={4} as="p" className="film-label">Day 4 · four rooms lit</FramePin>
        <FramePin from={l12} to={l36 - 4} ease={4} as="p" className="film-label">Day 12 · twelve rooms lit</FramePin>
        <FramePin from={l36} to={last} hold ease={4} as="p" className="film-label">Day 36 · the tower stays lit</FramePin>
      </div>
    </FilmSegment>
  );
}

export function CityChapter({ film, index }: P) {
  const F = "palace-05";
  const last = filmCount(F) - 1;
  const skyline = key(F, "skyline");
  const orbit = key(F, "orbit");
  return (
    <FilmSegment id="library" film={film} index={index} pace={3} dissolveIn={14} ariaLabel="Library">
      <div className="film-stage-grid" data-split="center">
        <FramePin scrim from={skyline} to={last} hold className="film-halo flex flex-col items-center gap-4">
          <FramePin from={skyline} to={last} hold as="p" className="film-label">The library</FramePin>
          <FramePin from={skyline + 8} to={last} hold as="h2" className="film-h2">
            {CATALOG_BOOK_COUNT} books. Every one a building.
          </FramePin>
          <FramePin from={orbit} to={last} hold interactive>
            <Link href="/books" className="film-btn film-btn-ghost">
              Browse all {CATALOG_BOOK_COUNT} books <ArrowRight size={16} aria-hidden />
            </Link>
          </FramePin>
        </FramePin>
      </div>
    </FilmSegment>
  );
}

export function HomeChapter({ film, index }: P) {
  const F = "palace-06";
  const last = filmCount(F) - 1;
  const window_ = key(F, "window");
  const warm = key(F, "lamp_warm");
  return (
    <FilmSegment id="home" film={film} index={index} pace={2.2} dissolveIn={12} ariaLabel="Start free">
      <div className="film-stage-grid" data-split="center">
        <FramePin scrim from={window_} to={last} hold className="film-halo flex flex-col items-center gap-6">
          {/* The body's RecallClose says "Read it once. Keep it for good." —
              this beat gets its own line so the two never repeat back to back. */}
          <FramePin from={window_} to={last} hold as="h2" className="film-h1">
            Finish the book.
            <br />
            Keep the ideas.
          </FramePin>
          <FramePin from={warm} to={last} hold interactive>
            {/* External (Cognito) URL: plain <a>, see FoldChapter. */}
            <a href={AUTH_LOGIN_BOOK_URL} className="film-btn film-btn-primary">
              Start your first book <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
            </a>
          </FramePin>
        </FramePin>
      </div>
    </FilmSegment>
  );
}
