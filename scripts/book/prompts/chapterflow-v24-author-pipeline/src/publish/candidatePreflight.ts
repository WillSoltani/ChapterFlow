/**
 * publishPreflightVerify — the publish chain's ONE verification entry point, made
 * candidate-regime aware and honest about how strongly it verified.
 *
 * WHY THIS MODULE EXISTS (measured, not assumed):
 *
 * The v25 candidate route released its first pair — reader package at
 * `book-packages/<id>.v21.json` plus a production-manifest sidecar at
 * `state/books/<id>.production-manifest.json` whose payload carries
 * `candidateChapterSet` + `candidateQcEvidence` instead of `canonicalIndex`. The
 * publish chain (publishFinal / publishToLive / register-web) verified that pair
 * by calling `verifyProductionPackage({ packagePath })` with nothing else.
 *
 * Two facts about that call, both established by running it:
 *
 *  1. It is NOT broken on a candidate pair sitting at the canonical paths. The
 *     verifier derives the sidecar from `stateRoot + bookId` when `manifestPath`
 *     is omitted, so the released Franklin pair verifies PASS today. What the
 *     bare call actually loses is CONTROL: the sidecar path is implicit, so a
 *     caller that overrides the package location (publishFinal's
 *     `localPackagePath`, publishToLive's `localPackagePath`) still resolves the
 *     sidecar against `CANONICAL_STATE`, silently pairing a package with a
 *     sidecar that is not its own. This module always passes `manifestPath`
 *     explicitly, defaulting to exactly the path the verifier would have derived
 *     — so the canonical layout is byte-identical and the overridden layout stops
 *     guessing.
 *
 *  2. It runs at the WEAKER of the two available strengths and does not say so.
 *     Without the candidate, the candidate regime's per-chapter evidence is
 *     REPLAYED from what the manifest recorded (see
 *     `recordedCandidateChapterEvidenceResolver`), which proves the pair is
 *     internally consistent and nothing more.
 *
 * THE RESIDUAL, AND WHAT ACTUALLY CLOSES IT.
 *
 * #504 disclosed that a wholesale re-authoring of BOTH files passes a two-file
 * verify. That was reproduced here against the real released pair: dropping ch04
 * from the package, dropping it from `payload.chapters` and
 * `payload.candidateChapterSet.chapters`, re-deriving the chapter-set
 * `semanticHash` and re-deriving `payloadHash`/`contentId` yields a 3-chapter pair
 * that verifies PASS with a recomputed contentId, while still declaring the TRUE
 * `candidateId@manifestDigest`.
 *
 * Because the forgery keeps the true identity, two things that look like fixes
 * are not, and both were measured rather than reasoned about:
 *
 *   - `expectedChapterSetSource` alone does NOT catch it. That layer
 *     string-compares the manifest's DECLARATION against the caller's
 *     expectation, and the forger left the declaration honest. (Its own doc
 *     comment says this; the probe agreed — the forged pair passed Layer 1.)
 *
 *   - Supplying `candidateEvidence` alone does NOT catch it either. The
 *     recompute resolves evidence FOR EACH PACKAGED CHAPTER out of the candidate,
 *     and all three surviving chapters really are in the candidate. The
 *     loose-state comparison it enables (`compareCandidateChapters`) iterates
 *     `pkg.chapters` only, so a chapter present in the CANDIDATE but absent from
 *     the PACKAGE is invisible to it. The forged pair passed the full recompute.
 *
 * What closes it is the check neither of those performs: the candidate's OWN
 * chapter inventory — the `kind: "CHAPTER"` entries of the content-addressed
 * candidate manifest, re-digested by `bookContentReader` on open — must equal the
 * package's chapter set. The candidate is addressed by the `manifestDigest` the
 * CURRENT pointer names, so that inventory is an authority that exists entirely
 * outside the two files under test. A forger who drops a chapter from the package
 * must also drop it from the candidate, which changes the candidate's digest,
 * which no longer matches the pointer.
 *
 * That check lives HERE rather than inside `verifyProductionPackage` on purpose:
 * it needs the snapshot's kind-tagged entries, which `CandidateEvidence`
 * (a bare logicalPath→bytes map) does not carry, and keeping it out of the shared
 * verifier means every existing caller — including the legacy canonical-index
 * publish path and the release adapter's self-verify — keeps its exact behaviour.
 *
 * STRENGTHS, and the rule that they are never silently downgraded:
 *
 *   "candidate-store-reverify"     — operator supplied --v25-root. The CURRENT
 *                                    pointer is read, the sidecar's declared
 *                                    candidate identity must EQUAL it, the
 *                                    candidate is opened from the content-
 *                                    addressed store, its chapter inventory is
 *                                    compared against the package, and the
 *                                    evidence is fully recomputed from its bytes.
 *   "recorded-evidence-replay"     — no --v25-root, candidate-regime pair. Today's
 *                                    behaviour, unchanged, and NAMED in the output.
 *   "legacy-canonical-index"       — no --v25-root, canonical-index pair. Today's
 *                                    behaviour, unchanged.
 *
 * A `--v25-root` that cannot deliver the strong mode FAILS rather than quietly
 * falling back: an operator who asked for candidate-store re-verification and got
 * a replay would be told the wrong thing about what was proven.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { CandidateSnapshot } from "../books/candidateTypes.js";
import { candidateChapterArtifactPath, candidateEvidenceFromSnapshot } from "../lib/candidateEvidence.js";
import { CANONICAL_STATE, normSlug } from "../lib/chapterPaths.js";
import {
  verifyProductionPackage,
  formatVerifyProductionPackageResult,
  type ProductionPackageVerificationFinding,
  type VerifyProductionPackageResult,
} from "../verifyProductionPackage.js";

/** What a publish verb's `verify` seam may return in place of a bare boolean.
 *  Declared here so publishFinal and publishToLive share ONE definition. */
