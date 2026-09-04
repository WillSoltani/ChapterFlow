/**
 * SOURCE-FIDELITY JUDGE — the hermetic proof that a chapter is checked against
 * the book before it can ship (WP source-fidelity-judge; R-077, R-136, R-150).
 *
 * Every case here is model-free: the judge's model call is an injected `ask`
 * (unit level) or an injected `ModelTaskRunner` returning scripted JSON
 * (evaluator level), so the whole family — verdict mapping, provenance split,
 * citation verification, chunk merge, fail-closed ERROR — is decided by this
 * file and never by a provider.
 *
 * The binding fixture is a 20 KB slice of the Gutenberg Autobiography
 * (tests/fixtures/franklin-autobiography-proprietaries-slice.txt) carrying the
 * passage the SHIPPED revision-6 chapter 4 contradicted.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SOURCE_FIDELITY_CONTRADICTED_CODE,
  SOURCE_FIDELITY_EXPLANATION_CODE,
  SOURCE_FIDELITY_KEY_CODE,
  SOURCE_FIDELITY_MAX_CONTEXT_CHARS,
  SOURCE_FIDELITY_UNSUPPORTED_CODE,
  chapterFidelitySurfaces,
  chunkSourceContext,
  classifySourceFidelityFindings,
  detectCheckableKinds,
  judgeChapterSourceFidelity,
  sourceFidelityVetoDisagreement,
  type SourceFidelityFinding,
} from "../../src/critics/semantic/sourceFidelityJudge.js";
import { finishV25Tests, requiredTest } from "./harness.js";
import { FRANKLIN_PROPRIETARIES_SLICE_PATH, makeGateCleanChapter } from "../helpers.js";

const SLICE = readFileSync(FRANKLIN_PROPRIETARIES_SLICE_PATH, "utf8");

/** The exact source line the shipped revision-6 chapter contradicted. */
const SOURCE_LINE = "it was concluded that I should give them the heads of our complaints in writing";
/** The exact false sentence the shipped revision-6 chapter 4 carried. */
const REV6_ERROR = "The brothers will not meet him.";

function franklinChapter() {
  const chapter = makeGateCleanChapter("franklin-fidelity", 4);
  chapter.keyTakeaway = `${REV6_ERROR} ${chapter.keyTakeaway}`.slice(0, 220);
  return chapter;
}

requiredTest("the fixture carries the source line the shipped chapter contradicted", () => {
  assert.ok(SLICE.length > 15_000 && SLICE.length < 25_000, `fixture is ${SLICE.length} characters`);
  // The source text wraps mid-sentence; the quote matcher folds whitespace, so
  // the line is present as one run even though the file breaks it across lines.
  assert.ok(SLICE.includes("heads\nof our complaints in writing"));
  assert.ok(SLICE.includes("they agreed to a meeting with me at Mr. T. Penn's house"));
});

requiredTest("a contradicted chapter claim with a verified source quote is an SF1 BLOCKER", async () => {
  const chapter = franklinChapter();
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({
      findings: [{
        surface: "chapter/keyTakeaway",
        quote: REV6_ERROR,
        claim: "The Penn brothers refused to meet Franklin.",
        verdict: "contradicted",
        sourceQuote: SOURCE_LINE,
        checkableKind: "sequence",
        note: "The source records a meeting that produced a written statement of complaints.",
      }] satisfies SourceFidelityFinding[],
    }),
  });
  const classified = classifySourceFidelityFindings(report);
  const blocker = classified.issues.find((issue) => issue.code === SOURCE_FIDELITY_CONTRADICTED_CODE);
  assert.ok(blocker, JSON.stringify(classified.issues, null, 2));
  assert.equal(blocker.severity, "BLOCKER");
  assert.ok(blocker.message.includes(SOURCE_LINE), "the BLOCKER carries the source line verbatim");
  assert.ok(blocker.message.includes(REV6_ERROR), "the BLOCKER carries the chapter's own words");
  assert.equal(classified.verdict.gate, "RED");
  assert.equal(classified.axis.axis, "factual_accuracy");
  assert.equal(classified.axis.tier, "CORRUPTION");
});

