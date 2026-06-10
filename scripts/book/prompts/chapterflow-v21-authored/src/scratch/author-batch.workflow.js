export const meta = {
  name: 'author-rework-batch',
  description: 'Orchestrate a Rework chapter batch through the v2 pipeline using the pre-authoring name plan',
  phases: [
    { title: 'Sidecar v2', detail: 'upgrade each v1 source sidecar to v2 (testableFacts, hardSpecifics, anchor ids)' },
    { title: 'Author + self-gate', detail: 'author each chapter against the contract + name-plan slice, self-gate to green' },
  ],
}

// Batch params are hardcoded for this one-off ch16-23 Rework run (args plumbing
// is overridden if provided). allocation/titles mirror state/name-plans/rework.name-plan.json.
const A = args || {}
const PIPE = '/Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored'
const bookId = A.bookId || 'rework'
const runId = A.runId || 'zz-v2-validation'           // where v2 sidecars + gating read from (findLatestRun picks "zz...")
const v1RunId = A.v1RunId || '20260601-083527'        // where the rich-v1 sidecars live
const from = A.from || 16, to = A.to || 23
const DEFAULT_ALLOCATION = {
  16: ['Anders', 'Asbjorn', 'Astrid', 'Bodil', 'Brage', 'Dagny', 'Eivind'],
  17: ['Frode', 'Gunnhild', 'Haldis', 'Hedda', 'Ingmar', 'Jorunn', 'Kjell'],
  18: ['Liv', 'Nanna', 'Odd', 'Pernille', 'Ragnhild', 'Sigrun', 'Stellan'],
  19: ['Sverre', 'Thora', 'Torstein', 'Tuva', 'Vegard', 'Yngve', 'Birger'],
  20: ['Eldrid', 'Folke', 'Gudrun', 'Helle', 'Ivar', 'Jarle', 'Kari'],
  21: ['Marit', 'Njal', 'Oddny', 'Ragnar', 'Signy', 'Trygve', 'Unni'],
  22: ['Vidar', 'Aslaug', 'Dagfinn', 'Bogdan', 'Dragana', 'Ilona', 'Janka'],
  23: ['Katarzyna', 'Milena', 'Nikola', 'Ostap', 'Radmila', 'Slavko', 'Vesna'],
}
const DEFAULT_TITLES = {
  16: 'Start a business, not a startup',
  17: 'Building to flip is building to flop',
  18: 'Less mass',
  19: 'Embrace constraints',
  20: 'Build half a product, not a half-assed product',
  21: 'Start at the epicenter',
  22: 'Ignore the details early on',
  23: 'Making the call is making progress',
}
if (!A.allocation) A.allocation = DEFAULT_ALLOCATION
if (!A.titles) A.titles = DEFAULT_TITLES
const chapters = []
for (let n = from; n <= to; n++) chapters.push(n)

const SIDECAR_SCHEMA = {
  type: 'object',
  required: ['chapterNumber', 'wrote', 'testableFactCount'],
  properties: {
    chapterNumber: { type: 'number' },
    wrote: { type: 'boolean' },
    testableFactCount: { type: 'number' },
    notes: { type: 'string' },
  },
}