export type PreflightOutcome = { ok: boolean; detail: string };

/** How strongly the preflight was able to verify. Always reported. */
export type PublishPreflightStrength =
  | "candidate-store-reverify"
  | "recorded-evidence-replay"
  | "legacy-canonical-index";

export type PublishPreflightResult = {
  ok: boolean;
  bookId: string;
  packagePath: string;
  /** The sidecar path actually used — explicit, never guessed downstream. */
  manifestPath: string;
  strength: PublishPreflightStrength;
  /** One line naming the strength, for the publish chain's step detail. */
  detail: string;
  findings: ProductionPackageVerificationFinding[];
  /** The verifier's own result, when it got as far as running. */
  verification?: VerifyProductionPackageResult;
  /** The CURRENT pointer identity the strong mode checked against. */
  pointer?: { candidateId: string; manifestDigest: string; revision: number };
};

export type PublishPreflightOptions = {
  bookId: string;
  packagePath: string;
  /** Explicit sidecar path. Default: `<stateRoot>/books/<bookId>.production-manifest.json`,
   *  which is exactly what verifyProductionPackage derives when it is omitted. */
  manifestPath?: string;
  /** OPT-IN. Absolute path to the v25 root (the dir holding `books/`). When given,
   *  the preflight runs candidate-store re-verification and REFUSES if it cannot. */
  v25Root?: string;
  stateRoot?: string;
  compareLooseState?: boolean;
  /** Candidate-snapshot opener seam (tests). Default opens the real store. */
  openCandidate?: CandidateOpener;
  /** CURRENT-pointer reader seam (tests). Default reads the real pointer store. */
  readPointer?: PointerReader;
};

export type CandidateOpener = (input: {
  booksRoot: string;
  bookId: string;
  candidateId: string;
}) => Promise<{ ok: true; snapshot: CandidateSnapshot } | { ok: false; code: string; message: string }>;

