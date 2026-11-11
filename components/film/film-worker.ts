/**
 * The film worker: owns the pack bytes and decodes frames off the main
 * thread. Created lazily by pack-client.ts (never at import, never on the
 * server) with `new Worker(new URL("./film-worker.ts", import.meta.url),
 * { type: "module" })`, which both the dev server and the production build
 * emit as their own chunk.
 *
 *   network   PackNet (pack-net.ts): Range streams per the plan (pack-plan.ts),
 *             frames cut as bytes arrive (pack-store.ts), byte cap, retries
 *   decode    createImageBitmap(Blob of the frame's bytes); the bitmap is
 *             transferred to the page with the time the decode took
 *
 * Protocol: film-worker-protocol.ts. On init the worker checks it has
 * createImageBitmap, fetch and a streaming response body; without them it
 * answers `ready: false` and the page loads frames itself.
 */

import type { FromWorker, ToWorker } from "./film-worker-protocol";
import { PackNet, type NetClock } from "./pack-net";

type Scope = {
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
  addEventListener(type: "message", fn: (ev: MessageEvent<ToWorker>) => void): void;
};

const scope = self as unknown as Scope;
const post = (m: FromWorker, transfer?: Transferable[]) => scope.postMessage(m, transfer ?? []);

const clock: NetClock = {
  now: () => performance.now(),
  later(fn, ms) {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

let net: PackNet | null = null;
const types = new Map<string, string>();

function missingFeatures(): string[] {
  const missing: string[] = [];
  if (typeof createImageBitmap !== "function") missing.push("createImageBitmap");
  if (typeof fetch !== "function") missing.push("fetch");
  if (typeof ReadableStream !== "function" || typeof Response === "undefined" || !("body" in Response.prototype)) missing.push("streaming response body");
  return missing;
}

async function decode(id: number, key: string, index: number) {
  const bytes = net?.frame(key, index);
  if (!bytes) return post({ t: "decoded", id, ok: false, reason: "missing" });
  const t0 = performance.now();
  try {
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: types.get(key) ?? "image/webp" });
    const bitmap = await createImageBitmap(blob);
    post({ t: "decoded", id, ok: true, bitmap, ms: performance.now() - t0 }, [bitmap]);
  } catch {
    post({ t: "decoded", id, ok: false, reason: "error" });
  }
}

scope.addEventListener("message", (ev) => {
  const m = ev.data;
  switch (m.t) {
    case "init": {
      const missing = missingFeatures();
      if (missing.length) return post({ t: "ready", ok: false, missing: missing.join(", ") });
      net?.dispose();
      net = new PackNet(
        {
          fetch: (url, init) => fetch(url, { headers: init.headers, signal: init.signal }),
          clock,
          emit: (e) => post(e),
        },
        m.cap,
      );
      return post({ t: "ready", ok: true });
    }
    case "packs":
      for (const p of m.packs) types.set(p.key, p.type);
      return net?.setPacks(m.packs);
    case "where":
      return net?.setWhere(m.where);
    case "decode":
      return void decode(m.id, m.key, m.index);
  }
});
