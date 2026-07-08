import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { hostname } from "os";
import { resolve } from "path";

import { checkStaleLocks, inspectAutopilotLock } from "../src/lifecycle/doctor.js";
import { TMP_DIR } from "./helpers.js";
import { test } from "./harness.js";

const ROOT = resolve(TMP_DIR, "doctor-locks");

function freshDir(name: string): string {
  const dir = resolve(ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeLock(dir: string, name: string, rec: object): string {
  const p = resolve(dir, name);
  writeFileSync(p, JSON.stringify(rec), "utf8");
  return p;
}

test("doctor flags a same-host lock whose owner pid is dead, with the exact rm command", () => {
  const dir = freshDir("dead-pid");
  // pid 99999999 exceeds any real pid on this host → kill(pid,0) throws ESRCH.
  const p = writeLock(dir, "zz.compiler-run.lock", {
    pid: 99999999, host: hostname(), at: "2026-07-01T00:00:00.000Z", owner: "x",
  });
  const f = inspectAutopilotLock(p);
  assert.equal(f.level, "warn");
  assert.match(f.message, /STALE/);
  assert.match(f.message, new RegExp(`rm ${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

test("doctor reports a foreign-host lock as UNVERIFIABLE (never claims dead, never removes)", () => {
  const dir = freshDir("foreign");
  const p = writeLock(dir, "zz.lock", {
    pid: 4242, host: `not-${hostname()}`, at: "2026-07-01T00:00:00.000Z", owner: "y",
  });
  const f = inspectAutopilotLock(p);
  assert.equal(f.level, "warn");
  assert.match(f.message, /UNVERIFIABLE/);
  assert.match(f.message, /foreign host/);
});

test("doctor passes a same-host lock held by a LIVE pid (this test process)", () => {
  const dir = freshDir("live");
  const p = writeLock(dir, "zz.lock", {
    pid: process.pid, host: hostname(), at: new Date().toISOString(), owner: "z",
  });
  const f = inspectAutopilotLock(p);
  assert.equal(f.level, "ok");
  assert.match(f.message, /live pid/);
});

test("doctor warns on a torn/unreadable lock", () => {
  const dir = freshDir("torn");
  const p = resolve(dir, "zz.lock");
  writeFileSync(p, "{ this is not json", "utf8");
  const f = inspectAutopilotLock(p);
  assert.equal(f.level, "warn");
  assert.match(f.message, /unreadable|torn/);
});

test("checkStaleLocks: empty/absent dir is OK; a dead lock surfaces a warn", () => {
  const empty = freshDir("empty-locks");
  const okFindings = checkStaleLocks(empty);
  assert.equal(okFindings.length, 1);
  assert.equal(okFindings[0].level, "ok");

  writeLock(empty, "a.lock", { pid: 99999999, host: hostname(), at: "2026-07-01T00:00:00.000Z", owner: "a" });
  const warned = checkStaleLocks(empty);
  assert.equal(warned.length, 1);
  assert.equal(warned[0].level, "warn");
  assert.match(warned[0].message, /STALE/);
});

test("doctor-locks scratch tree is removed", () => {
  rmSync(ROOT, { recursive: true, force: true });
  assert.ok(!existsSync(ROOT));
});