requiredTest("a contradiction whose source quote is NOT in the span cannot mint a blocker", async () => {
  const chapter = franklinChapter();
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({
      findings: [{
        surface: "chapter/keyTakeaway",
        quote: REV6_ERROR,
        claim: "The Penn brothers refused to meet Franklin.",
        verdict: "contradicted",
        sourceQuote: "the proprietaries never once consented to receive him at Spring Garden",
        checkableKind: "sequence",
        note: "fabricated citation",
      }],
    }),
  });
  const classified = classifySourceFidelityFindings(report);
  const issue = classified.issues.find((entry) => entry.code === SOURCE_FIDELITY_CONTRADICTED_CODE);
  assert.ok(issue);
  assert.equal(issue.severity, "WARN", "an uncited contradiction is reported, never blocked");
  assert.match(issue.message, /source quote does not occur/i);
  assert.equal(classified.verdict.gate, "GREEN");
});

requiredTest("a chapter with no source text produces WARNs and records model-memory", async () => {
  const chapter = franklinChapter();
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "model-memory", recalledClaims: ["Franklin met the proprietaries in Spring Garden."] },
    ask: async () => ({
      findings: [
        {
          surface: "chapter/keyTakeaway",
          quote: REV6_ERROR,
          claim: "The Penn brothers refused to meet Franklin.",
          verdict: "contradicted",
          sourceQuote: null,
          checkableKind: "sequence",
          note: "my recollection is that a meeting took place",
        },
        {
          surface: "chapter/hook",
          quote: chapter.hook,
          claim: "unverifiable date claim",
          verdict: "unsupported",
          sourceQuote: null,
          checkableKind: "date",
          note: "nothing in my recall bears on this",
        },
      ],
    }),
  });
  assert.equal(report.provenance, "model-memory");
  const classified = classifySourceFidelityFindings(report);
  assert.ok(classified.issues.length >= 2);
  assert.equal(classified.issues.every((issue) => issue.severity === "WARN"), true, JSON.stringify(classified.issues, null, 2));
  assert.equal(classified.issues.every((issue) => issue.message.includes("model-memory")), true);
  assert.equal(classified.verdict.gate !== "RED", true, "model-memory can never RED-gate a chapter");
});

requiredTest("an unsupported checkable claim blocks and an unsupported generality warns", async () => {
  const chapter = franklinChapter();
  const findings: SourceFidelityFinding[] = [
    {
      surface: "chapter/keyTakeaway",
      quote: REV6_ERROR,
      claim: "the brothers refused in 1758",
      verdict: "unsupported",
      sourceQuote: null,
      checkableKind: "date",
      note: "no date in the span supports this",
    },
    {
      surface: "chapter/hook",
      quote: chapter.hook,
      claim: "people generally find this easier",
      verdict: "unsupported",
      sourceQuote: null,
      checkableKind: "none",
      note: "a generality the span neither states nor denies",
    },
  ];
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({ findings }),
  });
  const classified = classifySourceFidelityFindings(report);
  const byQuote = new Map(classified.issues.map((issue) => [issue.message, issue]));
  const blocking = classified.issues.filter((issue) => issue.severity === "BLOCKER");
  const warning = classified.issues.filter((issue) => issue.severity === "WARN");
  assert.equal(blocking.length, 1, JSON.stringify(classified.issues, null, 2));
  assert.equal(blocking[0].code, SOURCE_FIDELITY_UNSUPPORTED_CODE);
  assert.equal(warning.length, 1, JSON.stringify([...byQuote.keys()], null, 2));
  assert.equal(warning[0].code, SOURCE_FIDELITY_UNSUPPORTED_CODE);
});

requiredTest("a contradicted quiz key is SF3 and an unsupported explanation clause is SF4", async () => {
  const chapter = franklinChapter();
  const surfaces = chapterFidelitySurfaces(chapter);
  const key = surfaces.find((surface) => surface.kind === "quiz_key");
  const explanation = surfaces.find((surface) => surface.kind === "quiz_explanation");
  assert.ok(key && explanation, JSON.stringify(surfaces.map((s) => s.id)));
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({
      findings: [
        {
          surface: key.id,
          quote: key.text,
          claim: "the keyed choice states the wrong order of events",
          verdict: "contradicted",
          sourceQuote: SOURCE_LINE,
          checkableKind: "sequence",
          note: "the source puts the conference first",
        },
        {
          surface: explanation.id,
          quote: explanation.text,
          claim: "the explanation asserts a charter clause",
          verdict: "unsupported",
          sourceQuote: null,
          checkableKind: "document",
          note: "the span says nothing about the charter",
        },
      ],
    }),
  });
  const classified = classifySourceFidelityFindings(report);
  const codes = classified.issues.map((issue) => `${issue.code}:${issue.severity}`);
  assert.ok(codes.includes(`${SOURCE_FIDELITY_KEY_CODE}:BLOCKER`), JSON.stringify(codes));
  assert.ok(codes.includes(`${SOURCE_FIDELITY_EXPLANATION_CODE}:BLOCKER`), JSON.stringify(codes));
});

