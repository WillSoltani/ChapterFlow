/**
 * The Memory Palace reel — ordered films for the landing.
 * Shot list + render spec: docs/MEMORY_PALACE_SHOTLIST.md
 *
 *   palace-00  The Fold          a page folds into a doorway; camera pushes through   (hero)
 *   palace-01  Hall of Summary   corridor of text pages compress to a few lit lines   (01 Summary)
 *   palace-02  Rooms of Example  three paper dioramas; camera peeks into each         (02 Examples)
 *   palace-03  The Vault         a lit line slots into a door; it folds into a book   (03 Quiz)
 *   palace-04  The Lights        camera rises; rooms light on the 1·4·12·36 rhythm    (04 Spaced review)
 *   palace-05  The City          aerial orbit: 135 towers faced with real covers      (library)
 *   palace-06  Home              descend to one lit window; lamp warms over the book  (close)
 */

import { manifest } from "./timeline";
import type { FilmManifest } from "./types";

export const BOOK_REEL: FilmManifest[] = [
  manifest("palace-00"),
  manifest("palace-01"),
  manifest("palace-02"),
  manifest("palace-03"),
  manifest("palace-04"),
  manifest("palace-05"),
  manifest("palace-06"),
];
