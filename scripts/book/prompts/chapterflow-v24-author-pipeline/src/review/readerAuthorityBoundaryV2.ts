/**
 * IMP-24 reader-lane authority boundary.
 *
 * The reader sees only the key-free reader document.  It may report how an
 * origin or attribution reads on the page, but it cannot turn that perception
 * into an affirmative external-fact or source-support verdict.  This detector
 * is intentionally narrow: it recognizes explicit declarations while leaving
 * uncertainty and requests for source-lane verification alone.
 */

import type { ReaderExperienceModelOutputV2 } from "../contracts/reviewModelOutputV2.js";

export type ReaderAuthorityViolationKindV2 =
  | "external_fabrication_declaration"
  | "source_contradiction_declaration";

export type ReaderAuthorityViolationV2 = {
  kind: ReaderAuthorityViolationKindV2;
  surface: string;
  excerpt: string;
};

type ReaderAuthorityTextSurface = {
  surface: string;
  text: string;
};

type AuthorityPattern = {
  kind: ReaderAuthorityViolationKindV2;
  pattern: RegExp;
};

const EXTERNAL_SUBJECT = String.raw`(?:source|citation|reference|study|research|researcher|expert|author|attribution|quote|quotation|statistic|data|survey|experiment|case\s+study|historical\s+(?:event|account)|participant|organization|institution|company|anecdote|external\s+claim|real-world\s+claim)`;
const CHAPTER_CLAIM = String.raw`(?:chapter|passage|claim|statement|account|example|quote|quotation|attribution|finding|this|that|it)`;
const SOURCE_OBJECT = String.raw`(?:source|citation|reference|source\s+material|source\s+evidence|research|study|evidence)`;
const FABRICATION = String.raw`(?:fabricated|invented|made[ -]?up|fake|fictional|nonexistent|concocted|manufactured)`;

const AUTHORITY_PATTERNS: readonly AuthorityPattern[] = [
  {
    kind: "external_fabrication_declaration",
    pattern: new RegExp(String.raw`\b(?:the\s+|this\s+|that\s+)?${EXTERNAL_SUBJECT}\s+(?:is|are|was|were|has\s+been|have\s+been)\s+(?:clearly\s+|obviously\s+|definitely\s+|wholly\s+|entirely\s+)?${FABRICATION}\b`, "giu"),
  },
  {
    kind: "external_fabrication_declaration",
    pattern: new RegExp(String.raw`\b(?:the\s+)?(?:author|writer|chapter|passage)\s+(?:fabricated|invented|made[ -]?up|faked|concocted|manufactured)\s+(?:this\s+|that\s+|the\s+|an?\s+)?${EXTERNAL_SUBJECT}\b`, "giu"),
  },
  {
    kind: "external_fabrication_declaration",
    pattern: new RegExp(String.raw`\b(?:this|that|it)\s+(?:is|was)\s+(?:clearly\s+|obviously\s+|definitely\s+)?(?:an?\s+)?${FABRICATION}\s+${EXTERNAL_SUBJECT}\b`, "giu"),
  },
  {
    kind: "external_fabrication_declaration",
    pattern: new RegExp(String.raw`\b(?:the\s+|this\s+|that\s+)?${EXTERNAL_SUBJECT}\s+(?:does\s+not|doesn't|did\s+not|didn't)\s+exist\b|\b(?:the\s+|this\s+|that\s+)?(?:study|experiment|historical\s+(?:event|account)|anecdote|case\s+study)\s+never\s+(?:happened|occurred|took\s+place)\b`, "giu"),
  },
  {
    kind: "source_contradiction_declaration",
    pattern: new RegExp(String.raw`\b(?:the\s+)?${CHAPTER_CLAIM}\s+(?:directly\s+|clearly\s+|flatly\s+)?(?:contradicts?|conflicts?\s+with|is\s+inconsistent\s+with|misrepresents?|does\s+not\s+match|doesn't\s+match)\s+(?:the\s+|its\s+)?${SOURCE_OBJECT}\b`, "giu"),
  },
  {
    kind: "source_contradiction_declaration",
    pattern: new RegExp(String.raw`\b(?:the\s+)?${SOURCE_OBJECT}\s+(?:directly\s+|clearly\s+|flatly\s+)?(?:contradicts?|conflicts?\s+with|refutes?|disproves?|does\s+not\s+support|doesn't\s+support|fails?\s+to\s+support)\s+(?:the\s+|this\s+|that\s+)?${CHAPTER_CLAIM}\b`, "giu"),
  },
  {
    kind: "source_contradiction_declaration",
    pattern: new RegExp(String.raw`\b(?:the\s+)?${CHAPTER_CLAIM}\s+(?:is|are|was|were)\s+(?:clearly\s+|directly\s+|wholly\s+)?(?:unsupported|not\s+supported|contradicted|refuted)\s+by\s+(?:the\s+|any\s+)?${SOURCE_OBJECT}\b`, "giu"),
  },
  {
    kind: "source_contradiction_declaration",
    pattern: new RegExp(String.raw`\bno\s+${SOURCE_OBJECT}\s+(?:supports?|substantiates?|corroborates?)\s+(?:the\s+|this\s+|that\s+)?${CHAPTER_CLAIM}\b`, "giu"),
  },
  {
    kind: "source_contradiction_declaration",
    pattern: /\b(?:this|that|it)\s+(?:is|was|constitutes?)\s+(?:clearly\s+|directly\s+)?(?:a\s+)?source\s+contradiction\b/giu,
  },
  {
    kind: "source_contradiction_declaration",
    pattern: /\b(?:the\s+|this\s+|that\s+)?(?:attribution|quote|quotation|claim)\s+(?:is|was)\s+(?:clearly\s+|definitely\s+)?(?:misattributed|falsely\s+attributed|wrongly\s+attributed)\b|\b(?:the\s+)?(?:author|writer|chapter|passage)\s+(?:falsely|wrongly|incorrectly)\s+attributes?\b/giu,
  },
];

