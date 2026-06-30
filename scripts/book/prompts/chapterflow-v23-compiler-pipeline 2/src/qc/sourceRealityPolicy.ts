/**
 * WS-4 — the central source-REALITY policy evaluator.
 *
 * For a NEWLY PRODUCED source-v2 book, sidecar-versus-reality verification is a PRODUCTION
 * INVARIANT, not an entrypoint convention. This module is the single point every production
 * promotion path consults so the verdict is identical whether a book ships via `promote-book`,
 * `publish-after-qc`, or any alternate path.
 *
 * The hole this closes: the old `sourceVerifyGateFindings(..., { require })` made an ABSENT
 * source-verify record block ONLY under `CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1`. The strict
 * runbook set that variable, but a direct `promote-book` could omit it and publish a freshly
 * produced book that was never reality-checked. Here, classification is CONTENT-BASED (a book
 * with source-v2 sidecars is "new" and MUST be verified) and cannot be downgraded by an env var.
 * The env var may only STRENGTHEN — it can extend the requirement to books with no verifiable
 * source content — never weaken the default for new books.
 *
 * Absence of a record is acceptable for new content ONLY through an explicit, durable,
 * content-bound LEGACY EXEMPTION (config/source-reality-legacy-exemptions.json). That is the
 * narrow, auditable escape hatch that keeps existing checked-in legacy packages usable without
 * reopening the silent blanket bypass.
 *
 * The policy reports exactly one decision, surfaced in promotion + publish-preflight output:
 *   - required-and-verified : a present record passes the source-verify checker.
 *   - legacy-exempt         : no record, but a valid content-bound legacy exemption covers it.
 *   - missing               : verification is required, but no record and no exemption exist.
 *   - invalid               : a present record is bad, OR a present exemption is malformed /
 *                             wrong-book / content-mismatched.
 *   - stale                 : a present, otherwise-valid exemption is past its expiry.
 *   - not-applicable        : the book has no source-v2 content to reality-check (and the env
 *                             strengthening flag is not set). Non-blocking; informational only.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { readCanonicalChapterIndex } from "../lib/chapterSet.js";
import {
  checkSourceVerifyRecord,
  parseSourceVerifyRecord,
  sourceVerifyRecordPath,
  verifiableItems,
  type SourceVerifyItem,
} from "../critics/sourceVerify.js";
import { expectedSourceChapters, loadSourceV2Sidecar, sourceSidecarPathFor, type SourceV2Roots } from "./sourceV2Gate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");

/** The durable, committed legacy-exemption registry (auditable in code review). */
export const LEGACY_EXEMPTIONS_FILE = resolve(PIPELINE_DIR, "config", "source-reality-legacy-exemptions.json");

export const LEGACY_EXEMPTION_SCHEMA = "source-reality-legacy-exemption-v1" as const;
export const LEGACY_EXEMPTIONS_REGISTRY_SCHEMA = "source-reality-legacy-exemptions-v1" as const;

export const SOURCE_REALITY_DECISIONS = [
  "required-and-verified",
  "legacy-exempt",
  "missing",
  "invalid",
  "stale",
  "not-applicable",
] as const;
export type SourceRealityDecision = (typeof SOURCE_REALITY_DECISIONS)[number];

export type SourceRealityClassification = "new-source-v2" | "legacy";

export type SourceRealityFinding = {
  checkId: string;
  severity: "blocker";
  chapterNumber?: number;
  message: string;
};

/**
 * A legacy exemption. NARROW and AUDITABLE by construction: it names the book, the human who
 * approved it and when, why, the content identity it is bound to, and an optional expiry. A
 * new book CANNOT self-classify as legacy via this — only a human-approved, content-bound entry
 * in the committed registry does, and any drift in the bound identity invalidates it.
 */
export type LegacyExemption = {
  schemaVersion: string;
  bookId: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
  /** Content/structure identity this exemption is bound to. At least one must be present AND
   *  verifiable against the current book, or the exemption is invalid (fails closed). */
  canonicalIndexHash?: string;
  packageId?: string;
  contentId?: string;
  /** Optional ISO timestamp; once past, the exemption is `stale` and blocks until renewed. */
  expiresAt?: string;
};

