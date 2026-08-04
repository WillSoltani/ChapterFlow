import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { UtcIso } from "../../src/contracts/v4Core.js";
import { guardedProductionRoots } from "../productionLeakGuard.js";
import { byteSorted } from "./determinism.js";

const V25_DIR = dirname(fileURLToPath(import.meta.url));
export const PIPELINE_ROOT = resolve(V25_DIR, "..", "..");

export type RootDescriptor = { readonly name: string; readonly path: string };

export type RootEntry = {
  readonly path: string;
  readonly kind: "missing" | "directory" | "file" | "symlink" | "other";
  readonly mode: number | null;
  readonly mtimeMs: string | null;
  readonly size: number | null;
  readonly digest: string | null;
};

export type RootSnapshot = {
  readonly name: string;
  readonly path: string;
  readonly entries: readonly RootEntry[];
};

export type GuardSnapshot = readonly RootSnapshot[];

export type RootDiff = {
  readonly root: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
};

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function entryFingerprint(entry: RootEntry): string {
  return JSON.stringify(entry);
}

function snapshotRoot(descriptor: RootDescriptor): RootSnapshot {
  const entries: RootEntry[] = [];

  const walk = (absolutePath: string, relativePath: string): void => {
    let stat;
    try {
      stat = lstatSync(absolutePath);
    } catch (error) {
      if (relativePath === "." && (error as NodeJS.ErrnoException).code === "ENOENT") {
        entries.push({ path: ".", kind: "missing", mode: null, mtimeMs: null, size: null, digest: null });
        return;
      }
      throw error;
    }

    const common = {
      path: relativePath,
      mode: stat.mode & 0o7777,
      mtimeMs: String(stat.mtimeMs),
      size: stat.size,
    } as const;

    if (stat.isSymbolicLink()) {
      entries.push({ ...common, kind: "symlink", digest: sha256(readlinkSync(absolutePath)) });
      return;
    }
    if (stat.isFile()) {
      entries.push({ ...common, kind: "file", digest: sha256(readFileSync(absolutePath)) });
      return;
    }
    if (!stat.isDirectory()) {
      entries.push({ ...common, kind: "other", digest: null });
      return;
    }

    entries.push({ ...common, kind: "directory", digest: null });
    for (const name of byteSorted(readdirSync(absolutePath))) {
      walk(join(absolutePath, name), relativePath === "." ? name : `${relativePath}/${name}`);
    }
  };

  walk(descriptor.path, ".");
  return { name: descriptor.name, path: descriptor.path, entries };
}

export function snapshotRoots(descriptors: readonly RootDescriptor[]): GuardSnapshot {
  return [...descriptors]
    .sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)))
    .map(snapshotRoot);
}

export function guardedRootDescriptors(): readonly RootDescriptor[] {
  const existing = guardedProductionRoots()
    .filter((root) => root.diffable)
    .map(({ name, path }) => ({ name, path }));
  return [
    ...existing,
    { name: "pipeline-chapterflow", path: resolve(PIPELINE_ROOT, ".chapterflow") },
    { name: "pipeline-book-packages", path: resolve(PIPELINE_ROOT, "book-packages") },
  ];
}

export function snapshotGuardedProductionRoots(): GuardSnapshot {
  return snapshotRoots(guardedRootDescriptors());
}

export function diffRootSnapshots(before: GuardSnapshot, after: GuardSnapshot): readonly RootDiff[] {
  const afterByName = new Map(after.map((root) => [root.name, root]));
  const beforeByName = new Map(before.map((root) => [root.name, root]));
  const diffs: RootDiff[] = [];

  for (const name of byteSorted([...new Set([...beforeByName.keys(), ...afterByName.keys()])])) {
    const oldRoot = beforeByName.get(name);
    const newRoot = afterByName.get(name);
    const oldEntries = new Map((oldRoot?.entries ?? []).map((entry) => [entry.path, entry]));
    const newEntries = new Map((newRoot?.entries ?? []).map((entry) => [entry.path, entry]));
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    for (const path of byteSorted([...new Set([...oldEntries.keys(), ...newEntries.keys()])])) {
      const oldEntry = oldEntries.get(path);
      const newEntry = newEntries.get(path);
      const display = path === "." ? name : `${name}/${path}`;
      if (!oldEntry) added.push(display);
      else if (!newEntry) removed.push(display);
      else if (entryFingerprint(oldEntry) !== entryFingerprint(newEntry)) changed.push(display);
    }
    if (added.length > 0 || removed.length > 0 || changed.length > 0) {
      diffs.push({ root: name, added, removed, changed });
    }
  }
  return diffs;
}

