export const meta = {
  name: 'v25-fix-TASKID',
  description: 'EDIT ME: one line naming the defect and the fix; RED-first, two adversarial Opus reviewers, PR opened',
  phases: [
    { title: 'Implement', detail: 'opus: RED test first, minimal fix, GREEN, full suite' },
    { title: 'Review', detail: 'two adversarial opus reviewers reproduce RED at the base and GREEN on the branch' },
    { title: 'Ship', detail: 'push + PR, report checks' },
  ],
}
// ─────────────────────────────── CONSTANTS — fill these in ───────────────────────────────
// Copy this file to your session directory, edit meta + this block, then run it with the Workflow tool (scriptPath).
// TASK and RED_EXPECT are template literals / strings: before pasting, replace every backtick with ' and every
// dollar-sign-followed-by-{ with '$ {' (a pasted ${x} is EVALUATED and throws ReferenceError before any agent starts).
// TASK = ONLY the goal sentence, the facts paragraph, the "Required change" list and the "RED first" paragraph of your
// task prompt. Never paste Step 0-3: subagents must not load skills, write status files, or merge.
const WT = 'EDIT-worktree-name'                 // becomes ~/cf-wt/<WT> on branch v25/<WT>
const BASE = 'origin/main'                      // the ref RED is reproduced against
const TITLE = 'fix(v25): EDIT one-line conventional title'
const RED_EXPECT = 'EDIT: the exact failure the new test must show on the base (error code or assertion)'
const LENSES = [
  { name: 'correctness', focus: 'EDIT: does the fix do exactly what the task requires on the real data shape; can anything else trip the new predicate; are budgets/bounds still enforced. Run the targeted tests only; the other reviewer runs the full suite.' },
  { name: 'gate-safety-minimality', focus: 'any gate, threshold, budget or fail-closed path weakened without a DECISIONS.md entry? any change beyond the named files? any assertion deleted or loosened? You are the only reviewer who runs the full suite (wt.sh verify, in the background).' },
]
const TASK = `
EDIT: goal sentence + facts + Required change + RED first (no backticks, no dollar-brace).
`
// ──────────────────────────────────────────────────────────────────────────────────────────
const REPO = '/Users/radinsoltani/ChapterFlow-books-v25-completion'
const WTDIR = '/Users/radinsoltani/cf-wt/' + WT
const PIPE = 'scripts/book/prompts/chapterflow-v24-author-pipeline'
const TOOLS = '/Users/radinsoltani/cf-wt/franklin-v7-tools'
const KIT = '/Users/radinsoltani/cf-wt/v25-execution'
const VLOG = '/Users/radinsoltani/cf-wt/' + WT + '.verify.log'
const RULES = `
## Rules (from ${KIT}/CONTEXT.md — read it first)
- Authority: the owner explicitly authorized this multi-agent task. Work autonomously; do not ask questions; do not load brainstorming/writing-plans skills. Do not report BLOCKED because a skill suggests asking first.
- Worktree: ${WTDIR}, created ONLY with '${TOOLS}/wt.sh new ${WT}' (reuse if it exists). Pipeline dir ${PIPE}. If npm ci fails, cmp package-lock.json with ${REPO} and symlink node_modules (root and pipeline) from ${REPO}; say so.
- NEVER git stash. NEVER write under ~/cf-canary or ~/cf-canary-att (reading is fine; copy data out to experiment). Never touch the canonical checkout ${REPO} working tree, ~/ChapterFlow-books or ~/ChapterFlow.
- Targeted tests: cd ${WTDIR}/${PIPE} && CHAPTERFLOW_NO_API_CODEX_QC=1 env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npx tsx tests/v25/<file>.test.ts (V25_RESULT line).
- Full suite (~15 min, longer than the 10-min Bash foreground cap): run '${TOOLS}/wt.sh verify ${WT} > ${VLOG} 2>&1' with run_in_background, wait for it to finish (Monitor or an until-loop on the log), then paste the lines matching 'pass [0-9]+ +fail' (the runner prints TWO spaces) and 'v25-subprocess-suite: exit='. Never run two full suites in one worktree at once.
- zsh: always 'command grep'; quote globs. No 'timeout' binary on macOS. Foreground sleep is blocked.
- Owner rules: never weaken a gate/threshold/budget/fail-closed path unless ${KIT}/DECISIONS.md records it (cite the id); minimal diff; never assert what you did not verify — paste verbatim output.
- Commit message = the title below; end it with the Co-Authored-By line your own system prompt specifies. Do NOT push (the ship step does).
`
const IMPL_SCHEMA = { type: 'object', properties: { status: { type: 'string', enum: ['DONE', 'BLOCKED'] }, summary: { type: 'string' }, filesChanged: { type: 'array', items: { type: 'string' } }, testFiles: { type: 'array', items: { type: 'string' } }, redEvidence: { type: 'string' }, greenEvidence: { type: 'string' }, verifyEvidence: { type: 'string' }, commitSha: { type: 'string' }, blockedReason: { type: 'string' } }, required: ['status', 'summary', 'filesChanged', 'testFiles', 'redEvidence', 'greenEvidence', 'verifyEvidence'] }
const REVIEW_SCHEMA = { type: 'object', properties: { verdict: { type: 'string', enum: ['PASS', 'FAIL'] }, redReproduced: { type: 'boolean' }, greenReproduced: { type: 'boolean' }, evidence: { type: 'string' }, findings: { type: 'string' }, mustFix: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'redReproduced', 'greenReproduced', 'evidence', 'findings', 'mustFix'] }
const SHIP_SCHEMA = { type: 'object', properties: { prNumber: { type: 'number' }, prUrl: { type: 'string' }, branch: { type: 'string' }, headSha: { type: 'string' }, checks: { type: 'string' }, notes: { type: 'string' } }, required: ['prNumber', 'prUrl', 'branch', 'headSha', 'checks', 'notes'] }

