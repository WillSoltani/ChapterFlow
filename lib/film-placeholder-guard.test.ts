import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// scripts/film/placeholder.mjs writes into public/films by default, and in a
// checkout where public/films links to the real frames that would replace
// them. It must refuse to overwrite a directory whose manifest is not a
// placeholder's (an encode's), and write nothing.

test("placeholder.mjs refuses to overwrite real frames", () => {
  const out = mkdtempSync(path.join(tmpdir(), "film-placeholder-guard-"));
  try {
    const dir = path.join(out, "palace-00");
    mkdirSync(dir);
    const real = JSON.stringify({ name: "palace-00", count: 3, pad: 4, ext: "webp", v: "real" });
    writeFileSync(path.join(dir, "manifest.json"), real);
    writeFileSync(path.join(dir, "f_0001.webp"), "real frame");
    const r = spawnSync(process.execPath, ["scripts/film/placeholder.mjs", "palace-00", "--out", out], { encoding: "utf8" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /refusing to overwrite/);
    assert.equal(readFileSync(path.join(dir, "manifest.json"), "utf8"), real);
    assert.equal(readFileSync(path.join(dir, "f_0001.webp"), "utf8"), "real frame");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
