"use client";

/**
 * palace-01 Hall of Summary · palace-02 Rooms of Example · palace-03 The Vault
 * The four-step loop, as rooms of the palace.
 *
 * Every copy column sits inside a `scrim` FramePin whose range is the union of
 * the pins it holds, so the halo / box gradient fades with the words instead
 * of lingering as a dark shape over the footage.
 */

import { CATALOG_MEDIAN_CHAPTER_MINUTES } from "@/lib/catalog-stats";
import { FilmSegment } from "../FilmSegment";
import { FramePin } from "../FramePin";
import { HallText } from "../HallText";
import { filmCount, key } from "../timeline";
import type { FilmManifest } from "../types";

type P = { film: FilmManifest; index: number };

export function HallChapter({ film, index }: P) {
  const F = "palace-01";
  const last = filmCount(F) - 1;
  const dense = key(F, "walls_dense");
  const compress = key(F, "compress");
  const lit = key(F, "lines_lit");
  return (
    <FilmSegment id="how-it-works" film={film} index={index} pace={3.5} dissolveIn={14} ariaLabel="Summary">
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
        <FramePin scrim from={dense} to={last} hold className="film-halo flex flex-col items-center gap-4 text-center">
          <FramePin from={dense} to={last} hold as="p" className="film-label">
            01 · Summary
          </FramePin>
          <FramePin from={compress} to={last} hold as="h2" className="film-h2">
            The whole book, down to the lines that matter.
          </FramePin>
          <FramePin from={lit} to={last} hold as="p" className="film-lede">
            Atomic Habits, chapter one, in about {CATALOG_MEDIAN_CHAPTER_MINUTES} minutes. The walls go
            quiet, and what stays lit is the idea.
          </FramePin>
        </FramePin>
      </div>
    </FilmSegment>
  );
}

export function RoomsChapter({ film, index }: P) {
  const F = "palace-02";
  const last = filmCount(F) - 1;
  const turn = key(F, "turn");
  const a = key(F, "room_a");
  const b = key(F, "room_b");
  const c = key(F, "room_c");
  const door = key(F, "door_ahead");
  return (
    <FilmSegment id="examples" film={film} index={index} pace={3.5} dissolveIn={14} ariaLabel="Examples">
      <div className="film-stage-grid" data-split="left">
        <FramePin scrim from={turn} to={door} className="film-box flex flex-col gap-4">
          <FramePin from={turn} to={door} as="p" className="film-label">
            02 · Examples · Atomic Habits
          </FramePin>
          <FramePin from={a - 10} to={door} as="h2" className="film-h2">
            Watch each idea play out somewhere real.
          </FramePin>
          <FramePin from={a} to={b - 8} as="p" className="film-lede">
            A glass of water by the bed: the cue that makes the habit obvious.
          </FramePin>
          <FramePin from={b} to={c - 8} as="p" className="film-lede">
            Running shoes by the front door: the environment doing the deciding for you.
          </FramePin>
          <FramePin from={c} to={door} as="p" className="film-lede">
            A coat on the hook by the door: the two-minute version of the thing you keep postponing.
          </FramePin>
        </FramePin>
      </div>
      <div className="film-stage-grid" data-anchor="bottom">
        <FramePin from={door - 20} to={last} hold ease={12} as="p" className="film-label">
          A door. No handle.
        </FramePin>
      </div>
    </FilmSegment>
  );
}

export function VaultChapter({ film, index }: P) {
  const F = "palace-03";
  const last = filmCount(F) - 1;
  const doorKey = key(F, "door");
  const approach = key(F, "line_approach");
  const lock = key(F, "line_lock");
  const pulse = key(F, "pulse");
  const folds = key(F, "door_folds");
  const fold = key(F, "fold_to_book");
  return (
    <FilmSegment id="quiz" film={film} index={index} pace={3} dissolveIn={14} ariaLabel="Quiz">
      <div className="film-stage-grid" data-split="left">
        <FramePin scrim from={doorKey} to={fold} className="film-box flex flex-col gap-4">
          <FramePin from={doorKey} to={fold} as="p" className="film-label">03 · Quiz</FramePin>
          <FramePin from={approach} to={fold} as="h2" className="film-h2">
            Recall is the key.
          </FramePin>
          <FramePin from={lock} to={fold} as="p" className="film-lede">
            A short quiz after every chapter, answered from memory before you look back. That small
            effort is the testing effect, and it is what locks the idea in.
          </FramePin>
        </FramePin>
      </div>
      <div className="film-stage-grid" data-anchor="bottom">
        {/* "Locked." holds from the pulse while the door stands shut, and is
            gone once the door starts folding itself into a book (`door_folds`). */}
        <FramePin from={pulse} to={folds - 2} ease={6} as="p" className="film-label">
          Locked.
        </FramePin>
        {/* The door folds down from the top (P03_FOLD insert, f160–280); the
            closed book resolves over `fold_to_book`→+14. Rise with the book. */}
        <FramePin from={fold + 6} to={last} hold ease={14} y={10} as="p" className="film-label">
          One book. Kept.
        </FramePin>
      </div>
    </FilmSegment>
  );
}