export type PointerReader = (input: {
  booksRoot: string;
  bookId: string;
}) => Promise<
  | { ok: true; pointer: { candidateId: string; manifestDigest: string; revision: number } | null }
  | { ok: false; code: string; message: string }
>;

function blocker(args: Omit<ProductionPackageVerificationFinding, "severity">): ProductionPackageVerificationFinding {
  return { severity: "blocker", ...args };
}

/** The sidecar path the verifier would derive on its own. Kept in lockstep with
 *  verifyProductionPackage.defaultSidecarPath so the default stays a no-op. */
export function defaultManifestPathForBook(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "books", `${normSlug(bookId)}.production-manifest.json`);
}

type DeclaredCandidate = { candidateId: string; manifestDigest: string };

/** Read the sidecar's DECLARED candidate identity, without trusting anything else
 *  in the file. Returns null for a legacy (canonical-index) or unreadable sidecar
 *  — the verifier is the authority on whether the sidecar is well-formed, and it
 *  runs regardless. */
export function readDeclaredCandidate(manifestPath: string): DeclaredCandidate | null {
  if (!existsSync(manifestPath)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  } catch {
    return null;
  }
  const block = (parsed as { manifest?: { payload?: { candidateChapterSet?: unknown } } })
    ?.manifest?.payload?.candidateChapterSet as { candidateId?: unknown; manifestDigest?: unknown } | undefined;
  if (!block || typeof block !== "object") return null;
  if (typeof block.candidateId !== "string" || block.candidateId.length === 0) return null;
  if (typeof block.manifestDigest !== "string" || block.manifestDigest.length === 0) return null;
  return { candidateId: block.candidateId, manifestDigest: block.manifestDigest };
}

/** The chapter ids a candidate ACTUALLY carries, from its kind-tagged, digest-
 *  verified inventory. This is the authority the two shipped files cannot forge:
 *  changing it changes the candidate's manifestDigest, which the CURRENT pointer
 *  names. Entries that are not chapter artifacts are ignored; an entry whose path
 *  is not the conventional chapter-artifact path for its own id is NOT silently
 *  accepted — it simply does not contribute an id, and the count comparison below
 *  then reports the discrepancy. */
export function candidateChapterIds(snapshot: CandidateSnapshot): string[] {
  const ids: string[] = [];
  for (const entry of snapshot.files) {
    if (entry.kind !== "CHAPTER") continue;
    const match = /^content\/chapters\/(.+)\.v21-native\.chapter\.json$/.exec(entry.logicalPath);
    if (!match) continue;
    if (candidateChapterArtifactPath(match[1]) !== entry.logicalPath) continue;
    ids.push(match[1]);
  }
  return ids;
}

/**
 * THE RESIDUAL-CLOSING CHECK. The package's chapter set must be exactly the
 * candidate's chapter inventory — same count, same ids, neither direction
 * tolerated. `compareCandidateChapters` inside the verifier already covers
 * "packaged chapter differs from / is missing in the candidate"; the direction it
 * does not cover, and the one the re-authored-pair forgery relies on, is a chapter
 * the CANDIDATE has that the package dropped.
 */
export function compareCandidateInventory(
  packagedChapterIds: readonly string[],
  snapshot: CandidateSnapshot,
): ProductionPackageVerificationFinding[] {
  const findings: ProductionPackageVerificationFinding[] = [];
  const candidateIds = candidateChapterIds(snapshot);
  const candidateSet = new Set(candidateIds);
  const packagedSet = new Set(packagedChapterIds);

  if (candidateIds.length !== packagedChapterIds.length) {
    findings.push(blocker({
      checkId: "PPKG.candidate_inventory_count_mismatch",
      message:
        `Package ships ${packagedChapterIds.length} chapter(s), but candidate ` +
        `${snapshot.manifest.candidateId}@${snapshot.manifest.manifestDigest} carries ${candidateIds.length} ` +
        "chapter artifact(s). A released package must be the candidate's whole chapter set.",
      expected: candidateIds.length,
      actual: packagedChapterIds.length,
    }));
  }
  for (const id of candidateIds) {
    if (!packagedSet.has(id)) {
      findings.push(blocker({
        checkId: "PPKG.candidate_inventory_chapter_dropped",
        message:
          `Candidate ${snapshot.manifest.candidateId} carries chapter ${id}, but the package does not ship it. ` +
          "The pair was re-authored over a smaller chapter set than the candidate the pointer names.",
        expected: id,
      }));
    }
  }
  for (const id of packagedChapterIds) {
    if (!candidateSet.has(id)) {
      findings.push(blocker({
        checkId: "PPKG.candidate_inventory_chapter_foreign",
        message:
          `Package ships chapter ${id}, which candidate ${snapshot.manifest.candidateId} does not carry.`,
        actual: id,
      }));
    }
  }
  return findings;
}