export function verifyGuardedProductionRoots(before: GuardSnapshot): readonly RootDiff[] {
  return diffRootSnapshots(before, snapshotGuardedProductionRoots());
}

export function formatRootDiffs(diffs: readonly RootDiff[]): string {
  const lines: string[] = [];
  for (const diff of diffs) {
    for (const path of diff.added) lines.push(`+ ${path}`);
    for (const path of diff.removed) lines.push(`- ${path}`);
    for (const path of diff.changed) lines.push(`~ ${path}`);
  }
  return lines.join("\n");
}

export type BaselineStatus = "PASS" | "FAIL" | "NOT_RUN";

export type BaselineCheck = {
  readonly name: "typecheck" | "focused-test";
  readonly command: string;
  readonly status: BaselineStatus;
  readonly exitCode: number | null;
  readonly detail: string;
};

export function notRunBaselineCheck(name: BaselineCheck["name"], command: string, detail: string): BaselineCheck {
  return { name, command, status: "NOT_RUN", exitCode: null, detail };
}

export function runBaselineCheck(
  name: BaselineCheck["name"],
  executable: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv } = {},
): BaselineCheck {
  const command = [executable, ...args].join(" ");
  const result = spawnSync(executable, [...args], {
    cwd: options.cwd ?? PIPELINE_ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const exitCode = result.status;
  const detail = [result.stdout, result.stderr, result.error?.message]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .trim();
  return {
    name,
    command,
    status: exitCode === 0 && result.error === undefined ? "PASS" : "FAIL",
    exitCode,
    detail,
  };
}

function packageVersion(name: "typescript" | "tsx"): string {
  const packageJson = resolve(PIPELINE_ROOT, "package.json");
  const parsed = JSON.parse(readFileSync(packageJson, "utf8")) as {
    devDependencies?: Record<string, unknown>;
  };
  const version = parsed.devDependencies?.[name];
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`missing exact ${name} version in ${packageJson}`);
  }
  return version;
}

function npmVersion(): string {
  const result = spawnSync("npm", ["--version"], { cwd: PIPELINE_ROOT, encoding: "utf8", timeout: 10_000 });
  if (result.status !== 0) throw new Error(`npm --version failed: ${result.stderr || result.error?.message || result.status}`);
  return result.stdout.trim();
}

export type BaselineReport = {
  readonly schemaVersion: "1";
  readonly capturedAt: UtcIso;
  readonly toolVersions: {
    readonly node: string;
    readonly npm: string;
    readonly typescript: string;
    readonly tsx: string;
  };
  readonly checks: {
    readonly typecheck: BaselineCheck;
    readonly focusedTest: BaselineCheck;
  };
  readonly guardedRoots: readonly {
    readonly name: string;
    readonly path: string;
    readonly entryCount: number;
    readonly fileCount: number;
    readonly bytes: number;
  }[];
};

export function captureBaseline(options: {
  readonly capturedAt?: UtcIso;
  readonly typecheck?: BaselineCheck;
  readonly focusedTest?: BaselineCheck;
} = {}): BaselineReport {
  const guarded = snapshotGuardedProductionRoots();
  return {
    schemaVersion: "1",
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    toolVersions: {
      node: process.version,
      npm: npmVersion(),
      typescript: packageVersion("typescript"),
      tsx: packageVersion("tsx"),
    },
    checks: {
      typecheck: options.typecheck ?? notRunBaselineCheck("typecheck", "npm run typecheck", "run by package verification"),
      focusedTest: options.focusedTest ?? notRunBaselineCheck("focused-test", "npx tsx tests/v25/run.ts <filter>", "run by package verification"),
    },
    guardedRoots: guarded.map((root) => ({
      name: root.name,
      path: root.path,
      entryCount: root.entries.length,
      fileCount: root.entries.filter((entry) => entry.kind === "file").length,
      bytes: root.entries.reduce((sum, entry) => sum + (entry.kind === "file" ? entry.size ?? 0 : 0), 0),
    })),
  };
}