requiredTest("an over-long span is chunked deterministically and its findings merge", async () => {
  const chapter = franklinChapter();
  // Three chunks' worth of span, built by repeating the fixture.
  const long = `${SLICE}\n\n`.repeat(Math.ceil((SOURCE_FIDELITY_MAX_CONTEXT_CHARS * 2.2) / SLICE.length));
  const chunks = chunkSourceContext(long);
  assert.ok(chunks.length >= 3, `expected >=3 chunks, got ${chunks.length}`);
  assert.equal(chunks.join("").length >= long.length, true, "chunks cover the whole span");
  assert.deepEqual(chunkSourceContext(long), chunks, "chunking is deterministic");

  const seen: number[] = [];
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: long },
    ask: async (request) => {
      seen.push(request.chunkIndex);
      // One chunk sees the passage and says contradicted; the others do not and
      // say unsupported. The merge must keep the evidence-bearing verdict.
      if (request.chunkIndex !== 0) {
        return { findings: [{ surface: "chapter/keyTakeaway", quote: REV6_ERROR, claim: "c", verdict: "unsupported", sourceQuote: null, checkableKind: "none", note: "not in this chunk" }] };
      }
      return { findings: [{ surface: "chapter/keyTakeaway", quote: REV6_ERROR, claim: "c", verdict: "contradicted", sourceQuote: SOURCE_LINE, checkableKind: "sequence", note: "here it is" }] };
    },
  });
  assert.equal(report.calls, chunks.length);
  assert.deepEqual(seen, chunks.map((_, index) => index));
  assert.equal(report.findings.length, 1, JSON.stringify(report.findings, null, 2));
  assert.equal(report.findings[0].verdict, "contradicted");
  const classified = classifySourceFidelityFindings(report);
  assert.equal(classified.issues[0].severity, "BLOCKER");
});

requiredTest("a supported verdict anywhere beats an unsupported verdict elsewhere", async () => {
  const chapter = franklinChapter();
  const long = `${SLICE}\n\n`.repeat(Math.ceil((SOURCE_FIDELITY_MAX_CONTEXT_CHARS * 1.4) / SLICE.length));
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: long },
    ask: async (request) => ({
      findings: [{
        surface: "chapter/keyTakeaway",
        quote: REV6_ERROR,
        claim: "c",
        verdict: request.chunkIndex === 0 ? "supported" : "unsupported",
        sourceQuote: request.chunkIndex === 0 ? SOURCE_LINE : null,
        checkableKind: "date",
        note: "n",
      }],
    }),
  });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].verdict, "supported");
  assert.equal(classifySourceFidelityFindings(report).issues.length, 0);
});

requiredTest("precedence resolves ONE claim across chunks, never two claims on one quote", async () => {
  // ROUND 2, MINOR 2. Keyed on surface+quote alone, a `supported` finding about
  // claim A erased an enforceable `unsupported` finding about claim B on the
  // same sentence — within one chunk as readily as across two, so a judge could
  // retire its own SF2 blocker by adding a second, agreeable finding. One quote
  // can assert several things and the source can settle them differently.
  const chapter = franklinChapter();
  const long = `${SLICE}\n\n`.repeat(Math.ceil((SOURCE_FIDELITY_MAX_CONTEXT_CHARS * 1.4) / SLICE.length));
  const supportedClaim = "The brothers are the proprietaries of Pennsylvania.";
  const unsupportedClaim = "The brothers refused every meeting in 1758.";
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: long },
    ask: async (request) => ({
      findings: [
        {
          surface: "chapter/keyTakeaway",
          quote: REV6_ERROR,
          claim: supportedClaim,
          verdict: "supported",
          sourceQuote: SOURCE_LINE,
          checkableKind: "name",
          note: "the span bears this out",
        },
        {
          surface: "chapter/keyTakeaway",
          quote: REV6_ERROR,
          claim: unsupportedClaim,
          verdict: request.chunkIndex === 0 ? "unsupported" : "unsupported",
          sourceQuote: null,
          checkableKind: "date",
          note: "no chunk places this",
        },
      ],
    }),
  });
  // Both survive: they are findings about different propositions.
  assert.equal(report.findings.length, 2, JSON.stringify(report.findings, null, 2));
  assert.deepEqual(report.findings.map((finding) => finding.verdict), ["supported", "unsupported"]);
  const classified = classifySourceFidelityFindings(report);
  assert.equal(classified.issues.length, 1, JSON.stringify(classified.issues, null, 2));
  assert.equal(classified.issues[0].severity, "BLOCKER", classified.issues[0].message);
  assert.ok(classified.issues[0].message.includes(unsupportedClaim), classified.issues[0].message);
});