const defaultReadPointer: PointerReader = async ({ booksRoot, bookId }) => {
  const [{ createBookWriteLock }, { createCurrentPointerStore }] = await Promise.all([
    import("../books/bookLease.js"),
    import("../books/currentPointer.js"),
  ]);
  // read() never acquires the lock and never creates a directory, so constructing
  // the store cannot mutate the v25 root the operator pointed us at.
  const store = createCurrentPointerStore({ booksRoot, writeLock: createBookWriteLock({ booksRoot }) });
  const read = await store.read(bookId);
  if (!read.ok) return { ok: false, code: read.error.code, message: read.error.message };
  return {
    ok: true,
    pointer: read.value === null
      ? null
      : { candidateId: read.value.candidateId, manifestDigest: read.value.manifestDigest, revision: read.value.revision },
  };
};

const defaultOpenCandidate: CandidateOpener = async ({ booksRoot, bookId, candidateId }) => {
  const [{ createBookWriteLock }, { createCurrentPointerStore }, { createBookContentReader }] = await Promise.all([
    import("../books/bookLease.js"),
    import("../books/currentPointer.js"),
    import("../books/bookContentReader.js"),
  ]);
  const currentPointerStore = createCurrentPointerStore({ booksRoot, writeLock: createBookWriteLock({ booksRoot }) });
  const reader = createBookContentReader({ booksRoot, currentPointerStore });
  const opened = await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
  if (!opened.ok) return { ok: false, code: opened.error.code, message: opened.error.message };
  return { ok: true, snapshot: opened.value };
};

function strengthLine(
  strength: PublishPreflightStrength,
  ok: boolean,
  extra: string,
): string {
  const verdict = ok ? "PASS" : "FAIL";
  switch (strength) {
    case "candidate-store-reverify":
      return `verifyProductionPackage ${verdict} — strength: candidate-store re-verify (CURRENT pointer + candidate inventory + evidence recomputed from candidate bytes)${extra}`;
    case "recorded-evidence-replay":
      return `verifyProductionPackage ${verdict} — strength: recorded-evidence replay (candidate regime, no --v25-root; the candidate itself was NOT re-read)${extra}`;
    case "legacy-canonical-index":
      return `verifyProductionPackage ${verdict} — strength: canonical-index (legacy regime)${extra}`;
  }
}

/**
 * Verify a package+sidecar pair for the publish chain.
 *
 * Without `v25Root` this is today's verification with the sidecar path made
 * explicit, plus a line saying which strength ran. With `v25Root` it additionally
 * pins the pair to the CURRENT pointer and re-reads the candidate from the
 * content-addressed store.
 */