const CHAPTER_SCHEMA = {
  type: 'object',
  required: ['chapterNumber', 'gatePassed', 'blockerCount', 'roundsUsed'],
  properties: {
    chapterNumber: { type: 'number' },
    gatePassed: { type: 'boolean' },
    blockerCount: { type: 'number' },
    blockers: { type: 'array', items: { type: 'string' } },
    roundsUsed: { type: 'number' },
    namesUsed: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

function pad(n) { return String(n).padStart(2, '0') }

phase('Sidecar v2')
const results = await pipeline(
  chapters,
  // Stage 1: upgrade v1 -> v2 sidecar
  (n) =>
    agent(
      `You are upgrading one ChapterFlow source sidecar from rich-v1 to source-v2. Work in ${PIPE} (cd there first).

INPUT  (rich-v1): .chapterflow/runs/${bookId}/${v1RunId}/sidecars/source/ch${pad(n)}.source.json  (relative to the REPO ROOT /Users/radinsoltani/ChapterFlow)
OUTPUT (v2):      .chapterflow/runs/${bookId}/${runId}/sidecars/source/ch${pad(n)}.source.json  (REPO ROOT relative)
REFERENCE v2 shape: read .chapterflow/runs/${bookId}/${runId}/sidecars/source/ch09.source.json — match its structure EXACTLY.

Chapter ${n} title: "${(A.titles || {})[n] || ''}"

Task: read the v1 sidecar, then write a v2 sidecar that KEEPS all v1 content (focus, coreClaim, centralConcept, keyClaims, namedExamples, hardEdge, voiceCues, forbiddenLeakage, paraphraseNotes) and ADDS:
- "schemaVersion": "source-v2"
- "centralConcept.id": "ch${n}.concept"  and an "id" on every namedExample like "ch${n}.ex.<slug>" plus a "hardSpecifics": [..real concrete tokens: proper nouns, products, numbers..] array and "realWorld": true on each.
- "testableFacts": 8-9 objects, each { "id": "ch${n}.fact.K", "claim", "becauseMechanism" (starts with "because"), "commonError" (a plausible NON-strawman wrong belief), "errorIsWhy" (why the error is wrong), "derivedFrom": "<a concept/example/edge id>" }. Facts must be specific to THIS chapter's real content (the Basecamp/37signals/Rework world), each independently quiz-able. Include at least one fact derived from the hardEdge (id "ch${n}.edge").
- "frameworks": [] (unless the chapter has a named multi-step framework in the source; then list it).

Every hardSpecific and testableFact must be REAL (from the v1 sidecar's content), never invented. Write valid JSON to the OUTPUT path. Return the chapterNumber, wrote=true, and testableFactCount.`,
      { label: `sidecar:ch${n}`, phase: 'Sidecar v2', schema: SIDECAR_SCHEMA },
    ),
  // Stage 2: author + self-gate to green
  (sidecarResult, n) => {
    const names = ((A.allocation || {})[n] || []).join(', ')
    return agent(
      `You are authoring ONE ChapterFlow v21 chapter end-to-end and must leave it PASSING the ship gate. Work in ${PIPE} (cd there first).

Chapter ${n} of "${bookId}" — title "${(A.titles || {})[n] || ''}".

READ FIRST (in order):
1. The authoring contract: agent-prompts/STEP-2-WRITE-CHAPTERS.md — this is authoring LAW. Follow the Bind Block, R1-R5, and the field rules.
2. The field contracts: agent-prompts/FIELD-PURPOSE-CONTRACTS.md.
3. Your v2 source sidecar: .chapterflow/runs/${bookId}/${runId}/sidecars/source/ch${pad(n)}.source.json (REPO ROOT relative). Author FROM this — every field traces to it.
4. An existing PASSING v2 chapter for the exact JSON schema: state/chapters/${bookId}-ch09.v21-native.chapter.json. Match its structure EXACTLY (same keys, same nesting, chapterId "${bookId}-ch${pad(n)}", number ${n}).

NAME PLAN (hard requirement — prevents book-gate F1/BP13):
- Use ONLY these protagonist names for your scenarios, one distinct name per example: ${names}.
- Do NOT use any other names. Do NOT reuse a name across two examples.
- Read config/banned-connectives.json: never use any listed phrase, and never let a 5-word run repeat the shape of another scenario. Vary how each scene opens (time-first / place-first / dialogue / data / consequence-first), how the decision is framed, how the consequence lands.

V2 PROVENANCE (R5): the sidecar is source-v2, so set sourceAnchorId on every example, quiz question, review card, and ifThen plan to the id of the testableFact/namedExample/concept it is built from, and use >=2 of that anchor's hardSpecifics. SC11 verifies it.

WRITE the chapter JSON to: state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json

THEN SELF-GATE TO GREEN (loop, up to 4 rounds):
  npx tsx src/cli.ts author-check state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json
  npx tsx src/cli.ts gate-chapter state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json
Fix EVERY blocker the "Gate verdict:" line reports by RE-AUTHORING the offending field from the sidecar (not by gaming the check). Re-run until "Gate verdict: PASS — 0 blockers". Majors/minors are non-blocking but fix them if cheap.

Return chapterNumber=${n}, gatePassed (true only if the Gate verdict line says PASS 0 blockers), blockerCount, blockers (the verdict lines if any remain), roundsUsed, namesUsed (the protagonist names you actually used), and a one-line summary.`,
      { label: `author:ch${n}`, phase: 'Author + self-gate', schema: CHAPTER_SCHEMA },
    )
  },
)

const clean = results.filter(Boolean)
const passed = clean.filter((r) => r.gatePassed)
log(`Authored ${clean.length}/${chapters.length} chapters; ${passed.length} PASS gate-chapter`)
return {
  requested: chapters,
  authored: clean.map((r) => r.chapterNumber),
  passed: passed.map((r) => r.chapterNumber),
  failed: clean.filter((r) => !r.gatePassed).map((r) => ({ n: r.chapterNumber, blockers: r.blockers })),
  perChapterNames: clean.map((r) => ({ n: r.chapterNumber, names: r.namesUsed })),
}
