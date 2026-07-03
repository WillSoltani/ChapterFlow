import { createHash, randomBytes } from "crypto";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

export const QC_ROUND_ROLES = ["sweep", "keyA", "keyB", "bar", "craft", "confirm", "major", "attest"] as const;
export type QcRoundRole = typeof QC_ROUND_ROLES[number];

export type QcRoundRecord = {
  schemaVersion: "qc-round-v1";
  bookId: string;
  roundId: string;
  openedAt: string;
  roles: Partial<Record<QcRoundRole, { salt: string; tokenHash: string }>>;
};

export const QC_ROUNDS_DIR = resolve(CANONICAL_STATE, "qc-rounds");

function hashToken(role: QcRoundRole, salt: string, token: string): string {
  return createHash("sha256").update(`${role}:${salt}:${token}`, "utf8").digest("hex");
}

function newToken(role: QcRoundRole): string {
  return `cfq-${role}-${randomBytes(18).toString("base64url")}`;
}

export function isQcRoundRole(value: string): value is QcRoundRole {
  return (QC_ROUND_ROLES as readonly string[]).includes(value);
}

export function qcRoundPath(bookId: string, roundId: string): string {
  return resolve(QC_ROUNDS_DIR, `${bookId}.${roundId}.json`);
}

export function loadQcRound(bookId: string, roundId: string): QcRoundRecord | null {
  const p = qcRoundPath(bookId, roundId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as QcRoundRecord;
  } catch {
    return null;
  }
}

export function openQcRound(bookId: string, roundId = `r${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`): { record: QcRoundRecord; tokens: Record<QcRoundRole, string>; path: string } {
  const tokens = {} as Record<QcRoundRole, string>;
  const roles = {} as QcRoundRecord["roles"];
  for (const role of QC_ROUND_ROLES) {
    const token = newToken(role);
    const salt = randomBytes(16).toString("hex");
    tokens[role] = token;
    roles[role] = { salt, tokenHash: hashToken(role, salt, token) };
  }
  const record: QcRoundRecord = {
    schemaVersion: "qc-round-v1",
    bookId,
    roundId,
    openedAt: new Date().toISOString(),
    roles,
  };
  const path = qcRoundPath(bookId, roundId);
  if (existsSync(path)) throw new Error(`QC round already exists: ${path}`);
  // Atomic: a torn round.json is read UNGUARDED by checkRoundFreshness/selectedRoundChapters
  // (the H2 crash vector) — a crash mid-write here would make finalize throw on the next read.
  writeFileAtomic(path, JSON.stringify(record, null, 2));
  return { record, tokens, path };
}

export function verifyQcRoundToken(bookId: string, roundId: string, role: QcRoundRole, token: string): boolean {
  const rec = loadQcRound(bookId, roundId);
  const entry = rec?.roles?.[role];
  if (!entry || !token) return false;
  return hashToken(role, entry.salt, token) === entry.tokenHash;
}

export function identifyQcRoundRole(bookId: string, roundId: string, token: string, roles: readonly QcRoundRole[] = QC_ROUND_ROLES): QcRoundRole | null {
  for (const role of roles) {
    if (verifyQcRoundToken(bookId, roundId, role, token)) return role;
  }
  return null;
}