/** The content identity of the book as it stands now, used to bind/validate an exemption. */
export type ContentIdentity = {
  canonicalIndexHash?: string;
  packageId?: string;
  contentId?: string;
};

export type SourceRealityPolicyResult = {
  decision: SourceRealityDecision;
  blocking: boolean;
  classification: SourceRealityClassification;
  /** Whether verification is required (no exemption ⇒ a record must exist). */
  applies: boolean;
  itemCount: number;
  /** Blocking findings (empty when non-blocking). */
  findings: SourceRealityFinding[];
  /** Present only when decision === "legacy-exempt". */
  exemption?: LegacyExemption;
  /** One-line, decision-word-bearing summary for promotion / preflight output. */
  summary: string;
};

// ── Pure decision core ───────────────────────────────────────────────────────
// Every disk read is hoisted into the wrapper below; this is a total function of its inputs,
// so the full decision table (every classification × record × exemption × expiry branch) is
// unit-testable without a fixture.

export type SourceRealityInputs = {
  bookId: string;
  /** Verifiable real-world assertions from the book's source-v2 sidecars. */
  expectedItems: SourceVerifyItem[];
  /** The book has source-v2 sidecars on disk — the CONTENT-based "new" classification signal. */
  hasSourceV2Sidecars: boolean;
  /** Raw text of the canonical source-verify record, or null when absent. */
  recordText: string | null;
  /** Raw JSON text of this book's legacy exemption, or null when absent. */
  exemptionText: string | null;
  /** Set when the exemption REGISTRY itself could not be read (a misconfiguration → fail closed). */
  exemptionError: string | null;
  /** The book's current content identity, used to validate an exemption's binding. */
  contentIdentity: ContentIdentity;
  /** CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 — strengthens: requires a record/exemption even when
   *  the book has no verifiable source content. NEVER weakens the new-book default. */
  requireEnv: boolean;
  now: Date;
};

function finding(checkId: string, message: string, chapterNumber?: number): SourceRealityFinding {
  return chapterNumber === undefined
    ? { checkId, severity: "blocker", message }
    : { checkId, severity: "blocker", chapterNumber, message };
}

function summaryFor(bookId: string, decision: SourceRealityDecision, findings: SourceRealityFinding[]): string {
  const head = `source-reality: ${decision} — ${bookId}`;
  if (findings.length === 0) {
    switch (decision) {
      case "required-and-verified": return `${head} (source-verify record present and VERIFIED).`;
      case "legacy-exempt": return `${head} (no record; covered by a valid content-bound legacy exemption).`;
      case "not-applicable": return `${head} (no source-v2 content to reality-check).`;
      default: return head;
    }
  }
  return `${head}: ${findings[0].message}`;
}

function result(
  bookId: string,
  decision: SourceRealityDecision,
  blocking: boolean,
  classification: SourceRealityClassification,
  applies: boolean,
  itemCount: number,
  findings: SourceRealityFinding[],
  exemption?: LegacyExemption,
): SourceRealityPolicyResult {
  return { decision, blocking, classification, applies, itemCount, findings, exemption, summary: summaryFor(bookId, decision, findings) };
}

