"use client";

/**
 * palace-01 Hall of Summary · palace-02 Rooms of Example · palace-03 The Vault
 * The four-step loop, as rooms of the palace.
 *
 * Every copy column sits inside a `scrim` FramePin whose range is the union of
 * the pins it holds, so the halo / box gradient fades with the words instead
 * of lingering as a dark shape over the footage.
 */

import { FilmSegment } from "../FilmSegment";
import { FramePin } from "../FramePin";
import { HallText } from "../HallText";
import { pin, reducedStops } from "../pins";
import { filmCount, filmKeys, key } from "../timeline";
import type { FilmManifest } from "../types";

type P = { film: FilmManifest; index: number };

/*
 * Each chapter's pin timings live in one object: the JSX and the
 * reduced-motion stops (pins.ts reducedStops) read the same values.
 */

const HALL = (() => {
  const F = "palace-01";
  const last = filmCount(F) - 1;
  const dense = key(F, "walls_dense");
  const compress = key(F, "compress");
  const lit = key(F, "lines_lit");
  const p = {
    halo: pin(dense, last, { hold: true }),
    label: pin(dense, last, { hold: true }),
    h2: pin(compress, last, { hold: true }),
    lede: pin(lit, last, { hold: true }),
  };
  const dissolve = 14;
  return { last, compress, lit, p, dissolve, stops: reducedStops(filmCount(F), filmKeys(F), [{ scrim: p.halo, pins: [p.label, p.h2, p.lede] }], { start: dissolve }) };
})();

/**
 * The Hall names one chapter of one book, so `minutes` is that chapter's own
 * reading time (app/_lib/chapter-minutes, read on the server by app/page.tsx), not
 * the catalog median. Null drops the number (the book left the catalog).
 */
export function HallChapter({ film, index, minutes = null }: P & { minutes?: number | null }) {
  const { last, compress, lit, p } = HALL;
  return (
    <FilmSegment id="how-it-works" film={film} index={index} pace={3.5} dissolveIn={HALL.dissolve} stops={HALL.stops} ariaLabel="Summary">
      {/* The corridor walls are blank cotton-rag in the footage; the real
          English prose on them (Atomic Habits, chapter 1, from the live
          package) is this CSS layer. */}
      <HallText compress={compress} litAt={lit} end={last} />
      {/* The corridor render is one-point perspective: both walls are bright,
          the vanishing point in the CENTRE is the darkest part of the frame.
          Copy sits there, centred, on a halo — reading "down the corridor".
          On narrow screens (`data-hall`) the block drops to the lower third so
          it never collides with the wall prose above it. */}
      <div className="film-stage-grid" data-split="center" data-hall="">
        <FramePin scrim {...p.halo} className="film-halo flex flex-col items-center gap-4 text-center">
          <FramePin {...p.label} as="p" className="film-label">
            01 · Summary
          </FramePin>
          <FramePin {...p.h2} as="h2" className="film-h2">
            The whole book, down to the lines that matter.
          </FramePin>
          <FramePin {...p.lede} as="p" className="film-lede">
            Atomic Habits, chapter one{minutes === null ? "" : `, in about ${minutes} minutes`}. The walls go
            quiet, and what stays lit is the idea.
          </FramePin>
        </FramePin>
      </div>
    </FilmSegment>
  );
}

const ROOMS = (() => {
  const F = "palace-02";
  const last = filmCount(F) - 1;
  const turn = key(F, "turn");
  const a = key(F, "room_a");
  const b = key(F, "room_b");
  const c = key(F, "room_c");
  const door = key(F, "door_ahead");
  const p = {
    box: pin(turn, door),
    label: pin(turn, door),
    h2: pin(a - 10, door),
    ledeA: pin(a, b - 8),
    ledeB: pin(b, c - 8),
    ledeC: pin(c, door),
    door: pin(door - 20, last, { ease: 12, hold: true }),
  };
  const tree = [{ scrim: p.box, pins: [p.label, p.h2, p.ledeA, p.ledeB, p.ledeC] }, p.door];
  const dissolve = 14;
  return { p, dissolve, stops: reducedStops(filmCount(F), filmKeys(F), tree, { start: dissolve }) };
})();