let impl = null, feedback = '', passed = false
for (let round = 1; round <= 3 && !passed; round += 1) {
  log('implement round ' + round)
  impl = await agent('You are the implementer (round ' + round + '). Work ONLY in ' + WTDIR + '. Read ' + KIT + '/CONTEXT.md first. Write the RED test(s) FIRST and run them on the unfixed code: they must fail with ' + RED_EXPECT + ' (paste verbatim). Implement the minimal fix. GREEN (paste). Run the full suite as the rules say (paste the summary lines). Commit on branch v25/' + WT + ' with message: ' + TITLE + '. Structured output only; evidence verbatim.' + (feedback ? '\n\n## Reviewer findings from round ' + (round - 1) + ' that MUST be addressed (amend or extend; do not restart):\n' + feedback : '') + '\n\n## Task\n' + TASK + '\n' + RULES, { label: 'impl:r' + round, phase: 'Implement', schema: IMPL_SCHEMA, model: 'opus', effort: 'high' })
  if (!impl || impl.status !== 'DONE') { log('implementer BLOCKED in round ' + round); break }
  log('review round ' + round)
  const reviews = (await parallel(LENSES.map((lens) => () =>
    agent('You are adversarial reviewer "' + lens.name + '" (round ' + round + '). Default stance: REFUTE. PASS only if you reproduced RED and GREEN yourself and found no must-fix.\n\nImplementer report:\n' + JSON.stringify(impl, null, 2) + '\n\nBranch v25/' + WT + ' in ' + WTDIR + '. Read the full change with: git -C ' + WTDIR + ' diff ' + BASE + '...HEAD (THREE dots = since the merge base; main may have moved because other PRs merged meanwhile, and a two-dot diff would show their changes as reverted).\nMANDATORY: GREEN = re-run the implementer targeted test commands in the branch. RED = git -C ' + REPO + ' worktree add /Users/radinsoltani/cf-wt/rev-' + WT + '-' + lens.name + '-r' + round + ' ' + BASE + ' --detach; symlink node_modules after cmp package-lock.json; copy ONLY the new or changed test files (plus rig/fixture files they need — list them); run them: they must fail with ' + RED_EXPECT + ' (paste); then remove that worktree with git worktree remove --force. NEVER git stash.\nLens focus: ' + lens.focus + '\n\n## Task\n' + TASK + '\n' + RULES, { label: 'review:' + lens.name + ':r' + round, phase: 'Review', schema: REVIEW_SCHEMA, model: 'opus', effort: 'high' }).then((r) => ({ lens: lens.name, r }))))).filter(Boolean)
  const fails = reviews.filter(({ r }) => !r || r.verdict !== 'PASS' || !r.redReproduced || !r.greenReproduced)
  if (reviews.length === LENSES.length && fails.length === 0) { passed = true; log('round ' + round + ': all reviewers PASS'); break }
  feedback = reviews.map(({ lens, r }) => '### ' + lens + ': ' + (r ? r.verdict : 'NO RESULT') + '\n' + (r ? r.findings : '') + '\nMUST FIX:\n- ' + (r ? r.mustFix : []).join('\n- ')).join('\n\n')
  log('round ' + round + ': ' + fails.length + ' reviewer(s) not satisfied')
}
let ship = null
if (passed) {
  log('ship')
  ship = await agent('Ship branch v25/' + WT + ' from ' + WTDIR + ': (1) git log --oneline ' + BASE + '..HEAD (paste); (2) ' + TOOLS + '/wt.sh push ' + WT + '; (3) write ' + WTDIR + '/.pr-body.md (do not commit it): Summary (problem with the live evidence, root cause, the fix, what stays unchanged, DECISIONS ids used), Test plan (RED, GREEN, full-suite summary — verbatim from the implementer and reviewers), ending with the line: 🤖 Generated with [Claude Code](https://claude.com/claude-code); (4) ' + TOOLS + '/wt.sh pr ' + WT + ' "' + TITLE + '" ' + WTDIR + '/.pr-body.md and read back the PR number with gh pr list --head v25/' + WT + '; (5) poll the checks for up to 25 min with repeated Bash calls each under 10 min (gh pr checks <n>; no sleep in the foreground) and report each check name with its result verbatim. Do NOT merge.\nImplementer evidence:\n' + JSON.stringify(impl, null, 2) + '\n' + RULES, { label: 'ship', phase: 'Ship', schema: SHIP_SCHEMA, model: 'opus', effort: 'medium' })
}
return { passed, impl, ship, lastFeedback: feedback }