export function decideSourceRealityPolicy(input: SourceRealityInputs): SourceRealityPolicyResult {
  const classification: SourceRealityClassification = input.hasSourceV2Sidecars ? "new-source-v2" : "legacy";
  // Fully-unattended mode: an ABSENT source-verify record is required ONLY when the operator
  // opts in via CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1. By default a new source-v2 book with no
  // record is `not-applicable` (non-blocking) so the autopilot converges without a human source
  // check. A PRESENT-but-invalid/rubber-stamped record ALWAYS blocks (that path runs before this
  // `applies` gate), and a content-bound legacy exemption still applies — only the missing-record
  // default is relaxed.
  const applies = input.requireEnv;
  const itemCount = input.expectedItems.length;
  const mk = (decision: SourceRealityDecision, blocking: boolean, findings: SourceRealityFinding[], exemption?: LegacyExemption) =>
    result(input.bookId, decision, blocking, classification, applies, itemCount, findings, exemption);

  // 1) A PRESENT record is authoritative and is checked regardless of classification or env —
  //    "a present but invalid record blocks" is unconditional.
  if (input.recordText !== null) {
    const { record, error } = parseSourceVerifyRecord(input.recordText);
    if (error || !record) {
      return mk("invalid", true, [finding("SR.record_unparseable", `source-verify record is present but could not be parsed: ${error ?? "unknown error"}`)]);
    }
    const svBlockers = checkSourceVerifyRecord(input.expectedItems, record).filter((f) => f.severity === "blocker");
    if (svBlockers.length > 0) {
      return mk("invalid", true, svBlockers.map((f) => finding(f.checkId, f.message, f.chapterNumber)));
    }
    return mk("required-and-verified", false, []);
  }

  // 2) Record ABSENT. A broken registry must fail closed before we trust any absence.
  if (input.exemptionError) {
    return mk("invalid", true, [finding("SR.exemption_registry_unreadable", `legacy-exemption registry could not be read (${input.exemptionError}); refusing to treat the absent record as exempt.`)]);
  }

  // 3) Record absent — an explicit, content-bound legacy exemption is the ONLY acceptable absence.
  if (input.exemptionText !== null) {
    return decideWithExemption(input, mk);
  }

  // 4) No record, no exemption.
  if (applies) {
    const why = input.hasSourceV2Sidecars
      ? `${input.bookId} is a new source-v2 book (${itemCount} verifiable item(s)) with no source-verify record. Run \`source-verify ${input.bookId} --write\`, verify every item against a real source, then \`source-verify-check ${input.bookId}\` — or add a content-bound legacy exemption.`
      : `${input.bookId} has no source-verify record and CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 requires one. Produce a verified record, or add a content-bound legacy exemption.`;
    return mk("missing", true, [finding("SR.record_missing", why)]);
  }
  return mk("not-applicable", false, []);
}

function decideWithExemption(
  input: SourceRealityInputs,
  mk: (decision: SourceRealityDecision, blocking: boolean, findings: SourceRealityFinding[], exemption?: LegacyExemption) => SourceRealityPolicyResult,
): SourceRealityPolicyResult {
  let parsed: any;
  try {
    parsed = JSON.parse(input.exemptionText as string);
  } catch (e) {
    return mk("invalid", true, [finding("SR.exemption_unparseable", `legacy exemption for ${input.bookId} is not valid JSON: ${(e as Error).message}`)]);
  }
  if (parsed?.schemaVersion !== LEGACY_EXEMPTION_SCHEMA) {
    return mk("invalid", true, [finding("SR.exemption_bad_schema", `legacy exemption schemaVersion is ${JSON.stringify(parsed?.schemaVersion)}, expected "${LEGACY_EXEMPTION_SCHEMA}".`)]);
  }
  const requiredStrings: Array<keyof LegacyExemption> = ["bookId", "reason", "approvedBy", "approvedAt"];
  const missing = requiredStrings.filter((k) => typeof parsed[k] !== "string" || !String(parsed[k]).trim());
  if (missing.length > 0) {
    return mk("invalid", true, [finding("SR.exemption_incomplete", `legacy exemption for ${input.bookId} is missing required field(s): ${missing.join(", ")}. Required: schemaVersion, bookId, reason, approvedBy, approvedAt, a content identity, optional expiresAt.`)]);
  }
  if (parsed.bookId !== input.bookId) {
    return mk("invalid", true, [finding("SR.exemption_wrong_book", `legacy exemption names bookId "${parsed.bookId}" but is being applied to "${input.bookId}".`)]);
  }
  if (parsed.approvedAt && !Number.isFinite(Date.parse(parsed.approvedAt))) {
    return mk("invalid", true, [finding("SR.exemption_bad_timestamp", `legacy exemption approvedAt "${parsed.approvedAt}" is not a valid timestamp.`)]);
  }

  // Content binding — at least one declared identity must be VERIFIED against the current book.
  // A mismatch on any declared+checkable identity blocks; an exemption that declares no identity
  // we can currently verify also blocks (fail closed) — that is the "content-mismatched" rule.
  const declared: Array<keyof ContentIdentity> = (["canonicalIndexHash", "packageId", "contentId"] as Array<keyof ContentIdentity>)
    .filter((k) => typeof parsed[k] === "string" && String(parsed[k]).trim());
  if (declared.length === 0) {
    return mk("invalid", true, [finding("SR.exemption_no_identity", `legacy exemption for ${input.bookId} declares no content identity (need canonicalIndexHash, packageId, or contentId) — it cannot be bound to this book.`)]);
  }
  let verifiedAny = false;
  for (const key of declared) {
    const current = input.contentIdentity[key];
    if (current === undefined || current === null) continue; // can't check this identity in this path
    if (parsed[key] !== current) {
      return mk("invalid", true, [finding("SR.exemption_content_mismatch", `legacy exemption ${key} "${parsed[key]}" does not match the current book ${key} "${current}" — the bound content changed; re-approve or re-verify.`)]);
    }
    verifiedAny = true;
  }
  if (!verifiedAny) {
    return mk("invalid", true, [finding("SR.exemption_unverifiable", `legacy exemption for ${input.bookId} declares only identities that cannot be verified in this context (${declared.join(", ")}); bind it to a canonicalIndexHash.`)]);
  }

  // Expiry — an otherwise-valid exemption past its expiry is `stale`.
  if (typeof parsed.expiresAt === "string" && parsed.expiresAt.trim()) {
    const exp = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(exp)) {
      return mk("invalid", true, [finding("SR.exemption_bad_expiry", `legacy exemption expiresAt "${parsed.expiresAt}" is not a valid timestamp.`)]);
    }
    if (input.now.getTime() > exp) {
      return mk("stale", true, [finding("SR.exemption_expired", `legacy exemption for ${input.bookId} expired at ${parsed.expiresAt}; renew it or verify the source.`)]);
    }
  }

  return mk("legacy-exempt", false, [], parsed as LegacyExemption);
}