export function RoomsChapter({ film, index }: P) {
  const { p } = ROOMS;
  return (
    <FilmSegment id="examples" film={film} index={index} pace={3.5} dissolveIn={ROOMS.dissolve} stops={ROOMS.stops} ariaLabel="Examples">
      <div className="film-stage-grid" data-split="left">
        <FramePin scrim {...p.box} className="film-box flex flex-col gap-4">
          <FramePin {...p.label} as="p" className="film-label">
            02 · Examples · Atomic Habits
          </FramePin>
          <FramePin {...p.h2} as="h2" className="film-h2">
            Watch each idea play out somewhere real.
          </FramePin>
          <FramePin {...p.ledeA} as="p" className="film-lede">
            A glass of water by the bed: the cue that makes the habit obvious.
          </FramePin>
          <FramePin {...p.ledeB} as="p" className="film-lede">
            Running shoes by the front door: the environment doing the deciding for you.
          </FramePin>
          <FramePin {...p.ledeC} as="p" className="film-lede">
            A coat on the hook by the door: the two-minute version of the thing you keep postponing.
          </FramePin>
        </FramePin>
      </div>
      <div className="film-stage-grid" data-anchor="bottom">
        <FramePin {...p.door} as="p" className="film-label">
          A door. No handle.
        </FramePin>
      </div>
    </FilmSegment>
  );
}

const VAULT = (() => {
  const F = "palace-03";
  const last = filmCount(F) - 1;
  const doorKey = key(F, "door");
  const approach = key(F, "line_approach");
  const lock = key(F, "line_lock");
  const pulse = key(F, "pulse");
  const folds = key(F, "door_folds");
  const fold = key(F, "fold_to_book");
  const p = {
    box: pin(doorKey, fold),
    label: pin(doorKey, fold),
    h2: pin(approach, fold),
    lede: pin(lock, fold),
    locked: pin(pulse, folds - 2, { ease: 6 }),
    kept: pin(fold + 6, last, { ease: 14, hold: true }),
  };
  const tree = [{ scrim: p.box, pins: [p.label, p.h2, p.lede] }, p.locked, p.kept];
  const dissolve = 14;
  return { p, dissolve, stops: reducedStops(filmCount(F), filmKeys(F), tree, { start: dissolve }) };
})();

export function VaultChapter({ film, index }: P) {
  const { p } = VAULT;
  return (
    <FilmSegment id="quiz" film={film} index={index} pace={3} dissolveIn={VAULT.dissolve} stops={VAULT.stops} ariaLabel="Quiz">
      <div className="film-stage-grid" data-split="left">
        <FramePin scrim {...p.box} className="film-box flex flex-col gap-4">
          <FramePin {...p.label} as="p" className="film-label">03 · Quiz</FramePin>
          <FramePin {...p.h2} as="h2" className="film-h2">
            Recall is the key.
          </FramePin>
          <FramePin {...p.lede} as="p" className="film-lede">
            A short quiz after every chapter, answered from memory before you look back. That small
            effort is the testing effect, and it is what locks the idea in.
          </FramePin>
        </FramePin>
      </div>
      <div className="film-stage-grid" data-anchor="bottom">
        {/* "Locked." holds from the pulse while the door stands shut, and is
            gone once the door starts folding itself into a book (`door_folds`). */}
        <FramePin {...p.locked} as="p" className="film-label">
          Locked.
        </FramePin>
        {/* The door folds down from the top (P03_FOLD insert, f160–280); the
            closed book resolves over `fold_to_book`→+14. Rise with the book. */}
        <FramePin {...p.kept} y={10} as="p" className="film-label">
          One book. Kept.
        </FramePin>
      </div>
    </FilmSegment>
  );
}
