/**
 * PackClient — the page side of the film worker (film-worker.ts): the
 * PackSource the frame scheduler (FrameBudget) uses in pack mode.
 *
 *   • Starts the worker lazily, on the first scroll decision (never at
 *     import, never during server render), with the bundler's standard form
 *     `new Worker(new URL("./film-worker.ts", import.meta.url), { type: "module" })`.
 *   • Tells the worker where the visitor is: the active film's pack, the
 *     playhead, the direction, the wanted window, whether the visitor has
 *     scrolled yet (a scroll position above 0 at load, or a #anchor, counts),
 *     whether the document is hidden and whether the connection is
 *     constrained (Save-Data, slow-2g/2g/3g).
 *   • Mirrors which frames the worker holds, so the scheduler knows
 *     synchronously what is decodable; asks the worker to decode and gets the
 *     ImageBitmap back (transferred).
 *   • Fallback: a variant whose pack fails (404, unusable, retries spent)
 *     goes to the per-frame path for the rest of the page view; if the worker
 *     cannot start, lacks createImageBitmap or a streaming fetch body, or
 *     crashes, every variant does. Pending decodes reject (handled by the
 *     scheduler), frames already decoded stay.
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
  private readonly failed = new Set<string>();
  private readonly held = new Map<string, Set<number>>();
  private readonly variants = new Map<string, FilmVariant>();
  private readonly pending = new Map<number, { resolve: (r: { bitmap: ImageBitmap; ms: number }) => void; reject: (e: Error) => void }>();
  private readonly listeners = new Set<(v: FilmVariant, added: readonly number[] | null) => void>();
  private nextId = 1;
  private reelKey = "";
  private scrolled: boolean;
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
    this.scrolled = this.env.scrollY() > 0 || this.env.hash().length > 1;
  }

  private readonly env: Env;
  private reel: (() => FilmVariant[]) | null = null;

  /** Where the reel's variants for the current view come from. */
  setReel(fn: () => FilmVariant[]) {
    this.reel = fn;
  }

  serves(v: FilmVariant): boolean {
    return !!v.pack && !this.dead && !this.failed.has(variantKey(v));
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

  where(at: { variant: FilmVariant; frame: number; direction: 1 | -1; lo: number; hi: number }) {
    if (this.dead) return;
    this.last = { key: at.variant.pack ? variantKey(at.variant) : null, frame: at.frame, direction: at.direction, lo: at.lo, hi: at.hi };
    if (!this.ensureWorker()) return;
    this.sendReel();
    this.sendWhere();
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
    this.unlisten = this.env.listen(
      () => {
        if (this.scrolled) return;
        this.scrolled = true;
        this.sendWhere();
      },
      () => this.sendWhere(),
    );
    return true;
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
      if (!v.pack || this.failed.has(k)) return;
      packs.push({ key: k, url: packUrl(v), layout: v.pack, count: v.count, film, type: v.ext === "jpg" ? "image/jpeg" : `image/${v.ext}` });
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
        if (this.failed.has(m.key)) return;
        this.failed.add(m.key);
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
