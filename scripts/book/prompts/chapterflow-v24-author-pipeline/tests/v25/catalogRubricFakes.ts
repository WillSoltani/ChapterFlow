/**
 * Shared hermetic fakes for the whole-book catalog-rubric stage.
 *
 * Deliberately NOT named `*.test.ts`: the v25 runner discovers test files by
 * that suffix and would spawn this one with no cases.
 *
 * `scriptedRubricPanel` is the seam the book-run service depends on. It does no
 * model work at all — the panel's OWN model seam (three readers, the bounded
 * retry, the fail-closed classification) is exercised against a scripted
 * `ModelTaskRunner` in `v4-catalog-rubric-stage.test.ts` through the REAL
 * `CatalogRubricPanelEvaluator`. This fake exists so book-run-level tests can
 * script a verdict without also scripting three whole-book model calls, and it
 * counts its invocations so "a resume spends nothing" is an assertion about
 * calls, not a hope.
 */

import type {
  CatalogRubricPanel,
  CatalogRubricPanelRequest,
} from "../../src/app/catalogRubricPanelEvaluator.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../../src/artifacts/artifactTypes.js";
import {
  CATALOG_RUBRIC_INSTRUMENT_VERSION,
  CATALOG_RUBRIC_TEXTURE_AXES,
  type CatalogRubricReaderResultV1,
  type CatalogRubricSeverity,
  type CatalogRubricTextureAxis,
} from "../../src/review/catalogRubric.js";
import type { CatalogRubricRecordV1 } from "../../src/review/catalogRubricStore.js";
import type { Result } from "../../src/contracts/v4Core.js";

export type FakeReaderSpec = Readonly<{
  /** Every factor takes this score unless overridden. */
  base?: number;
  gate?: "PASS" | "FAIL";
  gateFailures?: string;
  churn?: CatalogRubricSeverity;
  /** Every texture axis takes this severity unless overridden. */
  texture?: CatalogRubricSeverity;
  textureAxes?: Partial<Record<CatalogRubricTextureAxis, CatalogRubricSeverity>>;
  apparatusQuotes?: string;
  factors?: Partial<Record<ReviewFactor, number>>;
}>;

export function fakeReader(number: number, spec: FakeReaderSpec = {}): CatalogRubricReaderResultV1 {
  const base = spec.base ?? 84;
  const scores = Object.fromEntries(
    REVIEW_FACTORS.map((factor) => [factor, spec.factors?.[factor] ?? base]),
  ) as Record<ReviewFactor, number>;
  const texture = Object.fromEntries(
    CATALOG_RUBRIC_TEXTURE_AXES.map((axis) => [axis, spec.textureAxes?.[axis] ?? spec.texture ?? "LOW"]),
  ) as Record<CatalogRubricTextureAxis, CatalogRubricSeverity>;
  return {
    reader: number,
    gateVerdict: spec.gate ?? "PASS",
    gateFailures: spec.gateFailures ?? "none",
    scores,
    churn: spec.churn ?? "LOW",
    texture,
    apparatusQuotes: spec.apparatusQuotes ?? "none",
    textureNote: `fake reader ${number}: no dominant repeated shape`,
    note: `fake reader ${number}`,
  };
}

/** Three readers that all score `base` and all pass the correctness gate. */
export function unanimousReaders(base: number, spec: FakeReaderSpec = {}): readonly CatalogRubricReaderResultV1[] {
  return [1, 2, 3].map((number) => fakeReader(number, { ...spec, base }));
}

export type ScriptedRubricPanel = CatalogRubricPanel & {
  /** How many times the panel was actually asked to score. A replay must not
   *  move this. */
  readonly calls: () => number;
  readonly requests: () => readonly CatalogRubricPanelRequest[];
};

/**
 * A panel whose outcome is scripted per call. `readers` produces a record for
 * that invocation; an `error` entry makes the panel fail exactly the way the
 * real evaluator fails on infrastructure — an ERROR that is neither a PASS nor
 * a FAIL.
 */
export function scriptedRubricPanel(
  script: readonly (
    | { readonly readers: readonly CatalogRubricReaderResultV1[] }
    | { readonly error: Readonly<{ code: string; message: string }> }
  )[],
): ScriptedRubricPanel {
  const queue = [...script];
  const requests: CatalogRubricPanelRequest[] = [];
  let calls = 0;
  return {
    calls: () => calls,
    requests: () => requests,
    async score(request: CatalogRubricPanelRequest): Promise<Result<CatalogRubricRecordV1>> {
      calls += 1;
      requests.push(request);
      const step = queue.shift();
      if (step === undefined) throw new Error("scriptedRubricPanel: called more times than scripted");
      if ("error" in step) return { ok: false, error: { code: step.error.code, message: step.error.message } };
      const chapterNumbers = request.candidate.files
        .filter((file) => file.kind === "CHAPTER")
        .map((_file, index) => index + 1);
      return {
        ok: true,
        value: {
          schemaVersion: "1",
          instrumentVersion: CATALOG_RUBRIC_INSTRUMENT_VERSION,
          bookId: request.bookId,
          candidate: {
            candidateId: request.candidate.manifest.candidateId,
            manifestDigest: request.candidate.manifest.manifestDigest,
          },
          title: request.title,
          author: request.author,
          totalChapters: chapterNumbers.length,
          sampledChapterNumbers: chapterNumbers,
          documentSha256: "0".repeat(64),
          readers: step.readers,
          completedAt: request.completedAt,
        },
      };
    },
  };
}

/** The default composition every pre-existing book-run test wants: a panel that
 *  scores every candidate `base` across the board, clearing the default bar of
 *  80. Those tests are about other lanes; this keeps the new gate from changing
 *  what they assert while still forcing them through it. Unlike
 *  `scriptedRubricPanel` it never runs out of script. */
export function passingRubricPanel(base = 84): ScriptedRubricPanel {
  const readers = unanimousReaders(base);
  const requests: CatalogRubricPanelRequest[] = [];
  let calls = 0;
  return {
    calls: () => calls,
    requests: () => requests,
    async score(request: CatalogRubricPanelRequest): Promise<Result<CatalogRubricRecordV1>> {
      calls += 1;
      requests.push(request);
      return scriptedRubricPanel([{ readers }]).score(request);
    },
  };
}
