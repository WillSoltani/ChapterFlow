"use client";

/**
 * Dev frame counter. Renders only when the URL has ?hud=1 (read after mount,
 * so the page stays statically renderable and the server HTML never changes).
 */

import { useSyncExternalStore } from "react";
import { useReel } from "./reel-context";

const noop = () => () => {};
const readHudFlag = () => new URLSearchParams(window.location.search).get("hud") === "1";

export function FilmHud() {
  // Server snapshot is always false → SSR/hydration agree; the real flag is
  // read on the client without a setState-in-effect.
  const on = useSyncExternalStore(noop, readHudFlag, () => false);
  return on ? <FilmHudInner /> : null;
}

function FilmHudInner() {
  const reel = useReel();
  const snap = useSyncExternalStore(
    reel.subscribeDrawn,
    () => `${reel.drawnSegment()}:${reel.drawnFrame()}`,
    () => "-1:-1",
  );
  const [seg = -1, frame = -1] = snap.split(":").map(Number);
  const film = reel.reel[seg];
  return (
    <div className="film-hud" aria-hidden>
      {film ? `${film.name} · f${String(frame + 1).padStart(4, "0")}` : "reel idle"} · {reel.orientation}
    </div>
  );
}
