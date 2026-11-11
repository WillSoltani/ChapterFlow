/**
 * PackClient — the page side of the film worker (film-worker.ts): the
 * PackSource the frame scheduler (FrameBudget) uses in pack mode.
 *
 *   • Starts the worker lazily, on the first scroll decision (never at
 *     import, never during server render), with the bundler's standard form
 *     `new Worker(new URL("./film-worker.ts", import.meta.url), { type: "module" })`.
 *   • Tells the worker where the visitor is: the active film's pack, the
 *     playhead, the direction, the wanted window, the dissolve pin (the
 *     previous film's last frame) while it is wanted, whether the visitor has
 *     scrolled yet (a scroll position above 0, a #anchor, or an active film
 *     past the first, read on every decision until one holds; never during
 *     render, where scrollY can still be the previous page's), whether the
 *     document is hidden and whether the connection is constrained
 *     (Save-Data, slow-2g/2g/3g).
 *   • Mirrors which frames the worker holds, so the scheduler knows
 *     synchronously what is decodable; asks the worker to decode and gets the
 *     ImageBitmap back (transferred).
 *   • Fallback: a variant whose pack fails (404, unusable, retries spent)
 *     goes to the per-frame path (a reel sent again keeps it in its place,
 *     marked failed, so the worker never reads it again and the films
 *     around it keep their neighbours); if the worker cannot start, lacks
 *     createImageBitmap or a streaming fetch body, or crashes, every variant
 *     does, for the page view. Pending decodes reject (handled by the
 *     scheduler), frames already decoded stay. A pack failure is permanent
 *     (the server answered that the file does not exist or cannot be used)
 *     or transient (network errors); `resume()`, called by the scheduler on
 *     a recovery signal, makes transiently failed packs, and every pack
 *     `stop()` marked, readable again (the worker gets `recover`).
 * Copies the worker's counters into window.__filmStats (FilmStats).
 */

import type { FromWorker, ToWorker } from "./film-worker-protocol";
import { recordDecode, variantKey, type FilmStats, type PackSource } from "./frame-cache";
import { PACK_FILE } from "./pack-format";
import type { NetPack, NetStats, NetWhere } from "./pack-net";
import type { FilmVariant } from "./types";

const MB = 1024 * 1024;
/** Compressed pack bytes the worker may hold. */
export const PACK_CAP_SMALL = 48 * MB;
export const PACK_CAP_LARGE = 160 * MB;

/** The pack's URL: pack.bin in the variant's folder, versioned by the pack's own hash. */
export function packUrl(v: FilmVariant): string {
  return `${v.base}/${PACK_FILE}${v.pack?.v ? `?v=${v.pack.v}` : ""}`;
}

/** The worker-like object the client talks to (a real Worker, or a test fake). */
export type WorkerLike = {
  postMessage(m: ToWorker): void;
  terminate(): void;
  onmessage: ((ev: MessageEvent<FromWorker>) => void) | null;
  onerror: ((ev: ErrorEvent) => void) | null;
  onmessageerror: ((ev: MessageEvent) => void) | null;
};

type Env = {
  scrollY: () => number;
  hash: () => string;
  hidden: () => boolean;
  constrained: () => boolean;
  /** Subscribe to the first scroll, visibility and connection changes. */
  listen: (onScroll: () => void, onChange: () => void) => () => void;
};

function browserEnv(): Env {
  type Conn = EventTarget & { saveData?: boolean; effectiveType?: string };
  const conn = (navigator as Navigator & { connection?: Conn }).connection;
  return {
    scrollY: () => window.scrollY,
    hash: () => window.location.hash,
    hidden: () => document.visibilityState === "hidden",
    constrained: () => !!conn && (conn.saveData === true || ["slow-2g", "2g", "3g"].includes(conn.effectiveType ?? "")),
    listen(onScroll, onChange) {
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", onChange);
      conn?.addEventListener?.("change", onChange);
      return () => {
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("visibilitychange", onChange);
        conn?.removeEventListener?.("change", onChange);
      };
    },
  };
}

