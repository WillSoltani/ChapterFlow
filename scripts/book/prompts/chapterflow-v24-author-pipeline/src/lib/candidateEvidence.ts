import type { CandidateSnapshot } from "../books/candidateTypes.js";
import { canonicalJsonSha256 } from "./canonicalJson.js";

/**
 * The digest-bound file set a v25 CANDIDATE carries.
 *
 * A candidate-only book root has no `state/chapters`, no `state/qc`, no
 * `state/indexes` and no `.chapterflow/runs` — that is the defining property of
 * the v25 candidate route, not an accident of a half-built tree. Everything a
 * candidate release needs to evidence its own package therefore has to come out
 * of the candidate itself, which is exactly what this type is: the candidate's
 * logical paths mapped to the bytes `bookContentReader` already re-digested on
 * open (it recomputes the manifest digest and refuses a drifted inventory), plus
 * the candidate identity those bytes belong to.
 *
 * Nothing here reads a filesystem. The bytes arrive from a snapshot the caller
 * already opened, so a consumer cannot accidentally satisfy a candidate-regime
 * evidence gate out of ambient state.
 */
export type CandidateEvidence = Readonly<{
  candidateId: string;
  manifestDigest: string;
  files: ReadonlyMap<string, Uint8Array>;
}>;

/** The prefix that marks a manifest evidence path as CANDIDATE-relative rather
 *  than state/runs-relative. Recorded paths stay machine-independent (no absolute
 *  path ever reaches a payload), so the contentId is reproducible anywhere the
 *  candidate is. */
export const CANDIDATE_LOGICAL_PATH_SCHEME = "candidate:" as const;

export function candidateManifestPath(logicalPath: string): string {
  return `${CANDIDATE_LOGICAL_PATH_SCHEME}${logicalPath}`;
}

export function candidateEvidenceFromSnapshot(snapshot: CandidateSnapshot): CandidateEvidence {
  const files = new Map<string, Uint8Array>();
  for (const file of snapshot.files) files.set(file.logicalPath, file.bytes);
  return {
    candidateId: snapshot.manifest.candidateId,
    manifestDigest: snapshot.manifest.manifestDigest,
    files,
  };
}

function chapterKey(chapterNumber: number): string {
  return `ch${String(chapterNumber).padStart(2, "0")}`;
}

/** The compiler's per-chapter source packet. It is the candidate's OWN pointer to
 *  the chapter's source sidecar (`sourceSidecarPath`), which is why the sidecar
 *  is resolved through it rather than guessed by convention. */
export function candidateSourcePacketPath(chapterNumber: number): string {
  return `compiler/${chapterKey(chapterNumber)}/source-packet.json`;
}

/** R-046 — where a source-text run stages the FROZEN book text and its resolved
 *  chapter map inside the seed candidate. A CONTRACT between the research port
 *  that writes them and every later stage that reads the book's own words: the
 *  wave-2 editor pass resolves a chapter's span from exactly these two files, and
 *  a literal copied into that stage would drift the day this one moved. Both are
 *  absent on a model-memory run, where there is no frozen text. */
export const CANDIDATE_SOURCE_TEXT_LOGICAL_PATH = "inputs/research/source-text.txt";
export const CANDIDATE_CHAPTER_MAP_LOGICAL_PATH = "inputs/research/chapter-map.json";

/** Where `researchCandidateApplicationPort` stages a chapter's source sidecar.
 *  Used only when the chapter has no source packet to name it. */
export function candidateStagedSourceSidecarPath(chapterNumber: number): string {
  return `inputs/source/${chapterKey(chapterNumber)}.source.json`;
}

/** Where `assembleSections` writes a chapter's v21 artifact inside a candidate.
 *  This is the candidate's stand-in for `state/chapters/<id>.v21-native.chapter.json`:
 *  the UNSTRIPPED chapter, carrying `authoring.sourceAnchors`. */
export function candidateChapterArtifactPath(chapterId: string): string {
  return `content/chapters/${chapterId}.v21-native.chapter.json`;
}

export type CandidateJsonRead =
  | { ok: true; logicalPath: string; value: unknown; hash: string }
  | { ok: false; logicalPath: string; reason: "absent" | "unreadable"; message: string };