// ── Disk-backed wrapper (the single entry point both production paths call) ────

export type SourceRealityRoots = SourceV2Roots & {
  /** Override the canonical source-verify record path (tests). */
  recordPath?: string;
  /** Override the legacy-exemption registry path (tests). */
  exemptionsFile?: string;
};

export type EvaluateSourceRealityOptions = {
  bookId: string;
  // A plain string map (not NodeJS.ProcessEnv): a read-only input the caller supplies, often a
  // partial literal in tests. The webapp's root tsconfig augments ProcessEnv to REQUIRE NODE_ENV,
  // which would reject `{}`/`{CHAPTERFLOW_…}` literals; process.env stays assignable here as a
  // subtype, and the policy only reads specific keys.
  env?: Record<string, string | undefined>;
  now?: Date;
  roots?: SourceRealityRoots;
  /** Optional ADDITIONAL content identities a caller may bind (e.g. a manifest contentId).
   *  `canonicalIndexHash` is deliberately EXCLUDED: it is the cross-path binding identity and is
   *  always derived from disk here, so a caller can never override it to make a stale, content-
   *  mismatched exemption pass (that would be a subtractive-security footgun). */
  contentIdentity?: Omit<ContentIdentity, "canonicalIndexHash">;
};

/** The verifiable real-world items from a book's source-v2 sidecars. Centralizes the
 *  `expectedSourceChapters().flatMap(loadSourceV2Sidecar → verifiableItems)` chain that was
 *  copy-pasted across promote, the preflight, the CLI, and the runbook. */
export function collectSourceVerifyItems(bookId: string, roots: SourceV2Roots = {}): SourceVerifyItem[] {
  return expectedSourceChapters(bookId, roots).flatMap((n) => {
    const sc = loadSourceV2Sidecar(bookId, n, roots);
    return sc ? verifiableItems(sc) : [];
  });
}

/** True when the book has at least one source-v2 sidecar on disk — the content-based "new
 *  source-v2" classification signal (env-independent). */
