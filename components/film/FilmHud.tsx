"use client";

/**
 * Dev frame counter. Renders only when the URL has ?hud=1 (read after mount,
 * so the page stays statically renderable and the server HTML never changes).
 */

import { useSyncExternalStore } from "react";
import type { FilmStats } from "./frame-cache";
import { useReel } from "./reel-context";

const noop = () => () => {};
const readHudFlag = () => new URLSearchParams(window.location.search).get("hud") === "1";

export function FilmHud() {
  // Server snapshot is always false → SSR/hydration agree; the real flag is
  // read on the client without a setState-in-effect.
  const on = useSyncExternalStore(noop, readHudFlag, () => false);
  return on ? <FilmHudInner /> : null;
}

/** Second HUD line: exact-draw share, refetches, mean distance per draw, fetches in flight. */
function statsLine(s: FilmStats): string {
  const draws = s.exactDraws + s.fallbackDraws;
  const exact = draws ? Math.round((100 * s.exactDraws) / draws) : 100;
  const dist = draws ? s.fallbackDistanceSum / draws : 0;
  return `exact ${exact}% · refetch ${s.refetches} · dist ${dist.toFixed(1)} · fetch ${s.fetchInFlight}/${s.fetchLimit}`;
}

function FilmHudInner() {
  const reel = useReel();
  const snap = useSyncExternalStore(
    reel.subscribeDrawn,
    () => `${reel.drawnSegment()}:${reel.drawnFrame()}|${statsLine(reel.stats)}`,
    () => "-1:-1|",
  );
  const [pos = "", stats = ""] = snap.split("|");
  const [seg = -1, frame = -1] = pos.split(":").map(Number);
  const film = reel.reel[seg];
  return (
    <div className="film-hud" aria-hidden>
      {film ? `${film.name} · f${String(frame + 1).padStart(4, "0")}` : "reel idle"} · {reel.orientation}
      {stats ? <span className="film-hud-stats">{stats}</span> : null}
    </div>
  );
}