export function readCandidateJson(evidence: CandidateEvidence, logicalPath: string): CandidateJsonRead {
  const bytes = evidence.files.get(logicalPath);
  if (bytes === undefined) {
    return { ok: false, logicalPath, reason: "absent", message: `candidate ${evidence.candidateId} has no file at ${logicalPath}` };
  }
  try {
    const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    return { ok: true, logicalPath, value, hash: canonicalJsonSha256(value) };
  } catch (err) {
    return {
      ok: false,
      logicalPath,
      reason: "unreadable",
      message: `candidate ${evidence.candidateId} file ${logicalPath} is not valid JSON: ${(err as Error).message}`,
    };
  }
}

export type CandidateSourceSidecarResolution =
  | { ok: true; logicalPath: string; value: unknown; hash: string }
  | { ok: false; message: string };

/**
 * The per-chapter source sidecar a candidate carries, resolved the way the
 * candidate itself names it.
 *
 * ORDER IS FIXED AND DETERMINISTIC, because the resolved logical path is
 * recorded in the manifest payload and therefore hashed into the contentId:
 *
 *  1. `compiler/chNN/source-packet.json` → its `sourceSidecarPath` field. The
 *     compiler wrote that pointer when it built the chapter, so this is the
 *     candidate's own answer to "which file is this chapter's source?". The
 *     packet's `chapterId` must agree with the chapter being evidenced, or the
 *     pointer belongs to a different chapter and is refused rather than followed.
 *  2. `inputs/source/chNN.source.json` — the staging location
 *     `researchCandidateApplicationPort` writes to — for a candidate with no
 *     packet for that chapter.
 *
 * A chapter whose sidecar is genuinely absent from the candidate resolves to
 * `ok: false`, and the caller still raises PPKG.source_missing. The gate is
 * re-pointed at the candidate, not removed.
 */
export function resolveCandidateSourceSidecar(
  evidence: CandidateEvidence,
  chapterNumber: number,
  chapterId: string,
): CandidateSourceSidecarResolution {
  const reasons: string[] = [];
  const packetPath = candidateSourcePacketPath(chapterNumber);
  const packet = readCandidateJson(evidence, packetPath);
  if (packet.ok) {
    const value = packet.value as { sourceSidecarPath?: unknown; chapterId?: unknown };
    const named = typeof value?.sourceSidecarPath === "string" ? value.sourceSidecarPath : null;
    const packetChapterId = typeof value?.chapterId === "string" ? value.chapterId : null;
    if (named === null) {
      reasons.push(`${packetPath} names no sourceSidecarPath`);
    } else if (packetChapterId !== null && packetChapterId !== chapterId) {
      reasons.push(`${packetPath} belongs to ${packetChapterId}, not ${chapterId}`);
    } else {
      const sidecar = readCandidateJson(evidence, named);
      if (sidecar.ok) return { ok: true, logicalPath: named, value: sidecar.value, hash: sidecar.hash };
      reasons.push(sidecar.message);
    }
  } else if (packet.reason === "unreadable") {
    reasons.push(packet.message);
  }

  const stagedPath = candidateStagedSourceSidecarPath(chapterNumber);
  const staged = readCandidateJson(evidence, stagedPath);
  if (staged.ok) return { ok: true, logicalPath: stagedPath, value: staged.value, hash: staged.hash };
  reasons.push(staged.message);

  return { ok: false, message: reasons.join("; ") };
}

/**
 * ANTI-DOWNGRADE PROBE (adversarial review): the authoring-provenance gate arms
 * on source-v2, and the packet's `sourceSidecarPath` pointer is writer-declared
 * — so a chapter could point its packet at a decoy (or at the chapter artifact
 * itself) and silently disarm the gate while an honest source-v2 sidecar sat at
 * the staged location. The gate therefore asks THIS question, which pointer
 * games cannot answer differently: does ANY of the chapter's candidate source
 * locations hold a source-v2 sidecar? If yes, the chapter IS source-v2 and the
 * gate arms, whatever the pointer resolved to.
 */
export function candidateChapterHasSourceV2(
  evidence: CandidateEvidence,
  chapterNumber: number,
): boolean {
  for (const path of [candidateStagedSourceSidecarPath(chapterNumber)]) {
    const parsed = readCandidateJson(evidence, path);
    if (parsed.ok && (parsed.value as { schemaVersion?: unknown })?.schemaVersion === "source-v2") return true;
  }
  return false;
}