export async function publishPreflightVerify(options: PublishPreflightOptions): Promise<PublishPreflightResult> {
  const bookId = normSlug(options.bookId);
  const packagePath = resolve(options.packagePath);
  const stateRoot = options.stateRoot ?? CANONICAL_STATE;
  const manifestPath = options.manifestPath
    ? resolve(options.manifestPath)
    : defaultManifestPathForBook(bookId, stateRoot);

  const declared = readDeclaredCandidate(manifestPath);
  const base = { bookId, packagePath, manifestPath };

  // ── Weak (today's) mode: no v25 root supplied ────────────────────────────────
  if (options.v25Root === undefined) {
    const strength: PublishPreflightStrength = declared === null ? "legacy-canonical-index" : "recorded-evidence-replay";
    const verification = verifyProductionPackage({
      packagePath,
      manifestPath,
      stateRoot: options.stateRoot,
      ...(options.compareLooseState === undefined ? {} : { compareLooseState: options.compareLooseState }),
    });
    return {
      ...base,
      ok: verification.ok,
      strength,
      detail: strengthLine(strength, verification.ok, ""),
      findings: verification.findings,
      verification,
    };
  }

  // ── Strong mode: --v25-root supplied. Never falls back. ─────────────────────
  const booksRoot = resolve(options.v25Root, "books");
  const strength: PublishPreflightStrength = "candidate-store-reverify";
  const refuse = (findings: ProductionPackageVerificationFinding[], extra: string): PublishPreflightResult => ({
    ...base,
    ok: false,
    strength,
    detail: strengthLine(strength, false, extra),
    findings,
  });

  const readPointer = options.readPointer ?? defaultReadPointer;
  const pointerRead = await readPointer({ booksRoot, bookId });
  if (!pointerRead.ok) {
    return refuse([blocker({
      checkId: "PPKG.v25_pointer_unreadable",
      path: booksRoot,
      message: `Could not read the v25 CURRENT pointer for ${bookId} under ${booksRoot}: ${pointerRead.code} ${pointerRead.message}`,
    })], " — CURRENT pointer unreadable");
  }
  if (pointerRead.pointer === null) {
    return refuse([blocker({
      checkId: "PPKG.v25_pointer_missing",
      path: booksRoot,
      message:
        `--v25-root was supplied but ${booksRoot} has no CURRENT pointer for ${bookId}. The strong preflight cannot ` +
        "run, and it does not silently fall back to the recorded-evidence replay.",
    })], " — no CURRENT pointer for this book");
  }
  const pointer = pointerRead.pointer;
  const withPointer = (r: PublishPreflightResult): PublishPreflightResult => ({ ...r, pointer });

  // (b) The sidecar's DECLARED candidate identity must equal the pointer's. A
  //     legacy (canonical-index) sidecar has no declaration at all, and is refused
  //     here rather than allowed to dodge the pointer by downgrading its regime.
  if (declared === null) {
    return withPointer(refuse([blocker({
      checkId: "PPKG.v25_pointer_regime_mismatch",
      path: manifestPath,
      message:
        `The v25 CURRENT pointer names candidate ${pointer.candidateId}@${pointer.manifestDigest} (revision ` +
        `${pointer.revision}), but the sidecar declares no candidate chapter-set source. A canonical-index sidecar ` +
        "cannot be published against a candidate pointer.",
      expected: `${pointer.candidateId}@${pointer.manifestDigest}`,
      actual: "canonical-index",
    })], " — sidecar is not candidate-declared"));
  }
  if (declared.candidateId !== pointer.candidateId || declared.manifestDigest !== pointer.manifestDigest) {
    return withPointer(refuse([blocker({
      checkId: "PPKG.v25_pointer_mismatch",
      path: manifestPath,
      message:
        `Sidecar declares candidate ${declared.candidateId}@${declared.manifestDigest}, but the v25 CURRENT pointer ` +
        `names ${pointer.candidateId}@${pointer.manifestDigest} (revision ${pointer.revision}). The released pair must ` +
        "be the candidate the pointer published.",
      expected: `${pointer.candidateId}@${pointer.manifestDigest}`,
      actual: `${declared.candidateId}@${declared.manifestDigest}`,
    })], " — sidecar/pointer candidate mismatch"));
  }

  // (c) Open the candidate from the content-addressed store, by the identity the
  //     POINTER named (not the one the sidecar declared — they are equal by the
  //     check above, and reading from the pointer keeps the authority outside the
  //     pair even if that check is ever loosened).
  const openCandidate = options.openCandidate ?? defaultOpenCandidate;
  const opened = await openCandidate({ booksRoot, bookId, candidateId: pointer.candidateId });
  if (!opened.ok) {
    return withPointer(refuse([blocker({
      checkId: "PPKG.v25_candidate_unavailable",
      path: booksRoot,
      message:
        `Could not open candidate ${pointer.candidateId} for ${bookId} from ${booksRoot}: ` +
        `${opened.code} ${opened.message}`,
    })], " — candidate unavailable"));
  }
  const snapshot = opened.snapshot;
  if (snapshot.manifest.manifestDigest !== pointer.manifestDigest) {
    return withPointer(refuse([blocker({
      checkId: "PPKG.v25_candidate_digest_mismatch",
      path: booksRoot,
      message:
        `Candidate ${pointer.candidateId} opened with manifest digest ${snapshot.manifest.manifestDigest}, but the ` +
        `CURRENT pointer names ${pointer.manifestDigest}.`,
      expected: pointer.manifestDigest,
      actual: snapshot.manifest.manifestDigest,
    })], " — candidate digest disagrees with the pointer"));
  }

  // (d) Full recompute: caller-side expectation + evidence recomputed from the
  //     candidate's bytes, with the loose-state comparison armed.
  const verification = verifyProductionPackage({
    packagePath,
    manifestPath,
    stateRoot: options.stateRoot,
    compareLooseState: true,
    expectedChapterSetSource: { kind: "candidate", candidateId: pointer.candidateId, manifestDigest: pointer.manifestDigest },
    candidateEvidence: candidateEvidenceFromSnapshot(snapshot),
  });

  // (e) The inventory check the verifier structurally cannot do — see the module
  //     header. This is what makes the re-authored pair fail.
  let packagedIds: string[] = [];
  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { chapters?: unknown };
    packagedIds = (Array.isArray(pkg.chapters) ? pkg.chapters : [])
      .map((chapter) => (chapter as { chapterId?: unknown })?.chapterId)
      .filter((id): id is string => typeof id === "string");
  } catch {
    // An unreadable/malformed package is already a blocker from the verifier
    // above (PPKG.package_unreadable / PPKG.package_malformed); the inventory
    // check simply has nothing to compare and adds no finding of its own.
    packagedIds = [];
  }
  const inventory = packagedIds.length === 0 && !verification.ok
    ? []
    : compareCandidateInventory(packagedIds, snapshot);

  const findings = [...verification.findings, ...inventory];
  const ok = findings.length === 0;
  return withPointer({
    ...base,
    ok,
    strength,
    detail: strengthLine(
      strength,
      ok,
      ` — candidate ${pointer.candidateId}@${pointer.manifestDigest.slice(0, 12)}… revision ${pointer.revision}`,
    ),
    findings,
    verification,
  });
}

/** Human-readable preflight report: the strength line, then the verifier's own
 *  report, then any inventory findings the verifier did not produce. */
export function formatPublishPreflightResult(result: PublishPreflightResult): string {
  const lines: string[] = [result.detail];
  lines.push(`  package:  ${result.packagePath}`);
  lines.push(`  sidecar:  ${result.manifestPath}`);
  if (result.pointer) {
    lines.push(`  pointer:  ${result.pointer.candidateId}@${result.pointer.manifestDigest} (revision ${result.pointer.revision})`);
  }
  if (result.verification) {
    for (const line of formatVerifyProductionPackageResult(result.verification).split("\n")) lines.push(`  ${line}`);
  }
  const verifierIds = new Set((result.verification?.findings ?? []).map((f) => `${f.checkId} ${f.message}`));
  for (const finding of result.findings) {
    if (verifierIds.has(`${finding.checkId} ${finding.message}`)) continue;
    lines.push(`  [${finding.checkId}] ${finding.message}`);
  }
  return lines.join("\n");
}