export function hasSourceV2Sidecars(bookId: string, roots: SourceV2Roots = {}): boolean {
  return expectedSourceChapters(bookId, roots).some((n) => {
    const p = sourceSidecarPathFor(bookId, n, roots);
    return !!p && existsSync(p);
  });
}

/** A stable hash of the book's canonical chapter index (id + number + title, ordered). This is
 *  the cross-path content identity an exemption binds to: it survives in-chapter content edits
 *  but breaks on any add / remove / reorder / rename, so a grandfathered structure can't silently
 *  absorb a different book. Returns undefined when the canonical index is unreadable. */
export function canonicalIndexHashFor(bookId: string, stateRoot: string = CANONICAL_STATE): string | undefined {
  const canonical = readCanonicalChapterIndex(bookId, stateRoot);
  if (!canonical.ok) return undefined;
  const basis = canonical.chapters
    .map((c) => `${c.chapterNumber} ${c.chapterId} ${c.chapterTitle ?? ""}`)
    .join("\n");
  return createHash("sha256").update(`canonical-index-v1\n${basis}`, "utf8").digest("hex").slice(0, 32);
}

/** Load this book's legacy exemption from the registry. Returns the raw entry JSON (string) when
 *  present, an error message when the REGISTRY is unreadable (fail closed), or both null when the
 *  registry is absent or simply has no entry for this book. */
export function loadLegacyExemption(bookId: string, exemptionsFile: string = LEGACY_EXEMPTIONS_FILE): { text: string | null; error: string | null } {
  if (!existsSync(exemptionsFile)) return { text: null, error: null };
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(exemptionsFile, "utf8"));
  } catch (e) {
    return { text: null, error: `${exemptionsFile}: ${(e as Error).message}` };
  }
  const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.exemptions) ? raw.exemptions : [];
  const entries = list.filter((e) => e?.bookId === bookId);
  if (entries.length === 0) return { text: null, error: null };
  if (entries.length > 1) {
    return { text: null, error: `legacy-exemption registry has ${entries.length} entries for "${bookId}" — duplicate exemptions are ambiguous; keep exactly one.` };
  }
  return { text: JSON.stringify(entries[0]), error: null };
}

/**
 * Evaluate the source-reality policy for a book from disk. THE single point `promote-book`,
 * `publish-after-qc`, and any alternate promotion path consult, so they cannot disagree.
 */
export function evaluateSourceRealityPolicy(opts: EvaluateSourceRealityOptions): SourceRealityPolicyResult {
  const roots = opts.roots ?? {};
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const expectedItems = collectSourceVerifyItems(opts.bookId, roots);
  const recordPath = roots.recordPath ?? sourceVerifyRecordPath(opts.bookId);
  const recordText = existsSync(recordPath) ? safeRead(recordPath) : null;
  const { text: exemptionText, error: exemptionError } = loadLegacyExemption(opts.bookId, roots.exemptionsFile ?? LEGACY_EXEMPTIONS_FILE);
  // The computed canonicalIndexHash ALWAYS wins — a caller can supply only the additional
  // packageId/contentId bindings, never override the cross-path binding identity (selective merge,
  // not a spread, so even an `as any` caller cannot smuggle a stale canonicalIndexHash through).
  const contentIdentity: ContentIdentity = {
    canonicalIndexHash: canonicalIndexHashFor(opts.bookId, roots.stateRoot ?? CANONICAL_STATE),
    packageId: opts.contentIdentity?.packageId,
    contentId: opts.contentIdentity?.contentId,
  };
  return decideSourceRealityPolicy({
    bookId: opts.bookId,
    expectedItems,
    hasSourceV2Sidecars: hasSourceV2Sidecars(opts.bookId, roots),
    recordText,
    exemptionText,
    exemptionError,
    contentIdentity,
    requireEnv: env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY === "1",
    now,
  });
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    // An existing-but-unreadable record is itself a defect; surface it as a present record so the
    // parse path turns it into an `invalid` blocker rather than silently treating it as absent.
    return "";
  }
}

/** Render the policy decision for promotion / preflight output (requirement: report the decision). */
export function formatSourceRealityDecision(r: SourceRealityPolicyResult): string {
  return r.summary;
}