requiredTest("the one-ruler cross-check is a real invariant that fires on a corrupted classification", async () => {
  // ROUND 2, MINOR 1. The QC veto and the ship-side bar reduce the same axis
  // through the same frozen computeVerdict; this is the read-back that PROVES a
  // classification has that property rather than asserting it.
  const report = await judgeChapterSourceFidelity({
    chapter: franklinChapter(),
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({
      findings: [{
        surface: "chapter/keyTakeaway",
        quote: REV6_ERROR,
        claim: "The Penn brothers refused to meet Franklin.",
        verdict: "contradicted",
        sourceQuote: SOURCE_LINE,
        checkableKind: "sequence",
        note: "the source records the meeting",
      }],
    }),
  });
  const classified = classifySourceFidelityFindings(report);
  assert.equal(classified.issues.filter((issue) => issue.severity === "BLOCKER").length, 1);
  assert.equal(classified.verdict.gate, "RED");
  assert.equal(sourceFidelityVetoDisagreement(classified), null, "a real classification agrees with itself");

  // 1. A blocker that cites no axis hit — the severity rule and the axis have
  //    drifted apart, and the ship bar would wave the chapter through.
  const uncited = { ...classified, axis: { ...classified.axis, hits: [] } };
  const uncitedProblem = sourceFidelityVetoDisagreement(uncited);
  assert.ok(uncitedProblem, "an uncited blocker must be reported");
  assert.ok(uncitedProblem.includes("cites 0 hit(s) but 1 blocker(s)"), uncitedProblem);

  // 2. A verdict that is no longer the frozen reduction of its own axis — a
  //    cached, medianed or hand-written verdict.
  const forged = {
    ...classified,
    verdict: { ...classified.verdict, gate: "GREEN" as const, tier: "PUBLISHABLE" as const },
  };
  const forgedProblem = sourceFidelityVetoDisagreement(forged);
  assert.ok(forgedProblem, "a verdict that is not computeVerdict of its own axis must be reported");
  assert.ok(forgedProblem.includes("frozen computeVerdict reduces this axis to RED"), forgedProblem);
});

requiredTest("the checkable-kind detector is a union with the judge's own label", () => {
  assert.deepEqual(detectCheckableKinds("nothing here at all").length, 0);
  assert.ok(detectCheckableKinds("in 1758 he wrote").includes("number"));
  assert.ok(detectCheckableKinds("he first met Penn, then wrote").includes("sequence"));
  assert.ok(detectCheckableKinds("the Charter of Privileges says so").includes("document"));
  assert.ok(detectCheckableKinds('he said "a speckled ax is best"').includes("quotation"));
  assert.ok(detectCheckableKinds("a meeting with Ferdinand Paris").includes("name"));
});

requiredTest("a judge that mislabels a checkable claim as none is still blocked", async () => {
  const chapter = franklinChapter();
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({
      findings: [{
        surface: "chapter/keyTakeaway",
        quote: REV6_ERROR,
        // The judge declares "none"; the deterministic detector sees the
        // capitalized name, so the union escalates it anyway.
        claim: "the Penn brothers refused",
        verdict: "unsupported",
        sourceQuote: null,
        checkableKind: "none",
        note: "n",
      }],
    }),
  });
  const classified = classifySourceFidelityFindings(report);
  assert.equal(classified.issues[0].severity, "BLOCKER", JSON.stringify(classified.issues, null, 2));
});

requiredTest("a finding quoting text that is not in the chapter cannot block", async () => {
  const chapter = franklinChapter();
  const report = await judgeChapterSourceFidelity({
    chapter,
    source: { provenance: "source-text", spanText: SLICE },
    ask: async () => ({
      findings: [{
        surface: "chapter/keyTakeaway",
        quote: "a sentence this chapter has never contained anywhere",
        claim: "c",
        verdict: "contradicted",
        sourceQuote: SOURCE_LINE,
        checkableKind: "sequence",
        note: "n",
      }],
    }),
  });
  const classified = classifySourceFidelityFindings(report);
  assert.equal(classified.issues.length, 1);
  assert.equal(classified.issues[0].severity, "WARN");
  assert.match(classified.issues[0].message, /not present in the chapter/i);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
