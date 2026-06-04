export const meta = {
  name: 'qc-review',
  description: 'Adversarial Claude semantic review of a chapter batch — reads each chapter, hidden-key-derives every quiz answer, then writes a qc-attest verdict (the no-API semantic gate)',
  phases: [
    { title: 'Bar read', detail: 'one reviewer per chapter — publishable bar + hidden-key derivation' },
    { title: 'Attest', detail: 'verify claimed key errors, then record the verdict via qc-attest' },
  ],
}

// args = { bookId, chapters: [n,...] }. Defaults to the validated-but-unattested rework ch09-15.
const A = args || {}
const PIPE = '/Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored'
const RUN = A.run || 'zz-v2-validation'
const bookId = A.bookId || 'rework'
const chapters = Array.isArray(A.chapters) && A.chapters.length ? A.chapters : [9, 10, 11, 12, 13, 14, 15]
function pad(n) { return String(n).padStart(2, '0') }

const BARREAD_SCHEMA = {
  type: 'object',
  required: ['chapterNumber', 'verdict', 'overallScore', 'quizKeyErrors', 'dimensions', 'notes'],
  properties: {
    chapterNumber: { type: 'number' },
    verdict: { type: 'string', enum: ['PUBLISHABLE', 'REVISE', 'CORRUPTION'] },
    overallScore: { type: 'number' },
    quizKeyErrors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['questionIndex', 'keyedIndex', 'derivedIndex', 'explanation'],
        properties: {
          questionIndex: { type: 'number' }, keyedIndex: { type: 'number' },
          derivedIndex: { type: 'number' }, explanation: { type: 'string' },
        },
      },
    },
    dimensions: {
      type: 'object',
      properties: {
        keysCorrect: { type: 'boolean' }, grounded: { type: 'boolean' }, nonTemplated: { type: 'boolean' },
        frameworkComplete: { type: 'boolean' }, cardsAnswerFronts: { type: 'boolean' }, distractorsReal: { type: 'boolean' },
      },
    },
    notes: { type: 'string', description: 'one line: score + reason + any cited corruption (goes into the attestation)' },
  },
}

const ATTEST_SCHEMA = {
  type: 'object',
  required: ['chapterNumber', 'finalVerdict', 'attested'],
  properties: {
    chapterNumber: { type: 'number' },
    finalVerdict: { type: 'string', enum: ['PUBLISHABLE', 'REVISE', 'CORRUPTION'] },
    attested: { type: 'boolean', description: 'true if qc-attest ran and wrote the file' },
    confirmedKeyErrors: { type: 'number' },
  },
}

phase('Bar read')
const results = await pipeline(
  chapters,
  // Stage 1: adversarial bar-read (no write yet)
  (n) =>
    agent(
      `You are doing a SEMANTIC publishable-bar QC read of ONE ChapterFlow chapter — the job deterministic gates cannot do. Work in ${PIPE} (cd there).

READ:
- state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json
- Its source: /Users/radinsoltani/ChapterFlow/.chapterflow/runs/${bookId}/${RUN}/sidecars/source/ch${pad(n)}.source.json (if present)
- The rubric + rules: agent-prompts/QC-SESSION-PROMPT.md (esp. §2 Layer 2, §3 the bar) and src/critics/semantic/publishableBar.ts.

CHECKS:
1. HIDDEN-KEY (most important): for EACH quiz question read ONLY prompt + choices, derive the correct index yourself, THEN reveal correctIndex. Report every disagreement in quizKeyErrors. Also confirm each explanation actually proves its keyed choice.
2. Distractors specific to the scenario (not generic strawmen) → dimensions.distractorsReal.
3. Templating: read all 6 example scenarios + 3 breakdown tiers + 6 card fronts/backs; flag shared skeletons/openers → dimensions.nonTemplated.
4. Framework completeness (if a multi-step tool is named) → dimensions.frameworkComplete.
5. Cards answer their fronts → dimensions.cardsAnswerFronts.
6. Source grounding (≥2 real hardSpecifics, not filler) → dimensions.grounded.

Set dimensions.keysCorrect=false if you found ANY wrong key. Apply the §3 bar: CORRUPTION (wrong key / false content / incoherent) → CORRUPTION; clean but overall<85 or an axis<0.6 → REVISE; else PUBLISHABLE. Be a skeptical editor; do NOT pass templated or wrong-keyed content. Put the score + one-line reason in notes. Do NOT write any file in this stage.`,
      { label: `barread:ch${n}`, phase: 'Bar read', schema: BARREAD_SCHEMA },
    ),
  // Stage 2: verify claimed key errors, finalize the verdict, and ATTEST
  (read, n) =>
    agent(
      `Finalize the QC verdict for ${bookId} ch${n} and RECORD it. Work in ${PIPE} (cd there).

The bar-read returned verdict=${read.verdict}, score=${read.overallScore}, dimensions=${JSON.stringify(read.dimensions)}, and ${(read.quizKeyErrors || []).length} claimed quiz-key error(s): ${JSON.stringify(read.quizKeyErrors || [])}.

For EACH claimed key error, independently re-derive the answer to that question (read ONLY prompt+choices in state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json, derive, then compare) — count how many are GENUINELY wrong (claimUpheld). Then set the FINAL verdict:
- any confirmed wrong key OR cited false/incoherent content → CORRUPTION
- else if bar-read said REVISE (overall<85 or an axis<0.6) → REVISE
- else → PUBLISHABLE

Then RECORD it by running EXACTLY this (fill the verdict + dimensions you confirmed):
  npx tsx src/cli.ts qc-attest state/chapters/${bookId}-ch${pad(n)}.v21-native.chapter.json --verdict <FINAL> --reviewer "claude-qc:qc-review-wf" --dimensions "keysCorrect=<bool>,grounded=<bool>,nonTemplated=<bool>,frameworkComplete=<bool>,cardsAnswerFronts=<bool>,distractorsReal=<bool>" --notes "${(read.notes || '').replace(/"/g, "'").slice(0, 180)}"
Confirm it printed "QC attestation written". Return chapterNumber=${n}, the finalVerdict, attested=true, and confirmedKeyErrors count.`,
      { label: `attest:ch${n}`, phase: 'Attest', schema: ATTEST_SCHEMA },
    ),
)

const clean = results.filter(Boolean)
const byVerdict = { PUBLISHABLE: [], REVISE: [], CORRUPTION: [] }
for (const r of clean) (byVerdict[r.finalVerdict] || (byVerdict[r.finalVerdict] = [])).push(r.chapterNumber)
log(`Reviewed + attested ${clean.length}/${chapters.length}: PUBLISHABLE ${byVerdict.PUBLISHABLE.length}, REVISE ${byVerdict.REVISE.length}, CORRUPTION ${byVerdict.CORRUPTION.length}`)
return { byVerdict, attested: clean.filter((r) => r.attested).map((r) => r.chapterNumber) }