function startBrowserWorker(): WorkerLike {
  return new Worker(new URL("./film-worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
}

/** Pack mode is off with ?pack=0, on the server, and where there is no Worker. */
export function packModeAllowed(): boolean {
  if (typeof window === "undefined" || typeof Worker !== "function") return false;
  return new URLSearchParams(window.location.search).get("pack") !== "0";
}

export class PackClient implements PackSource {
  private worker: WorkerLike | null = null;
  /** Set when pack mode is over for every variant (worker missing, failed or crashed). */
  private dead: string | null = null;
  /** stop(): static mode, nothing is read until resume(). */
  private stopped = false;
  /** Failed packs: permanent (for the page view), transient, or marked by stop() (both end with resume()). */
  private readonly failed = new Map<string, "permanent" | "transient" | "stopped">();
  private readonly held = new Map<string, Set<number>>();
  private readonly variants = new Map<string, FilmVariant>();
  private readonly pending = new Map<number, { resolve: (r: { bitmap: ImageBitmap; ms: number }) => void; reject: (e: Error) => void }>();
  private readonly listeners = new Set<(v: FilmVariant, added: readonly number[] | null) => void>();
  private nextId = 1;
  private reelKey = "";
  private scrolled = false;
  private last: Omit<NetWhere, "scrolled" | "hidden" | "constrained"> | null = null;
  private progress: NetStats["progress"] = {};
  private unlisten: (() => void) | null = null;

  constructor(
    private readonly opts: {
      stats: FilmStats;
      capBytes: number;
      /** The reel's variants for the current view, in film order (or setReel). */
      reel?: () => FilmVariant[];
      start?: () => WorkerLike;
      env?: Env;
    },
  ) {
    this.env = opts.env ?? browserEnv();
    this.reel = opts.reel ?? null;
  }

  private readonly env: Env;
  private reel: (() => FilmVariant[]) | null = null;

  /** Where the reel's variants for the current view come from. */
  setReel(fn: () => FilmVariant[]) {
    this.reel = fn;
  }

  serves(v: FilmVariant): boolean {
    return !!v.pack && !this.dead && !this.stopped && !this.failed.has(variantKey(v));
  }

  holds(v: FilmVariant, index: number): boolean {
    return this.held.get(variantKey(v))?.has(index) ?? false;
  }

  decode(v: FilmVariant, index: number): Promise<{ bitmap: ImageBitmap; ms: number }> {
    const w = this.worker;
    if (!w || !this.serves(v)) return Promise.reject(new Error("pack: not serving this variant"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      w.postMessage({ t: "decode", id, key: variantKey(v), index });
    });
  }

  subscribe(fn: (v: FilmVariant, added: readonly number[] | null) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  where(at: { variant: FilmVariant; frame: number; direction: 1 | -1; lo: number; hi: number; pin?: { variant: FilmVariant; frame: number } | null }) {
    if (this.dead || this.stopped) return;
    const key = at.variant.pack ? variantKey(at.variant) : null;
    const pin = at.pin?.variant.pack ? { key: variantKey(at.pin.variant), frame: at.pin.frame } : null;
    this.last = { key, frame: at.frame, direction: at.direction, lo: at.lo, hi: at.hi, pin };
    if (!this.scrolled) {
      // Read here, on a scroll decision (after mount and the router's scroll
      // reset), never during render; again on every decision until it holds,
      // so a scroll restored before the listener existed is not missed.
      const reel = this.reel?.() ?? [];
      const film = key ? reel.findIndex((v) => v.pack && variantKey(v) === key) : -1;
      this.scrolled = this.env.scrollY() > 0 || this.env.hash().length > 1 || film > 0;
    }
    if (!this.ensureWorker()) return;
    this.sendReel();
    this.sendWhere();
  }

  /**
   * Stop (static mode, the budget halted): every pack is marked failed in
   * the worker, so it reads none (its streams stop), and no variant is
   * served from a pack until resume(). The worker itself stays, idle: static
   * mode is not a crash. Nobody is told to fall back: a halted budget loads
   * nothing.
   */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.unlisten?.();
    this.unlisten = null;
    this.rejectPending("pack: stopped");
    for (const v of this.reel?.() ?? []) if (v.pack && !this.failed.has(variantKey(v))) this.failed.set(variantKey(v), "stopped");
    for (const [k, v] of this.variants) if (v.pack && !this.failed.has(k)) this.failed.set(k, "stopped");
    this.held.clear();
    if (this.worker) {
      this.reelKey = "";
      this.sendReel();
    }
  }

  /**
   * A recovery signal (frame-cache.ts): packs that failed transiently, and
   * after stop() every pack it marked, are served and read again (the worker
   * gets `recover`; one that failed permanently there is reported again).
   * Packs that failed permanently stay failed. The next scroll decision
   * tells the worker where the visitor is.
   */
  resume() {
    const keys = [...this.failed].filter(([, kind]) => kind !== "permanent").map(([key]) => key);
    const wasStopped = this.stopped;
    this.stopped = false;
    for (const k of keys) this.failed.delete(k);
    if (!this.worker || this.dead) return;
    if (keys.length) this.worker.postMessage({ t: "recover", keys });
    if (wasStopped && !this.unlisten) this.listenEnv();
  }

  /** Some pack failed transiently (a recovery signal would make it readable again). */
  hasTransient(): boolean {
    for (const kind of this.failed.values()) if (kind === "transient") return true;
    return false;
  }

  /** Stop the worker (unmount). A later `where` starts a fresh one. */
  dispose() {
    this.unlisten?.();
    this.unlisten = null;
    this.worker?.terminate();
    this.worker = null;
    this.reelKey = "";
    this.held.clear();
    this.rejectPending("pack: worker stopped");
  }

  private ensureWorker(): boolean {
    if (this.worker) return true;
    try {
      const w = (this.opts.start ?? startBrowserWorker)();
      w.onmessage = (ev) => this.onMessage(ev.data);
      w.onerror = (ev) => {
        ev.preventDefault?.();
        this.die("worker error");
      };
      w.onmessageerror = () => this.die("worker message error");
      this.worker = w;
      w.postMessage({ t: "init", cap: this.opts.capBytes });
    } catch {
      this.die("worker failed to start");
      return false;
    }
    this.listenEnv();
    return true;
  }

  private listenEnv() {
    this.unlisten = this.env.listen(
      () => {
        if (this.scrolled) return;
        this.scrolled = true;
        this.sendWhere();
      },
      () => this.sendWhere(),
    );
  }

  private sendReel() {
    const reel = this.reel?.() ?? [];
    const key = reel.map((v) => (v.pack ? variantKey(v) : "-")).join("|");
    if (key === this.reelKey) return;
    this.reelKey = key;
    const packs: Array<NetPack & { type: string }> = [];
    reel.forEach((v, film) => {
      const k = variantKey(v);
      this.variants.set(k, v);
      if (!v.pack) return;
      // A failed pack keeps its place, marked failed: the worker never reads
      // it, and a visitor on that film still has a neighbour.
      const failed = this.failed.has(k);
      packs.push({ key: k, url: packUrl(v), layout: v.pack, count: v.count, film, type: v.ext === "jpg" ? "image/jpeg" : `image/${v.ext}`, ...(failed ? { failed } : {}) });
    });
    this.worker?.postMessage({ t: "packs", packs });
  }

  private sendWhere() {
    if (!this.worker || !this.last || this.dead) return;
    this.worker.postMessage({ t: "where", where: { ...this.last, scrolled: this.scrolled, hidden: this.env.hidden(), constrained: this.env.constrained() } });
    this.updateProgress();
  }

  private onMessage(m: FromWorker) {
    const s = this.opts.stats;
    switch (m.t) {
      case "ready":
        if (!m.ok) this.die(`worker lacks ${m.missing ?? "a feature"}`);
        return;
      case "frames": {
        let set = this.held.get(m.key);
        if (!set) this.held.set(m.key, (set = new Set()));
        for (const i of m.removed) set.delete(i);
        for (const i of m.added) set.add(i);
        const v = this.variants.get(m.key);
        if (v && m.added.length) for (const fn of this.listeners) fn(v, m.added);
        return;
      }
      case "failed": {
        // Absent (an older worker): permanent.
        const kind = m.permanent === false ? "transient" : "permanent";
        const was = this.failed.get(m.key);
        // Marked by stop() meanwhile: keep the real kind (resume() needs it);
        // nobody falls back while stopped.
        if (was === "stopped") this.failed.set(m.key, kind);
        if (was) return;
        this.failed.set(m.key, kind);
        this.held.delete(m.key);
        s.packFallbacks++;
        const v = this.variants.get(m.key);
        if (v) for (const fn of this.listeners) fn(v, null);
        return;
      }
      case "stats":
        s.packRequests = m.stats.packRequests;
        s.packBytes = m.stats.packBytes;
        s.packBytesRepeated = m.stats.packBytesRepeated;
        s.packBytesHeld = m.stats.packBytesHeld;
        s.packReaims = m.stats.packReaims;
        this.progress = m.stats.progress;
        this.updateProgress();
        return;
      case "decoded": {
        const p = this.pending.get(m.id);
        if (!p) {
          // Nobody waits for it (the client was reset): free it.
          if (m.ok) m.bitmap.close();
          return;
        }
        this.pending.delete(m.id);
        if (m.ok) {
          recordDecode(s, "worker", m.ms);
          p.resolve({ bitmap: m.bitmap, ms: m.ms });
        } else p.reject(new Error(`pack: decode ${m.reason}`));
        return;
      }
    }
  }

  private updateProgress() {
    const s = this.opts.stats;
    const p = this.last?.key ? this.progress[this.last.key] : undefined;
    s.packHeldShare = p && p.total ? p.held / p.total : 0;
    s.packSkeleton = p?.skeleton ? 1 : 0;
  }

  private rejectPending(reason: string) {
    for (const p of this.pending.values()) p.reject(new Error(reason));
    this.pending.clear();
  }

  /** Pack mode is over for every variant: they all load frame by frame now. */
  private die(reason: string) {
    if (this.dead) return;
    this.dead = reason;
    this.unlisten?.();
    this.unlisten = null;
    try {
      this.worker?.terminate();
    } catch {
      /* already gone */
    }
    this.worker = null;
    this.held.clear();
    this.rejectPending(`pack: ${reason}`);
    this.opts.stats.packFallbacks++;
    for (const v of this.variants.values()) for (const fn of this.listeners) fn(v, null);
  }

  /** Why pack mode stopped for every variant (null while it runs). */
  get deadReason(): string | null {
    return this.dead;
  }
}
