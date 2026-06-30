/**
 * Atomic file write — write to a unique sibling temp file, then rename over the target.
 *
 * rename(2) is atomic on the same filesystem, so an interruption (SIGKILL on a writer
 * timeout, host OOM, reboot) mid-write leaves EITHER the old file or the COMPLETE new one —
 * never a truncated half-file. A truncated chapter JSON was the wedge: `loadBookChapters`
 * throws on a torn file, `computeBookStatus` calls it, and the conductor's first status read
 * then throws → "infra halt: re-run to resume" → every re-run re-throws → the walk-away
 * autopilot is bricked on its OWN partial write. Atomic writes make that state unreachable.
 *
 * The librarian ledger already used tmp+rename for the same reason; this is the shared
 * primitive every content/state writer should use.
 */
import { mkdirSync, writeFileSync, renameSync, rmSync } from "fs";
import { dirname } from "path";
import { randomBytes } from "crypto";

/** Atomically write `data` to `filePath` (creating parent dirs). The temp file carries a
 *  pid+random suffix so concurrent writers (parallel chapter authoring) never collide on it. */
export function writeFileAtomic(filePath: string, data: string, encoding: BufferEncoding = "utf8"): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  try {
    writeFileSync(tmp, data, encoding);
    renameSync(tmp, filePath);
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* best-effort: don't mask the real error */ }
    throw err;
  }
}