const UNCERTAINTY_BEFORE_ASSERTION = /(?:\b(?:may|might|could|possibly|potentially|perhaps|apparently|seemingly|suspected|suspect|appears?|seems?|unclear|ambiguous|uncertain|question(?:s|ed|ing)?|wonder(?:s|ed|ing)?)\b|\b(?:cannot|can't|could\s+not|couldn't|unable\s+to)\s+(?:tell|determine|verify|know)\b|\b(?:whether|if)\b)[^.!?;]{0,96}$/iu;

function normalized(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function assertionIsQualifiedByUncertainty(text: string, assertionIndex: number): boolean {
  const before = text.slice(Math.max(0, assertionIndex - 128), assertionIndex);
  return UNCERTAINTY_BEFORE_ASSERTION.test(before);
}

function readerAuthorityTextSurfaces(output: ReaderExperienceModelOutputV2): ReaderAuthorityTextSurface[] {
  const surfaces: ReaderAuthorityTextSurface[] = [];
  const appendFindings = (
    name: string,
    findings: readonly { readonly unit: string; readonly problem: string }[],
  ): void => {
    findings.forEach((finding, index) => {
      surfaces.push({ surface: `${name}[${index}].unit`, text: finding.unit });
      surfaces.push({ surface: `${name}[${index}].problem`, text: finding.problem });
    });
  };
  appendFindings("blockingFindings", output.blockingFindings);
  appendFindings("escalationSignals", output.escalationSignals);
  appendFindings("advisoryFindings", output.advisoryFindings);
  for (const field of ["mechanisms", "ambiguities", "tells"] as const) {
    output.quizDerivation[field].forEach((text, index) => {
      surfaces.push({ surface: `quizDerivation.${field}[${index}]`, text });
    });
  }
  surfaces.push({ surface: "oneParagraphVerdict", text: output.oneParagraphVerdict });
  return surfaces;
}

export function readerAuthorityViolationsV2(
  output: ReaderExperienceModelOutputV2,
): ReaderAuthorityViolationV2[] {
  const violations: ReaderAuthorityViolationV2[] = [];
  for (const surface of readerAuthorityTextSurfaces(output)) {
    const text = normalized(surface.text);
    if (text.length === 0) continue;
    for (const candidate of AUTHORITY_PATTERNS) {
      candidate.pattern.lastIndex = 0;
      for (const match of text.matchAll(candidate.pattern)) {
        if (assertionIsQualifiedByUncertainty(text, match.index ?? 0)) continue;
        violations.push({
          kind: candidate.kind,
          surface: surface.surface,
          excerpt: match[0],
        });
      }
    }
  }
  return violations;
}
