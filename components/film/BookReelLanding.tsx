"use client";

/**
 * BookReelLanding — the film-reel landing composition (preview at /film).
 *
 * Six FilmSegments over one FilmBackdrop. Copy is pinned to NAMED keyframes
 * from book.timeline.json via FramePin, so re-rendering the film only means
 * editing the JSON. `afterHero` is mounted between the hero chapter and the
 * next (the public-chrome post-hero sentinel lives there); `body` is ordinary
 * flowing content (FAQ, request form, pricing table) mounted after the last
 * scrub. Its wrapper is "Skip the film"'s target (#after-film, focusable by
 * script only).
 */

import type { ReactNode } from "react";
import type { FrameAmount } from "./scrub";
import { FilmBackdrop } from "./FilmBackdrop";
import { FilmHud } from "./FilmHud";
import { BOOK_REEL } from "./book-reel";
import { FoldChapter } from "./chapters/FoldChapter";
import { HallChapter, RoomsChapter, VaultChapter } from "./chapters/HallChapters";
import { CityChapter, HomeChapter, LightsChapter } from "./chapters/CityChapters";
import { AFTER_FILM_ID } from "./SkipFilmLink";

export function BookReelLanding({ afterHero, body, frameAmount }: { afterHero?: ReactNode; body?: ReactNode; frameAmount?: FrameAmount }) {
  // noUncheckedIndexedAccess: BOOK_REEL is a plain array; a missing manifest is
  // a build-time mistake (book-reel.ts), not a runtime state to render around.
  const film = (i: number) => {
    const f = BOOK_REEL[i];
    if (!f) throw new Error(`BOOK_REEL has no film at index ${i}`);
    return f;
  };
  const [f0, f1, f2, f3, f4, f5, f6] = [film(0), film(1), film(2), film(3), film(4), film(5), film(6)] as const;
  return (
    <FilmBackdrop reel={BOOK_REEL} {...(frameAmount !== undefined ? { frameAmount } : {})}>
      <FilmHud />
      <FoldChapter film={f0} index={0} />
      {afterHero}
      <HallChapter film={f1} index={1} />
      <RoomsChapter film={f2} index={2} />
      <VaultChapter film={f3} index={3} />
      <LightsChapter film={f4} index={4} />
      <CityChapter film={f5} index={5} />
      <HomeChapter film={f6} index={6} />
      {body ? (
        <div data-film-body="" id={AFTER_FILM_ID} tabIndex={-1} className="relative z-10 focus:outline-none">
          {body}
        </div>
      ) : null}
    </FilmBackdrop>
  );
}
