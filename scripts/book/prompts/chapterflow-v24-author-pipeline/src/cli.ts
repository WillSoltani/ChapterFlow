/**
 * ChapterFlow v21 CLI — entry point.
 *
 * Usage:
 *   npx tsx src/cli.ts <command> [args]
 *
 * Commands implemented in Phase 0–1:
 *   critic <book.json>          Run the full critic suite on one book JSON
 *   critic --all                Score every book in book-packages/
 *   critic --all --report path  Write aggregate scoreboard CSV + summaries
 *   help                        Print this help
 *
 * Planned (later phases):
 *   generate <title> <author>   Full v21 pipeline run for a new book
 *   repair   --book <id>        Regenerate only failing units of an existing book
 *   ledger   status             Show cross-book state
 */

import { existsSync as existsSyncFs, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, renameSync } from "fs";
import { execSync, execFileSync } from "child_process";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

import { BookCriticReport, BookPackage, BookPackageV21, ChapterV21 } from "./types.js";
import type { SourcePacketV1 } from "./artifacts/artifactTypes.js";
import type { RunbookStatus } from "./runbook.js";
import type { BibliographyResult } from "./agents/researcher-bibliography.js";
import { roleHintHeader } from "./roles.js";
import { runAllCritics } from "./critics/runAllCritics.js";
import { pingClaude } from "./claudeClient.js";
import { parseChapterId, isSiblingFile, checkChapterIdentity, chapterIdFromFileName, assertNoShadowStateDir } from "./lib/chapterPaths.js";
import { writeFileAtomic } from "./lib/atomicWrite.js";
import type { ProviderName } from "./providers/types.js";
import type { AxisId, AxisScore, FailureTier } from "./critics/semantic/publishableBar.js";
import { formatRuntimeFindings, validateAllConfigFiles } from "./runtimeSchemas.js";

/** Refuse to run if a repo-root shadow state/chapters dir holds chapters
 *  (the dual-directory divergence hazard). Returns an exit code on failure. */
function shadowGuard(): number {
  try {
    assertNoShadowStateDir();
    return 0;
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
}
import {
  auditLibraryInputs,
  getForbiddenNames,
  ingestChapter,
  loadLibraryState,
  quarantineLibraryBlockers,
  rebuildLibraryState,
  verifyLibraryState,
  withLibraryState,
  getLedgerPath,
  type LibraryAuditFinding,
  type LibraryAuditReport,
} from "./librarian/libraryState.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const DEFAULT_REPORTS_DIR = resolve(__dirname, "../reports");

function printHelp() {
  console.log(`ChapterFlow v21 CLI

Commands:
  critic <book.json>                 Run the critic suite on one book
  critic --all [--report <dir>]      Score every JSON in book-packages/
  critic --all --csv <file>          Emit a single-file CSV scoreboard
  ping                               Verify the claude CLI is installed + authenticated
  ledger status                      Show cross-book library state summary
  ledger forbidden-names [--book X]  List protagonist names off-limits for the next book
  ledger ingest <chapter.json> --book-id X --title X --author X
                                     Ingest a generated v21 chapter into the ledger
  verify-library-state [--json]     Recompute library aggregates from authoritative chapters/packages and report drift
  rebuild-library-state [--dry-run] [--json] [--quarantine]
                                     Audit authoritative inputs (published package wins; loose state authoritative only
                                     for unpublished books) and replace the JSON ledger atomically. Reports accepted/
                                     rejected files, package-vs-loose conflicts, expected vs actual state, and planned
                                     writes. A dry run never writes; a real rebuild refuses while blockers stand unless
                                     --quarantine moves corrupt files aside (preserving evidence) first.
  migrate-chapter-identity <bookId> [--apply] [--json]
                                     Safe migration for chapterId/filename/index drift: plans first, refuses ambiguous
                                     mappings, then atomically aligns filename + chapterId + canonical index and writes a
                                     migration report. Dry-run by default.
  next-task <bookId>                 INLINE-OPERATOR MODE: scans on-disk state for a book and
                                     prints the next artifact to produce (bibliography, chapter
                                     source, chapter output, finalize), with playbook path and
                                     validation command. Read the printed playbook, produce the
                                     artifact inline (no subprocess), save to the printed path,
                                     re-run next-task. Loop until "all done".
  runbook <bookId> [--json]          Operator control panel: phase + strict env (live OK/MISSING) +
                                     source-v2/source-verify state + qc round + next command + prompt +
                                     blockers. --json feeds the same model to a harness.
  diagnose <bookId>                  Triage "why didn't this book pass?": runs book-status + major-status
                                     + source-verify-check + qc-diagnose (latest round) in one pass.
  qc-metrics [--last N] [--json]     Quality telemetry over the last N books: first-pass publishable rate,
                                     avg rounds to pass, top failing bar axis, top deterministic blocker.
  check-source <bookId>              Run the source-coherence critic against the latest research
                                     bundle for a book. Use after producing bibliography + every
                                     chapter source via the research playbook. Exits 0 on PASS.
  source-verify <bookId> [--write p] Emit the operator sidecar-vs-reality verification packet
                                     (claim-by-claim + entity-existence + URL-liveness). check-source
                                     proves STRUCTURE; this proves the sidecar is TRUE before writing.
  source-verify-check <bookId> [--record p] Read the FILLED record back; reject rubber-stamps / non-VERIFIED items
  source-verify-schema               Print the JSON Schema for a filled source-verify record (bind as GPT response_format)
  source-verify-workbench <bookId>   Emit a local offline HTML form to fill the record per item (verdict/sourceRef/note,
                                     copy-search-query); its Download button writes the JSON source-verify-check reads.
  source-verify-import <bookId> --record <p>  Copy a filled record (e.g. the workbench download) to the CANONICAL
                                     path the publish gate reads, after validating it parses.
  source-fit <bookId> [--json]       ADVISORY research-time fit classifier: OK/WATCH/RISKY from sidecar diversity
                                     (thin chapters, figure concentration, framework repetition). Catch a doomed run
                                     before writing. Never blocks (exits 0). Calibrated zero-RISKY on the clean corpus.
  prune-book-state <bookId> [--apply] After a book is PUBLISHED, sweep its leftover UNtracked working state
                                     (key-packs, blind submissions, authoring cards, prior QC rounds, the source-
                                     sidecar cache; ~7 MB/book) so the worktree stays lean. Keeps every git-tracked
                                     artifact + the source-verify record. Dry-run by default; --apply deletes. [--json]
  derive-artifacts <bookId>          Inline-operator helper: derives the book-pattern-audit
                                     prerequisites (state/briefs/<bookId>.manual-brief.json +
                                     state/plans/<chapterId>.manual-plan.json per chapter) from
                                     the bibliography + cached chapters. Run after writing all
                                     chapters, before generate-book.
  research "<title>" "<author>" [--book-id <slug>] [--concurrency N] [--force-refresh]
                                     SUBPROCESS MODE: run the researcher via claude -p subprocess
                                     calls. Counts against your Max subscription quota.
  generate "<title>" "<author>" [--book-id <slug>] [--from N] [--to N] [--skip-research] [--force]
                                     SUBPROCESS MODE: end-to-end fresh generation.
                                     Counts against your Max subscription quota.
  pipeline <bookId> --title X --author Y [--policy economy|standard|premium|publish] [--research|--skip-research]
                                     Preferred v22 optimized autonomous run with live terminal phases, cost telemetry,
                                     adaptive examples, risk-gated polish, deterministic final gates.
  flow <bookId> --title X --author Y [--policy economy|standard|premium|publish] [--research|--skip-research]
                                     Alias of pipeline, retained for compatibility.
  policy [economy|standard|premium|publish]
                                     Print the v22 run policy cost/quality contract.
  generate-book <bookId> --title X --author Y [--from N] [--to N] [--policy economy|standard|premium|publish] [--force] [--no-categorizer --categories A,B --tags x,y]
                                     Lower-level: generate (or resume) every chapter of a book
                                     using an existing chapter index. Full canonical runs auto-promote
                                     on success; --from/--to range runs stop before production promotion.
                                     For inline-operator mode (no subprocess calls), pre-populate
                                     state/chapters/ and use --no-categorizer with manual metadata.
  promote-book <bookId> --title X --author Y [--categories A,B] [--tags x,y]
                                     Final gate. Requires the complete canonical index, then re-validates
                                     every chapter + book-level checks + the QC-attestation gate, and writes book-packages/<id>.v21.json on
                                     success. Categories/tags are auto-derived (no-API) from the book's
                                     content when not given; pass --categories/--tags to override.
                                     Unresolved serious generation-debt events block; exact-content
                                     waivers live at state/waivers/<bookId>.generation-degradation-waivers.json.
                                     Quarantines to state/books/_blocked/ on failure.
  verify-production-package <bookId|package.json> [--compare-loose-state] [--json] [--state-root p] [--runs-root p] [--record-path p] [--exemptions-file p]
                                     Read-only production verifier: recomputes the manifest payload from
                                     the canonical index, package chapters, source evidence, source-reality
                                     evidence, build-input fingerprints, and QC evidence.
                                     Exits 0 only when the package content ID is independently verified.
  publish "<book name or id>" [--title X --author Y] [--categories A,B] [--tags x,y]
                                     One-verb ship. Resolves the book, auto-fills title/author from its
                                     brief, then runs promote-book (so it CANNOT ship a book that has not
                                     passed QC). Run after qc-auto ... --pass reports PASS.
  publish-to-live <bookId> [--commit] [--outer-root <path>]
                                     Sandbox→live bridge. Verifies the LOCAL book-packages/<id>.v21.json
                                     (production verifier), copies it to the OUTER checkout root's
                                     git-tracked book-packages/ (what the live app bundles), byte-hash
                                     verifies the copy, and probes lib/bookPackages.ts registration.
                                     Report-only by default; --commit stages+commits ONLY that file in
                                     the outer repo (never pushes; refuses if it is already staged/dirty
                                     there from other work).
  qc-stamp-author <bookId> [--chapters 1,2] [--session <id>]
                                     Record the authoring session (state/provenance/) so a later FRESH QC
                                     session can't grade its own work when
                                     CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1. Uses CHAPTERFLOW_SESSION_ID.
  book-status "<book name or id>" [--json]
                                     The whole lifecycle in one view: research → written → gate-clean →
                                     QC'd → publishable, a cross-book variety read (advisory), and the
                                     single exact next command. Read-only.
  doctor [<bookId>] [--json]         Preflight: catches the shadow state dir, dual brief shapes,
                                     chapter-number drift, and untracked-but-imported source files before
                                     they cost a run. Exit 0 healthy / 1 warnings / 2 blocking trap.
  authoring-guardrails <bookId> [--chapters N]
                                     Write the pre-authoring sheet (per-chapter reserved names +
                                     banned-phrase registry: house tics, forbidden moves, salting
                                     connectives, cross-book signature tells) for parallel authors.
  author-check <chapter.json>        Phase 1: run the authoring-contract (field-JOB) checks Codex uses to
                                     converge in-session. Advisory/shadow (calibrated 0 false-positives).
                                     Exit 1 on any finding so a write loop iterates to clean.
  gate-chapter <chapter.json>        Run the per-chapter ship gate against a single chapter JSON.
  publishable-rubric                 Print the 9-axis publishable-bar rubric the QC reviewer uses, so a
                                     writer self-scores its draft before submit (gate-clean ≠ bar PUBLISHABLE).
                                     Useful when an agent is producing chapters by hand (e.g.,
                                     Codex sessions writing inline) and wants to validate
                                     output before saving / before assembling a book package.
                                     Exits 0 if no blockers; non-zero otherwise.
  book-gate <bookId>                 Run the full book gate against every chapter on disk for
                                     <bookId>. Auto-runs derive-artifacts first so the brief +
                                     plan checks (BP7) don't false-fire. The default standalone
                                     way to QC an assembled book without invoking generate-book.
                                     Exits 0 if no blockers; non-zero otherwise.
  shape-plan <bookId> --from N --to M
                                     PRE-AUTHORING: deal each chapter a slot-pinned palette of
                                     structurally distinct scene shapes (the anti-skeleton plan;
                                     fanout runs it automatically)
  pedagogy-plan <bookId> --from N --to M
                                     PRE-AUTHORING: deal each book/chapter a hook shape,
                                     try-this-now grammar, and quiz-opener pair so catalog-level
                                     pedagogy slots vary before parallel authoring. Writes
                                     state/pedagogy-plans/<bookId>.pedagogy-plan.json.
  name-plan <bookId> --from N --to M [--per-chapter K]
                                     PRE-AUTHORING: deal each upcoming chapter a disjoint
                                     protagonist-name slice (excludes current-book planned names
                                     and catalog cooldown names) and emit banned-connective guidance, so parallel STEP-2
                                     agents can't collide on book-gate F1 / BP13. Writes
                                     state/name-plans/<bookId>.name-plan.json. Default K=7.
                                     Exit 1 if the name bank ran dry for any chapter.
  qc-attest <chapter.json> --verdict PUBLISHABLE|REVISE|CORRUPTION --reviewer <id> [--notes "..."]
                                     Add --round <roundId> --token <token> in no-api Codex QC mode.
  qc-open-round <bookId>             Open a role-separated QC round and print plaintext role tokens once.
  qc-orchestrate <bookId> --create [--chapters 1,2]
                                     Create a v21.2 no-api Codex QC orchestration round, task cards,
                                     packs, append-only repair ledger, and repair brief.
  qc-orchestrate <bookId> --collect --round <roundId>
                                     Validate stored submissions, merge the repair ledger, and write
                                     repair artifacts. Never writes chapter attestations.
  qc-orchestrate <bookId> --confirm-candidates --round <roundId>
                                     Generate confirm task cards only for chapters whose current
                                     evidence is a publishable candidate.
  qc-orchestrate <bookId> --finalize --round <roundId> [--chapters 1,2] [--no-attest] [--dry-run]
                                     Build evidence-matrix.json and write only evidence-backed
                                     PUBLISHABLE/REVISE/CORRUPTION attestations. NEEDS_MORE_QC is
                                     recorded in the matrix and never attested. --dry-run previews
                                     the verdict and writes NOTHING (no attestations/matrix/ledger).
  qc-orchestrate <bookId> --render-repair --round <roundId>
                                     Render repair-ledger.jsonl to repair-brief.md.
  qc-orchestrate <bookId> --verify-repair --round <roundId>
                                     Re-run repair validation and append stale/still-open/QC-rerun statuses.
  qc-submit <bookId> --round <roundId> --role sweep|keyA|keyB|bar|confirm|major --token <token> --file <submission.json> [--variant t2|t3]
                                     Validate and store a structured QC submission for an orchestrated round.
                                     --variant t2|t3: a bar self-consistency tiebreak read (see qc-auto --tiebreak).
  qc-schema <role|schemaVersion>     Print the JSON Schema for a QC submission role — bind as a GPT
                                     structured-output response_format (the CLI still re-checks cross-field rules).
  roles [<roleId>]                   List the pipeline roles with recommended GPT reasoning/verbosity,
                                     or print one role's full profile (roles/ROLE-DEFINITIONS.json).
  qc-auto "<book name or id>" --pass [--round <id>] [--chapters 1,2] [--incremental] [--tiebreak] [--max-agents N] [--dry-run] [--no-attest] [--allow-stale-round]
                                     One-command no-api Codex QC autopilot. Creates/reuses a round,
                                     writes workflow tasking, collects submissions, finalizes evidence,
                                     and reports PASS/REPAIR/INCOMPLETE without using paid APIs.
                                     --tiebreak: borderline bar reads get extra independent reads, combined by median.
  qc-diagnose <bookId> --round <roundId>
                                     Explain evidence-matrix verdicts, common failures, repair prompt,
                                     and the exact next QC command.
  publish-after-qc "<book name or id>" --round <roundId> [--title "..."] [--author "..."] [--commit] [--push] [--cleanup transient|none|audit-unsafe] [--include-state] [--dry-run]
                                     Verifies no-api QC pass, promotes/registers the book, removes
                                     one-time token/task/repair artifacts, and optionally commits/pushes
                                     the final production outputs.
  qc-ledger-status <bookId> --round <roundId>
                                     Summarize the append-only orchestrator repair ledger.
  qc-ledger-repair <bookId> --round <roundId> [--confirm]
                                     Quarantine malformed repair-ledger JSONL lines and rewrite
                                     only the valid events. Without --confirm, reports what would move.
  qc-repair-brief <bookId> --round <roundId>
                                     Render and print the repair brief and pasteable repair prompt paths.
  qc-repair-prompt <bookId> --round <roundId>
                                     Render and print only the pasteable Writer Codex repair prompt path.
  source-v2-gate <bookId> [--prewrite]  Source gate; --prewrite also blocks thin realness advisories before writer fanout
                                     with centralConcept, namedExamples, hardSpecifics, and testableFacts.
  qc-converge <bookId> [--chapters 1,2] [--json] [--out <path>]
                                     Deterministic preflight. Runs the FULL deterministic battery (source-v2,
                                     ship-gate, author-check, intra-book, book-gate, plan-enforcement) and
                                     reports DETERMINISTIC-CLEAN / DIRTY WITHOUT opening a formal QC round.
                                     Run after every repair until CLEAN, THEN qc-auto — so a formal round
                                     never burns submissions rediscovering a mechanical nit. Exit 0=clean, 1=dirty.
  book-autopilot <bookId> [--regen] [--plan] [--no-publish] [--author] [--legacy] [--max-repair N] [--max-parallel N]
                                     END-TO-END conductor. Drives research → write → gate → QC(+≤3 repair)
                                     → ready-to-publish, spawning codex exec agentic sub-sessions for the
                                     WORK (distinct CHAPTERFLOW_SESSION_ID each) while deterministic code owns
                                     the DECISIONS. Runs on the Codex subscription (NO API metering). On QC
                                     convergence AUTO-PUBLISHES (full promote gate, then commit+push to main —
                                     NOT a live deploy); --no-publish halts for review. --plan previews the plan.
                                     --regen RE-RUNS an already-published book (else it's skipped as "shipped").
  book-run <bookId> [--regen] [--max-parallel N] [--max-repair N] [--plan] [--no-publish] [--author] [--legacy] [--no-notify] [--sound] [--log <file>]
                                     SAME conductor as book-autopilot, wrapped to print a clean timestamped
                                     update AND a macOS notification on every MAJOR event (research / write /
                                     gate / QC round + publishable tally / repair / warnings / final). One
                                     input, walk away, get pinged. --no-notify = terminal only; --log appends
                                     an event log. Changes no pipeline behavior; same gates, env, exit code.
  compile-source-packets <bookId>    v23 compiler: compile source-v2 sidecars into compact source packets.
  source-packet-gate <bookId>        v23 compiler: validate compiled source packets before blueprints.
  compile-book-design <bookId>       v23 compiler: derive the per-book variety pools artifact.
  book-design-gate <bookId>          v23 compiler: validate the per-book design artifact (BD1-BD5).
  compile-chapter-briefs <bookId>    v24 author path: compile one-page chapter briefs (reservations + intent).
  chapter-brief-gate <bookId>        v24 author path: validate chapter briefs (BR1-BR5).
  compile-blueprints <bookId>        v23 compiler: compile deterministic per-chapter blueprints.
  blueprint-gate <bookId>            v23 compiler: validate deterministic blueprints.
  deal-section-tasks <bookId>        v23 compiler: write narrow Codex task cards for section artifacts.
  validate-sections <bookId>         v23 compiler: validate summary/example/learning/action section artifacts.
  assemble-sections <bookId>         v23 compiler: assemble section artifacts into ChapterV21 files.
  build-evidence-maps <bookId>       v23 compiler: create ChapterEvidenceMap artifacts for assembled chapters.
  evidence-gate <bookId>             v23 compiler: validate evidence maps before formal QC.
  risk-score <bookId>                v23 compiler: compute risk lanes; high-risk only gets narrow QC shadow.
  rubric-metrics <bookId> [--json] [--gate]
                                     v23 compiler: deterministic rubric pre-flight over assembled chapters
                                     (readability, distractor-tell, transfer, memorable lines). Writes
                                     state/books/<bookId>.rubric-metrics.json. --gate exits 1 on any fail chapter.
  reader-budget-check <bookId> [--rep-cap N] [--length N] [--tolerance F] [--package <path>] [--json]
                                     v24 B3: five deterministic reader-correlated checks (CHB1-CHB5: anchor
                                     repetition, length budget, cast disjointness, opener signature, practice
                                     format). Loads state/chapters (fallback book-packages/<id>.v21.json or
                                     --package) plus compiled source packets when present. Read-only report;
                                     exits 1 on any blocker. NOT wired into any gate (conductor wires it).
  codex-agent-run <task-file> [--session <id>] [--sandbox ...] [--timeout-ms N]
                                     Debug: spawn ONE headless codex exec agent with a task file as its
                                     instruction; prints the result. Proves codex exec works before autopilot.
  key-pack <bookId> --round <id>     Write blind manual quiz-key packs under state/qc-packs/.
  key-derive <bookId> --round <id> --role keyA|keyB --token X --answers-file path
                                     Validate and store a blind key reader's answers.
  key-resolve <bookId> --round <id>  Resolve keyA/keyB derivations into manual-keyjudge records.
  bar-pack <bookId> --round <id>     Write a full-book publishable-bar QC pack + scores template.
  bar-attest <bookId> --round <id> --token X --scores-file path --reviewer <id>
                                     Validate full bar-score coverage and batch-write qc attestations.
  sweep-pack <bookId> --round <id>   Write the book-level sweep pack for a QC round.
  sweep-attest <bookId> --round <id> --token X --verdict PASS|REVISE|CORRUPTION --reviewer <id> --findings-file path
                                     Record the sweep verdict, checked families, findings, and chapter hashes.
  sweep-status <bookId>              Show the latest sweep attestation status.
  major-status <bookId>              Show current major findings and their dispositions.
  major-disposition <bookId> --finding <id> --status open|waived_false_positive|waived_accepted_debt --reason X --reviewer X --round <id> [--token X]
                                     Record an explicit disposition for a current major finding.
  qc-verdict <chapterId> --scores '<json>'|--scores-file <path>
                                     Reduce per-axis scores to the verdict via the REAL computeVerdict
                                     (corruption veto + floors are mechanical — exit 0 GREEN / 1 YELLOW / 2 RED)
                                     SEMANTIC GATE (no-API): record a Claude reviewer's verdict,
                                     stamped with the chapter's content hash, to state/qc/. promote
                                     requires a fresh PUBLISHABLE attestation per chapter; editing the
                                     chapter afterward makes it stale and forces re-review.
  qc-stats [bookId]                  Revision-rate instrumentation: first-pass PUBLISHABLE rate,
                                     attempts per chapter, verdict mix, human-vs-harness reviewers
  qc-rehash <bookId>|--all           Upgrade unchanged v1-hash attestations to the v2 content hash
  qc-run <bookId> [--chapters 1,2]   Generate the harness QC workflow (blind keys + dual-lens bar reads
                                     + cross-chapter sweep + adjudication + qc-attest)
  catalog-audit [bookId] [--save]    Cross-book fingerprint metrics (hook/exercise/quiz monoculture,
                                     house tics, name collisions, distractor tell) + variety score
  quiz-judge <bookId> [--chapters 1,2] [--provider openai-api]
                                     Model-backed answer-key audit (hidden-key): derives each answer
                                     independently and flags confident wrong keys. Writes
                                     state/qc/<bookId>-chNN.keyjudge.json; a fresh flagged result BLOCKS
                                     promote (QC1.wrong_quiz_key). Exit 1 if any wrong key, 2 on infra.
  quiz-blind <chapter.json>          Print the quiz with the answer key stripped (hidden-key protocol)
  quiz-verify <chapter.json> --answers "0:1,..."  Diff blind-derived answers against the real key
  evidence-audit <chapter.json>      List every named person carrying a finding (invented witness /
                                     "Piper move" + testimonial-as-proof) as a disposition checklist
  qc-status <bookId>                 Per-chapter QC-attestation coverage: PASS / STALE / REVISE /
                                     CORRUPTION / MISSING. Exit 0 iff every chapter is ship-ready.
  fanout <bookId> [--from N --to M] [--all]
                                     Print a ready-to-paste authoring prompt for each chapter still to
                                     write — title, real source-notes path, allocated names, save path,
                                     pedagogy slots, and self-gate command all filled in. Paste each block into its own
                                     Codex agent to write the book in parallel. Runs name-plan, shape-plan,
                                     and pedagogy-plan for you.
                                     Skips already-written chapters unless --all.
  categorize <bookId>                Preview the no-API auto-categorizer's pick (categories + tags from
                                     the book's own content). promote-book applies it automatically when
                                     --categories/--tags aren't given; pass those to override.
  register-web <bookId> [--created-by <name>] [--skip-ingest]
                                     Make a promoted book show up in the reader. (1) Static /books browse:
                                     append-only registration into app/book/data/bookPackages.ts (no
                                     existing line touched) + catalog refresh. (2) In-app reader/library:
                                     if AWS env (BOOK_TABLE_NAME / BOOK_*_BUCKET) is set, auto-runs the
                                     DynamoDB/S3 ingest; otherwise prints the command. Idempotent.
  batch <manifest.json> [--run]      MULTI-BOOK DRIVER. manifest = [{bookId,title,author},...]. Shows each
                                     book's stage (RESEARCH/AUTHOR/GATE_FIX/QC/SHIP/DONE) + a work queue
                                     with the exact next command. With --run, auto promotes + registers
                                     every book whose QC is complete. Re-run as books progress.

  Phase-0 maintenance (see MASTER-PLAN.md):
  state-status                       Per-book: chapters on disk, untracked-in-git, chapterId mismatches, promoted.
  migrate-state [--apply]            Reconcile the repo-root shadow state/chapters into the canonical dir.
                                     [--prefer-canonical|--prefer-shadow] to resolve divergent files.
  toc-migrate <bookId> [--path p]    Report TOC shape; with --apply, rewrite canonical chapterflow.toc.v1.
  fix-chapter-ids [<bookId>]         Normalize chapterId to match filename stem (--dry-run to preview).
  quarantine-book <bookId>           Pull a shipped-but-corrupt package; promote/register refuse until released
  unquarantine-book <bookId>         Release a quarantine tombstone (book must then re-pass the full gate)

  eval-reader-proxy <bookId> [<bookId2> ...] [--chapters N] [--bar 84] [--json]
                                     v24 reader-proxy instrument: deterministically sample N chapters (default 3)
                                     of each shipped package, render each as a blinded reader doc under
                                     scratch/eval-proxy/, spawn one independent read-only codex reader per
                                     chapter (parallel), byte-verify its evidence quotes + quiz-key derivations,
                                     and write state/reviews/<bookId>/ch<NN>.review.json. Prints a per-book
                                     table + median composite; --json emits the machine payload last.
  eval-book-proxy <bookId> [<bookId2> ...] [--readers 3] [--json]
                                     v24 book-level reader panel — a faithful replica of the owner's
                                     book-score instrument: score.py's md5-SEEDED 4-chapter sample rendered
                                     as ONE blinded doc, N independent readers each read ALL of it and emit
                                     the 10 rubric factors at book level + PASS/FAIL correctness gate +
                                     book3_churn; compose.py math (median factors, majority gate, churn
                                     mode). Quotes byte-verified; per-chapter key derivations checked.

  help                               This message

Examples:
  npx tsx src/cli.ts critic book-packages/atomic-habits.modern.json
  npx tsx src/cli.ts critic --all
  npx tsx src/cli.ts research "Atomic Habits" "James Clear"
  npx tsx src/cli.ts generate "Atomic Habits" "James Clear"
`);
}

function parseArgs(argv: string[]): { cmd: string; args: string[]; flags: Record<string, string | boolean> } {
  const [cmd, ...rest] = argv;
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      args.push(tok);
    }
  }
  return { cmd: cmd ?? "help", args, flags };
}

function parseCsvFlag(value: string | boolean | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const items = value.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function tocAuthorVoice(value: unknown): BibliographyResult["authorVoice"] {
  const voice = recordOrEmpty(value);
  const register = typeof voice.register === "string" && ["warm", "analytical", "plainspoken", "literary", "clinical"].includes(voice.register)
    ? voice.register as BibliographyResult["authorVoice"]["register"]
    : "plainspoken";
  return {
    register,
    signatureMoves: stringArray(voice.signatureMoves),
    avoidMoves: stringArray(voice.avoidMoves),
  };
}

function tocEdition(value: unknown, chapterCount: number): BibliographyResult["edition"] {
  const edition = recordOrEmpty(value);
  return {
    name: typeof edition.name === "string" ? edition.name : undefined,
    publisher: typeof edition.publisher === "string" ? edition.publisher : undefined,
    publishedYear: typeof edition.publishedYear === "number" ? edition.publishedYear : undefined,
    isbn13: typeof edition.isbn13 === "string" ? edition.isbn13 : undefined,
    language: typeof edition.language === "string" ? edition.language : undefined,
    chapterCount: typeof edition.chapterCount === "number" ? edition.chapterCount : chapterCount,
    sectionCount: typeof edition.sectionCount === "number" ? edition.sectionCount : undefined,
  };
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function loadBookPackage(file: string): BookPackage {
  const text = readFileSync(file, "utf8");
  return JSON.parse(text) as BookPackage;
}

function summarizeReport(rep: BookCriticReport): string {
  const lines: string[] = [];
  lines.push(`# ${rep.bookId}`);
  lines.push(`File: ${rep.bookFile}`);
  lines.push(`Generated: ${rep.generatedAt}`);
  lines.push(`Chapters: ${rep.chapterCount}`);
  lines.push(`Units scored: ${rep.unitCount}`);
  lines.push(
    `Pass rate: ${(rep.summary.passRate * 100).toFixed(1)}% (${rep.summary.passedUnits}/${rep.unitCount})`,
  );
  lines.push("");
  lines.push("## By check");
  const byCheckEntries = Object.entries(rep.summary.byCheck).sort(
    (a, b) => b[1].fail - a[1].fail,
  );
  for (const [checkId, stats] of byCheckEntries) {
    const total = stats.pass + stats.fail;
    const pct = total ? (stats.pass / total) * 100 : 0;
    lines.push(
      `  ${checkId.padEnd(42)}  pass=${stats.pass.toString().padStart(4)} fail=${stats.fail
        .toString()
        .padStart(4)}  (${pct.toFixed(1)}% pass)`,
    );
  }
  lines.push("");
  // Top 10 worst units
  const worst = [...rep.unitResults]
    .filter((u) => u.findings.length > 0)
    .sort((a, b) => b.findings.length - a.findings.length)
    .slice(0, 10);
  if (worst.length > 0) {
    lines.push("## Top 10 worst units");
    for (const u of worst) {
      lines.push(
        `  ch${u.location.chapterNumber} ${u.location.unitType}${u.location.unitId ? ` ${u.location.unitId}` : ""}${u.location.tier ? ` [${u.location.tier}]` : ""} — ${u.findings.length} finding(s)`,
      );
      for (const f of u.findings.slice(0, 3)) {
        lines.push(`    [${f.severity}] ${f.checkId}: ${f.message}`);
      }
    }
  }
  return lines.join("\n");
}

type AggregateRow = {
  bookId: string;
  file: string;
  chapters: number;
  units: number;
  passed: number;
  failed: number;
  passRate: number;
  checkStats: Record<string, { pass: number; fail: number }>;
};

function toCsvRow(r: AggregateRow, checkIds: string[]): string {
  const base = [
    r.bookId,
    r.chapters.toString(),
    r.units.toString(),
    r.passed.toString(),
    r.failed.toString(),
    (r.passRate * 100).toFixed(1),
  ];
  for (const id of checkIds) {
    const s = r.checkStats[id];
    if (s) {
      const total = s.pass + s.fail;
      const pct = total ? (s.pass / total) * 100 : 100;
      base.push(pct.toFixed(1));
    } else {
      base.push("n/a");
    }
  }
  return base.join(",");
}

async function runCritic(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  if (flags.all) {
    const files = readdirSync(BOOK_PACKAGES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => resolve(BOOK_PACKAGES_DIR, f));
    console.error(`Running critics against ${files.length} books…`);

    const rows: AggregateRow[] = [];
    const reportsDir =
      typeof flags.report === "string" ? resolve(flags.report) : DEFAULT_REPORTS_DIR;
    mkdirSync(reportsDir, { recursive: true });

    const allCheckIds = new Set<string>();
    for (const file of files) {
      try {
        const pkg = loadBookPackage(file);
        const rep = runAllCritics(pkg, file);
        writeFileSync(
          resolve(reportsDir, `${rep.bookId}.md`),
          summarizeReport(rep),
          "utf8",
        );
        writeFileSync(
          resolve(reportsDir, `${rep.bookId}.json`),
          JSON.stringify(rep, null, 2),
          "utf8",
        );

        Object.keys(rep.summary.byCheck).forEach((k) => allCheckIds.add(k));
        rows.push({
          bookId: rep.bookId,
          file: rep.bookFile,
          chapters: rep.chapterCount,
          units: rep.unitCount,
          passed: rep.summary.passedUnits,
          failed: rep.summary.failedUnits,
          passRate: rep.summary.passRate,
          checkStats: rep.summary.byCheck as any,
        });
        console.error(
          `  ${rep.bookId.padEnd(40)} pass=${(rep.summary.passRate * 100).toFixed(1)}%  (${rep.summary.passedUnits}/${rep.unitCount})`,
        );
      } catch (err) {
        console.error(`  [ERROR] ${file}: ${(err as Error).message}`);
      }
    }

    // aggregate scoreboard
    const checkIds = Array.from(allCheckIds).sort();
    const csvLines: string[] = [];
    csvLines.push(
      [
        "bookId",
        "chapters",
        "units",
        "passed",
        "failed",
        "passRate",
        ...checkIds.map((c) => `check_pct_${c}`),
      ].join(","),
    );
    for (const row of rows.sort((a, b) => a.passRate - b.passRate)) {
      csvLines.push(toCsvRow(row, checkIds));
    }
    const csvPath =
      typeof flags.csv === "string"
        ? resolve(flags.csv)
        : resolve(reportsDir, "scoreboard.csv");
    writeFileSync(csvPath, csvLines.join("\n"), "utf8");

    console.error(`\nReports written to ${reportsDir}`);
    console.error(`Scoreboard: ${csvPath}`);
    return 0;
  }

  if (args.length === 0) {
    console.error("Usage: critic <book.json> | critic --all");
    return 2;
  }
  const file = resolve(args[0]);
  const pkg = loadBookPackage(file);
  const rep = runAllCritics(pkg, file);
  console.log(summarizeReport(rep));
  return rep.summary.failedUnits > 0 ? 1 : 0;
}

async function runLedger(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const sub = args[0];
  if (!sub) {
    console.error("Usage: ledger <status|forbidden-names|ingest>");
    return 2;
  }
  const state = loadLibraryState();
  if (sub === "status") {
    console.log(`Ledger at: ${getLedgerPath()}`);
    console.log(`Last updated: ${state.lastUpdatedAt}`);
    console.log(`Books tracked: ${Object.keys(state.books).length}`);
    console.log(`Total distinct protagonist names: ${Object.keys(state.globalNameUsage).length}`);
    console.log(`Library answer position totals: idx0=${state.globalAnswerPositionCounts[0]}, idx1=${state.globalAnswerPositionCounts[1]}, idx2=${state.globalAnswerPositionCounts[2]}`);
    const totalPositions = state.globalAnswerPositionCounts.reduce((a, b) => a + b, 0);
    if (totalPositions > 0) {
      const pcts = state.globalAnswerPositionCounts.map((c) => `${((c / totalPositions) * 100).toFixed(1)}%`);
      console.log(`  distribution: ${pcts.join(" / ")}`);
    }
    console.log("");
    console.log("Books:");
    for (const book of Object.values(state.books).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))) {
      console.log(`  ${book.bookId}  chapters:${book.chaptersIngested.length}  names:${book.namesUsed.length}  (${book.generatedAt.slice(0, 10)})`);
    }
    if (Object.keys(state.globalNameUsage).length > 0) {
      console.log("");
      console.log("Top 15 reused names across library:");
      const sorted = Object.entries(state.globalNameUsage)
        .sort((a, b) => b[1].books.length - a[1].books.length)
        .slice(0, 15);
      for (const [name, usage] of sorted) {
        console.log(`  ${name.padEnd(16)} ${usage.books.length} book(s), ${usage.total} occurrences`);
      }
    }
    return 0;
  }
  if (sub === "forbidden-names") {
    const bookId = typeof flags["book"] === "string" ? (flags["book"] as string) : "__new__";
    const lookback = typeof flags["lookback"] === "string" ? parseInt(flags["lookback"] as string, 10) : 10;
    const forbidden = getForbiddenNames(state, bookId, lookback);
    console.log(`Forbidden names (last ${lookback} books, excluding "${bookId}"): ${forbidden.length}`);
    console.log(forbidden.join(", "));
    return 0;
  }
  if (sub === "ingest") {
    const chapterFile = args[1];
    if (!chapterFile || !flags["book-id"] || !flags["title"] || !flags["author"]) {
      console.error(`Usage: ledger ingest <chapter.json> --book-id X --title "Y" --author "Z"`);
      return 2;
    }
    const chapter = JSON.parse(readFileSync(resolve(chapterFile), "utf8")) as ChapterV21;
    let updatedBook: ReturnType<typeof loadLibraryState>["books"][string] | undefined;
    await withLibraryState((locked) => {
      const updated = ingestChapter(locked, flags["book-id"] as string, flags["title"] as string, flags["author"] as string, chapter);
      updatedBook = updated.books[flags["book-id"] as string];
      return updated;
    });
    const book = updatedBook;
    if (!book) throw new Error(`ledger ingest did not create book entry for ${String(flags["book-id"])}`);
    console.log(`Ingested ${chapterFile} into ${flags["book-id"]}`);
    console.log(`  book now has ${book.chaptersIngested.length} chapter(s), ${book.namesUsed.length} unique protagonist name(s)`);
    return 0;
  }
  console.error(`Unknown ledger sub: ${sub}`);
  return 2;
}

function printLibraryDriftReport(report: ReturnType<typeof verifyLibraryState>): void {
  console.log(`Library state: ${report.statePath}`);
  console.log(`Drift: ${report.drift ? "YES" : "no"}`);
  for (const diff of report.differences) console.log(`  - ${diff}`);
}

async function runVerifyLibraryState(flags: Record<string, string | boolean>): Promise<number> {
  const report = verifyLibraryState();
  if (flags.json === true) console.log(JSON.stringify(report, null, 2));
  else printLibraryDriftReport(report);
  return report.drift ? 1 : 0;
}

function formatLibraryFinding(f: LibraryAuditFinding): string {
  const where = `${f.bookId ? ` ${f.bookId}` : ""}${f.chapter !== undefined ? ` ch${f.chapter}` : ""}`;
  return `  [${f.severity}] ${f.checkId}${where} — ${f.reason}\n      ↳ ${f.path}`;
}

function printLibraryAudit(report: LibraryAuditReport): void {
  console.log(`Library state: ${report.ledgerPath}`);
  console.log(`Drift: ${report.drift ? "YES" : "no"}   Blockers: ${report.blockerCount}   Accepted files: ${report.accepted.length}`);
  console.log(`Conflicts (package/loose, package wins): ${report.conflicts.length}   Advisory warnings: ${report.warnings.length}`);
  if (report.rejected.length) {
    console.log(`\nBLOCKERS (rejected authoritative inputs — nothing is silently skipped):`);
    for (const f of report.rejected) console.log(formatLibraryFinding(f));
  }
  if (report.conflicts.length) {
    console.log(`\nPACKAGE/LOOSE CONFLICTS (published package is authoritative; loose drafts not ingested):`);
    for (const f of report.conflicts.slice(0, 40)) console.log(formatLibraryFinding(f));
    if (report.conflicts.length > 40) console.log(`  …and ${report.conflicts.length - 40} more`);
  }
  if (report.warnings.length) {
    console.log(`\nADVISORY:`);
    for (const f of report.warnings.slice(0, 40)) console.log(formatLibraryFinding(f));
    if (report.warnings.length > 40) console.log(`  …and ${report.warnings.length - 40} more`);
  }
  if (report.plannedWrites.length) {
    console.log(`\nPLANNED WRITES:`);
    for (const w of report.plannedWrites) console.log(`  ${w.action}: ${w.path} — ${w.reason}`);
  }
}

/**
 * `rebuild-library-state [--dry-run] [--json] [--quarantine]`
 *
 * Recompute the ledger from the authoritative inputs under an explicit authority
 * policy (published package wins; loose state is authoritative only for
 * unpublished books). A dry run NEVER writes. A real rebuild REFUSES to write
 * while any blocker stands, unless `--quarantine` first moves the offending
 * files aside (preserving evidence). Exit: 2 = blockers present, 1 = drift
 * remains, 0 = clean.
 */
/** Library-state opts, overridable via CHAPTERFLOW_STATE_DIR so the CLI contract
 *  (exit codes, no-write dry runs, quarantine) is testable against an isolated
 *  state dir instead of the real one. */
function libraryOpts(): { stateDir?: string } {
  const dir = process.env.CHAPTERFLOW_STATE_DIR;
  return dir ? { stateDir: resolve(dir) } : {};
}

async function runRebuildLibraryState(flags: Record<string, string | boolean>): Promise<number> {
  const dryRun = flags["dry-run"] === true;
  const json = flags.json === true;
  const opts = libraryOpts();

  if (!dryRun && flags["quarantine"] === true) {
    const pre = auditLibraryInputs(opts);
    if (pre.blockerCount > 0) {
      const q = quarantineLibraryBlockers(opts, "rebuild");
      if (!json) {
        console.log(`Quarantined ${q.movedFiles.length} blocker file(s) → ${q.reportPath}`);
        for (const m of q.movedFiles) console.log(`  ${m.from}  →  ${m.to}`);
      }
    }
  }

  const report = auditLibraryInputs(opts);

  if (dryRun) {
    if (json) console.log(JSON.stringify(report, null, 2));
    else printLibraryAudit(report);
    if (report.blockerCount > 0) return 2;
    return report.drift ? 1 : 0;
  }

  if (report.blockerCount > 0) {
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
      printLibraryAudit(report);
      console.error(
        `\nREFUSING to rebuild: ${report.blockerCount} blocker(s) above. Reconcile fixable identity drift with ` +
          `\`migrate-chapter-identity <bookId>\`, or re-run with \`--quarantine\` to move corrupt files aside first.`,
      );
    }
    return 2;
  }

  // Idempotent: when the stored ledger already matches the authoritative inputs
  // there is nothing to write, so a second rebuild leaves the file byte-identical
  // (no spurious revision/timestamp churn, no diff).
  if (!report.drift) {
    if (json) console.log(JSON.stringify({ phase: "noop", report }, null, 2));
    else {
      console.log("Library ledger already matches the authoritative inputs; nothing to rebuild.");
      printLibraryAudit(report);
    }
    return 0;
  }

  await withLibraryState(() => rebuildLibraryState(opts), opts);
  const after = auditLibraryInputs(opts);
  if (json) console.log(JSON.stringify({ phase: "after", report: after }, null, 2));
  else {
    console.log("Rebuilt the library ledger from authoritative inputs.");
    printLibraryAudit(after);
  }
  return after.drift ? 1 : 0;
}

/**
 * `migrate-chapter-identity <bookId> [--apply] [--json]` — the safe migration
 * path for chapterId/filename/index drift. Plans first, refuses ambiguous
 * mappings, and (with --apply) updates filename + chapterId + canonical index
 * atomically while preserving a migration report.
 */
async function runMigrateChapterIdentity(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const guard = shadowGuard();
  if (guard) return guard;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: migrate-chapter-identity <bookId> [--apply] [--json]");
    return 2;
  }
  const { planChapterIdentityMigration, applyChapterIdentityMigration } = await import("./librarian/identityMigration.js");
  const mopts = process.env.CHAPTERFLOW_STATE_DIR ? { stateDir: resolve(process.env.CHAPTERFLOW_STATE_DIR) } : {};
  const plan = planChapterIdentityMigration(bookId, mopts);
  const apply = flags["apply"] === true;
  const json = flags.json === true;

  if (!plan.ok) {
    if (json) console.log(JSON.stringify({ plan }, null, 2));
    else {
      console.error(`migrate-chapter-identity — ${plan.bookId}: AMBIGUOUS, refusing to apply.`);
      for (const a of plan.ambiguities) console.error(`  - ${a}`);
    }
    return 2;
  }

  if (!apply) {
    if (json) console.log(JSON.stringify({ plan, dryRun: true }, null, 2));
    else {
      console.log(`migrate-chapter-identity — ${plan.bookId} (dry-run, no files written)`);
      console.log(`  canonical index: ${plan.indexPath}${plan.indexPresent ? "" : " (absent)"}`);
      console.log(`  ${plan.changeCount} chapter(s) need alignment:`);
      for (const s of plan.steps) {
        const ops = [s.renameFile ? "rename" : null, s.rewriteChapterId ? "chapterId" : null, s.updateIndex ? "index" : null].filter(Boolean).join("+");
        console.log(`    ch${s.chapterNumber}: ${s.fromChapterId || "(none)"} → ${s.toChapterId}  [${ops}]`);
      }
      if (plan.changeCount === 0) console.log("    already aligned; nothing to do.");
      console.log("  re-run with --apply to write.");
    }
    return 0;
  }

  if (plan.changeCount === 0) {
    if (json) console.log(JSON.stringify({ plan, applied: [] }, null, 2));
    else console.log(`migrate-chapter-identity — ${plan.bookId}: already aligned; nothing to apply.`);
    return 0;
  }

  const result = applyChapterIdentityMigration(plan, mopts);
  if (json) console.log(JSON.stringify({ plan, result }, null, 2));
  else {
    console.log(`migrate-chapter-identity — ${plan.bookId}: applied ${result.applied.length} change(s), index ${result.indexUpdated ? "updated" : "unchanged"}.`);
    console.log(`  plan:   ${result.planPath}`);
    console.log(`  report: ${result.reportPath}`);
  }
  return 0;
}

async function runGenerateBook(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: generate-book <bookId> --title X --author Y [--from N] [--to N] [--policy economy|standard|premium|publish] [--force] [--no-categorizer --categories A,B --tags x,y]");
    return 2;
  }
  const title = typeof flags["title"] === "string" ? flags["title"] : null;
  const author = typeof flags["author"] === "string" ? flags["author"] : null;
  if (!title || !author) {
    console.error("Both --title and --author are required.");
    return 2;
  }
  const fromChapter = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : undefined;
  const toChapter = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : undefined;
  const noCategorizer = flags["no-categorizer"] === true;
  const manualCategories = parseCsvFlag(flags["categories"]);
  const manualTags = parseCsvFlag(flags["tags"]);
  const force = flags["force"] === true;
  const { parseRunPolicyName, runPolicy } = await import("./policy/runPolicy.js");
  const policy = runPolicy(parseRunPolicyName(flags["policy"]));

  const { generateBook, loadChapterIndex } = await import("./generateBook.js");
  const chapters = loadChapterIndex(bookId);
  const result = await generateBook(
    { bookId, title, author },
    chapters,
    {
      fromChapter,
      toChapter,
      continueOnError: false,
      noCategorizer,
      manualCategories,
      manualTags,
      force,
      runPolicy: policy,
    },
  );
  // Failed chapters are a failure even when the book gate over the PARTIAL
  // set passes — the model-gen guard's abort used to exit 0 here.
  if (result.failed.length > 0) return 1;
  return result.bookGate.passed ? 0 : 1;
}

/** `derive-artifacts <bookId>` — for inline-operator mode. Reads the bibliography
 *  (latest run's toc.json) + every cached chapter, and writes the minimal manual
 *  artifacts the book-pattern audit (BP7) requires:
 *    - state/briefs/<bookId>.manual-brief.json
 *    - state/plans/<chapterId>.manual-plan.json per chapter
 *  Without these, generate-book's book gate fails closed on BP7. The inline
 *  playbooks instruct the operator to run this between writing every chapter
 *  and running finalization. */
async function runDeriveArtifacts(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: derive-artifacts <bookId>");
    return 2;
  }
  const REPO = resolve(__dirname, "..");
  const RUNS_DIR = resolve(REPO, ".chapterflow/runs");
  const STATE_DIR = resolve(__dirname, "../state");
  const { findRunArtifact } = await import("./lib/runDirs.js");
  const tocPath = findRunArtifact(RUNS_DIR, bookId, "source-freeze/toc.json");
  const indexPath = resolve(STATE_DIR, "indexes", `${bookId}.json`);

  if (!tocPath) {
    console.error(`No compatible research run with a toc.json for "${bookId}". Run the research playbook first.`);
    return 2;
  }
  if (!existsSyncFs(indexPath)) {
    console.error(`Chapter index missing: ${indexPath}`);
    return 2;
  }
  const { parseTocFile, formatTocIssues } = await import("./lib/tocContract.js");
  const tocParsed = parseTocFile(tocPath, { bookId });
  if (!tocParsed.ok) {
    console.error(`Bibliography invalid: ${formatTocIssues(tocParsed.issues)}`);
    return 2;
  }
  const toc = tocParsed.toc;
  const voice = tocAuthorVoice(toc.authorVoice);
  const index: Array<{ chapterId: string; chapterNumber: number; chapterTitle: string }> =
    JSON.parse(readFileSync(indexPath, "utf8"));

  // ── Brief stub ──────────────────────────────────────────────────────────
  const briefDir = resolve(STATE_DIR, "briefs");
  mkdirSync(briefDir, { recursive: true });
  const briefPath = resolve(briefDir, `${bookId}.manual-brief.json`);
  const brief = {
    bookId,
    title: toc.title,
    author: toc.author,
    thesisParagraph: toc.thesis ?? "",
    coreIdeas: [],
    targetReader: "",
    voiceCharter: {
      register: voice.register,
      person: "third",
      cadence: "medium",
      signatureMoves: voice.signatureMoves,
      avoidMoves: voice.avoidMoves,
    },
    teachingArc: toc.teachingArc ?? "",
    forbiddenMoves: [],
    derivedFromInlineMode: true,
    derivedAt: new Date().toISOString(),
  };
  writeFileSync(briefPath, JSON.stringify(brief, null, 2), "utf8");
  console.log(`Wrote ${briefPath}`);

  // ── Per-chapter plan stubs ──────────────────────────────────────────────
  const plansDir = resolve(STATE_DIR, "plans");
  mkdirSync(plansDir, { recursive: true });
  let chaptersFound = 0;
  let chaptersMissing = 0;
  for (const spec of index) {
    const chapterPath = resolve(STATE_DIR, "chapters", `${spec.chapterId}.v21-native.chapter.json`);
    if (!existsSyncFs(chapterPath)) {
      console.log(`  skipping ${spec.chapterId} (chapter JSON not yet produced)`);
      chaptersMissing++;
      continue;
    }
    const chapter = JSON.parse(readFileSync(chapterPath, "utf8"));
    // Derive coreMove from the chapter itself — pick the keyTakeaway as the
    // most concise single-sentence statement of the chapter's mental move.
    const coreMove: string =
      typeof chapter.keyTakeaway === "string"
        ? chapter.keyTakeaway
        : `Chapter ${chapter.number} teaches the move named in its title.`;
    // Derive Bloom's mix from the chapter's actual quiz distribution.
    const bloomsMix: Record<string, number> = {};
    for (const q of chapter.quiz?.questions ?? []) {
      const lvl = q.bloomsLevel ?? "apply";
      bloomsMix[lvl] = (bloomsMix[lvl] ?? 0) + 1;
    }
    const exampleSpecs = (chapter.examples ?? []).map((ex: any) => ({
      domain: ex.planSpec?.domain ?? ex.title ?? "",
      audience: ex.planSpec?.audience ?? "",
      stakes: ex.planSpec?.stakes ?? "",
      format: ex.planSpec?.format ?? "decision_point",
      requiredBeat: ex.planSpec?.requiredBeat ?? "",
    }));
    const plan = {
      chapterId: spec.chapterId,
      number: spec.chapterNumber,
      title: spec.chapterTitle,
      coreMove,
      exampleCount: chapter.examples?.length ?? 0,
      exampleSpecs,
      quizFocus: {
        count: chapter.quiz?.questions?.length ?? 0,
        bloomsMix,
        transferEmphasis: 1.0,
      },
      cardFocus: {
        count: chapter.reviewCards?.length ?? 0,
        retrievalPractice: true,
      },
      readingTimeMinutes: chapter.readingTimeMinutes ?? 10,
      derivedFromInlineMode: true,
      derivedAt: new Date().toISOString(),
    };
    const planPath = resolve(plansDir, `${spec.chapterId}.manual-plan.json`);
    writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf8");
    console.log(`Wrote ${planPath}`);
    chaptersFound++;
  }
  console.log(`\nDerived ${chaptersFound} plan(s); ${chaptersMissing} chapter(s) still pending.`);
  return 0;
}

/** `check-source <bookId>` — run the source-coherence critic over the latest
 *  research bundle for a book. Used by the inline-operator research playbook
 *  to validate the bibliography + chapter sources before any chapter writing.
 *  Exits 0 on PASS, 1 on BLOCK. */
async function runCheckSource(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: check-source <bookId>");
    return 2;
  }
  const REPO = resolve(__dirname, "..");
  const RUNS_DIR = resolve(REPO, ".chapterflow/runs");
  const { resolveResearchRun } = await import("./lib/runDirs.js");
  const run = resolveResearchRun(RUNS_DIR, bookId, {
    requiredArtifactRelPath: "source-freeze/toc.json",
    allowedStatuses: ["running", "failed", "coherence_failed", "complete"],
  });
  if (!run.ok) {
    console.error(`No compatible research run with a toc.json for "${bookId}". Run the research playbook first.`);
    return 2;
  }
  const runDir = run.runDir;
  const tocPath = resolve(runDir, "source-freeze", "toc.json");
  if (!existsSyncFs(tocPath)) {
    console.error(`Bibliography missing: ${tocPath}`);
    return 2;
  }
  const { parseTocFile, formatTocIssues } = await import("./lib/tocContract.js");
  const tocParsed = parseTocFile(tocPath, { bookId });
  if (!tocParsed.ok) {
    console.error(`Bibliography invalid: ${formatTocIssues(tocParsed.issues)}`);
    return 2;
  }
  const toc = tocParsed.toc;
  const flat: Array<{ number: number; title: string }> = tocParsed.chapters;
  const sourceDir = resolve(runDir, "sidecars", "source");
  const chapters: any[] = [];
  for (const ch of flat) {
    const numStr = String(ch.number).padStart(2, "0");
    const p = resolve(sourceDir, `ch${numStr}.source.json`);
    if (!existsSyncFs(p)) {
      console.error(`Chapter source missing: ${p}`);
      return 2;
    }
    chapters.push(JSON.parse(readFileSync(p, "utf8")));
  }
  const bibliography: BibliographyResult = {
    bookId: toc.bookId ?? bookId,
    title: toc.title,
    author: toc.author,
    edition: tocEdition(toc.edition, flat.length),
    introduction: typeof toc.introduction === "string" ? toc.introduction : undefined,
    flatChapters: flat,
    thesis: stringOrEmpty(toc.thesis),
    teachingArc: stringOrEmpty(toc.teachingArc),
    authorVoice: tocAuthorVoice(toc.authorVoice),
    confidence: toc.confidence === "medium" || toc.confidence === "low" ? toc.confidence : "high",
    notes: typeof toc.notes === "string" ? toc.notes : undefined,
  };
  const { runSourceCoherenceCheck, formatSourceCoherenceReport } = await import("./critics/sourceCoherence.js");
  const report = runSourceCoherenceCheck({ bibliography, chapters });
  // SC10 (Phase 3): source realness — v2 enforced, v1 advisory. Merge into the report.
  const { checkSourceRealness } = await import("./critics/sourceRealness.js");
  const realness = checkSourceRealness(chapters);
  report.findings.push(...realness);
  if (realness.some((f) => f.severity === "blocker")) report.passed = false;
  console.log(formatSourceCoherenceReport(report));
  return report.passed ? 0 : 1;
}

/** `source-verify <bookId> [--write <path>]` — WS-4. Emits the operator-side
 *  sidecar-vs-reality verification packet (claim-by-claim + entity-existence +
 *  URL-liveness). check-source proves STRUCTURE; this proves the sidecar is TRUE
 *  before the writer authors from it. No-API: the CLI emits, a web-enabled operator
 *  verifies. */
async function runSourceVerify(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: source-verify <bookId> [--write <path>]");
    return 2;
  }
  const { expectedSourceChapters, loadSourceV2Sidecar } = await import("./qc/sourceV2Gate.js");
  const { buildSourceVerificationPacket } = await import("./critics/sourceVerify.js");
  const chapterNumbers = expectedSourceChapters(bookId);
  if (chapterNumbers.length === 0) {
    console.error(`No research run / chapter index for "${bookId}". Run the research playbook (phase 1) first.`);
    return 2;
  }
  const sidecars = chapterNumbers.map((n) => loadSourceV2Sidecar(bookId, n)).filter((sc) => sc !== null);
  if (sidecars.length === 0) {
    console.error(`No source sidecars found for "${bookId}". Run research (phase 1) before verifying.`);
    return 2;
  }
  const packet = buildSourceVerificationPacket(bookId, sidecars);
  const { sourceVerifyRecordPath } = await import("./critics/sourceVerify.js");
  // Default the write target to the canonical path the check + publish gate read, so
  // `source-verify` (emit) and `source-verify-check` (read) agree by construction.
  const writePath = typeof flags["write"] === "string"
    ? resolve(process.cwd(), flags["write"] as string)
    : flags["write"] === true
      ? sourceVerifyRecordPath(bookId)
      : undefined;
  if (writePath) {
    mkdirSync(dirname(writePath), { recursive: true });
    writeFileSync(writePath, packet, "utf8");
    console.log(`source-verify — ${bookId}: wrote verification packet to ${writePath}`);
    console.log(`Fill every verdict/sourceRef, then: npx tsx src/cli.ts source-verify-check ${bookId}`);
  } else {
    console.log(packet);
  }
  return 0;
}

/** `source-verify-schema` — print the JSON Schema for a FILLED source-verify record, to bind
 *  as a GPT structured-output `response_format` (mirrors `qc-schema`). The verifier's record is
 *  then shape-valid by construction; `source-verify-check` still re-checks substance. */
async function runSourceVerifySchema(): Promise<number> {
  const { sourceVerifyRecordJsonSchema } = await import("./critics/sourceVerify.js");
  console.log(JSON.stringify(sourceVerifyRecordJsonSchema(), null, 2));
  return 0;
}

/** `source-fit <bookId> [--json]` — ADVISORY research-time fit classifier. Computes diversity
 *  metrics from the source-v2 sidecars (thin chapters, figure concentration, framework repetition,
 *  fact thinness) and prints an OK/WATCH/RISKY verdict so a doomed/repetitive run is caught before
 *  authoring. Never blocks — exits 0 regardless. */
async function runSourceFit(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const input = args.join(" ").trim();
  if (!input) {
    console.error("Usage: source-fit <bookId|title> [--json]");
    return 2;
  }
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  const { expectedSourceChapters, loadSourceV2Sidecar } = await import("./qc/sourceV2Gate.js");
  const { computeSourceFitMetrics, classifySourceFit, formatSourceFit } = await import("./sourceFit.js");
  const sidecars = expectedSourceChapters(bookId).map((n) => loadSourceV2Sidecar(bookId, n)).filter((sc) => sc !== null);
  if (sidecars.length === 0) {
    console.error(`No source sidecars for "${bookId}" — run research (phase 1) first.`);
    return 2;
  }
  const report = classifySourceFit(bookId, computeSourceFitMetrics(sidecars));
  if (flags["json"] === true) console.log(JSON.stringify(report, null, 2));
  else console.log(formatSourceFit(report));
  return 0;
}

async function runPruneBookState(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const input = args.join(" ").trim();
  if (!input) {
    console.error("Usage: prune-book-state <bookId> [--apply] [--keep-audit] [--json]   (dry-run by default; only a PUBLISHED book. DEFAULT = package-only: removes ALL untracked per-book state, leaving just the committed package. --keep-audit = slim sweep preserving chapters + QC attestations + source-verify for a re-publish.)");
    return 2;
  }
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  const { pruneBookStatePlan, applyPruneBookState, formatPruneBookState } = await import("./qc/pruneBookState.js");
  const scope: "transient" | "all" = flags["keep-audit"] === true ? "transient" : "all";
  const plan = pruneBookStatePlan(bookId, scope);
  if (flags["json"] === true) {
    console.log(JSON.stringify(plan, null, 2));
    return plan.status === "ok" ? 0 : 1;
  }
  if (plan.status !== "ok") {
    console.log(formatPruneBookState(plan));
    return plan.status === "not-published" ? 1 : 2;
  }
  if (flags["apply"] === true) {
    const r = applyPruneBookState(plan);
    console.log(formatPruneBookState(plan, true));
    console.log(`\nprune-book-state: removed ${r.removed} file(s), freed ~${(r.bytes / (1024 * 1024)).toFixed(1)} MB. ${scope === "all" ? "Only the committed package remains (re-publish needs a regen)." : "Committed artifacts + the source-verify record are untouched."}`);
  } else {
    console.log(formatPruneBookState(plan));
  }
  return 0;
}

/** `source-verify-workbench <bookId>` — emit a local, offline HTML form for filling the
 *  source-verify record per item (verdict dropdown + sourceRef + note + copy-search-query),
 *  instead of hand-editing the Markdown packet. Its "Download" button produces the same
 *  `source-verify-record-v1` JSON that `source-verify-check --record` already reads. No-API:
 *  the page runs entirely in the browser; the operator verifies each item against a real source. */
async function runSourceVerifyWorkbench(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: source-verify-workbench <bookId>");
    return 2;
  }
  const { expectedSourceChapters, loadSourceV2Sidecar, sourceSidecarPathFor } = await import("./qc/sourceV2Gate.js");
  const { verifiableItems } = await import("./critics/sourceVerify.js");
  const { buildSourceVerifyWorkbench } = await import("./sourceVerifyWorkbench.js");
  const chapterNumbers = expectedSourceChapters(bookId);
  if (chapterNumbers.length === 0) {
    console.error(`No research run / chapter index for "${bookId}". Run the research playbook (phase 1) first.`);
    return 2;
  }
  const chapters = chapterNumbers
    .map((n) => {
      const sc = loadSourceV2Sidecar(bookId, n);
      if (!sc) return null;
      const items = verifiableItems(sc);
      if (items.length === 0) return null;
      return { chapterNumber: n, sidecarPath: sourceSidecarPathFor(bookId, n) ?? `(chapter ${n})`, items };
    })
    .filter((c): c is { chapterNumber: number; sidecarPath: string; items: ReturnType<typeof verifiableItems> } => c !== null);
  if (chapters.length === 0) {
    console.error(`No verifiable source items for "${bookId}". Run research (phase 1) before verifying.`);
    return 2;
  }
  const html = buildSourceVerifyWorkbench(bookId, chapters);
  const outDir = resolve(process.cwd(), ".chapterflow", "source-verify", bookId);
  const htmlPath = typeof flags["out"] === "string" ? resolve(process.cwd(), flags["out"] as string) : resolve(outDir, "index.html");
  mkdirSync(dirname(htmlPath), { recursive: true });
  writeFileSync(htmlPath, html, "utf8");
  const recordPath = resolve(dirname(htmlPath), "source-verify-record.json");
  const total = chapters.reduce((n, c) => n + c.items.length, 0);
  console.log(`source-verify-workbench — ${bookId}: wrote ${total} item(s) to ${htmlPath}`);
  console.log(`Open it, verify each item against a real source, click Download (→ source-verify-record.json), then import`);
  console.log(`to the CANONICAL path the publish gate reads (avoids the two-path footgun):`);
  console.log(`  npx tsx src/cli.ts source-verify-import ${bookId} --record ${recordPath}`);
  console.log(`  npx tsx src/cli.ts source-verify-check ${bookId}    # then verify the canonical record`);
  return 0;
}

/** `source-verify-import <bookId> --record <path>` — copy a FILLED record (e.g. the workbench's
 *  downloaded source-verify-record.json) to the CANONICAL path `source-verify-check` and the
 *  publish gate read by default (`.chapterflow/source-verify-<book>.md`), after validating it
 *  parses. Closes the two-path footgun: the workbench writes to its own dir, but the publish
 *  preflight (`evaluateSourceRealityPolicy`) only reads the canonical path. */
async function runSourceVerifyImport(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const recordFlag = flags["record"];
  if (!bookId || typeof recordFlag !== "string") {
    console.error("Usage: source-verify-import <bookId> --record <path-to-filled-record.json>");
    return 2;
  }
  const src = resolve(process.cwd(), recordFlag);
  if (!existsSyncFs(src)) {
    console.error(`No record file at ${src}.`);
    return 2;
  }
  const { parseSourceVerifyRecord, sourceVerifyRecordPath } = await import("./critics/sourceVerify.js");
  const text = readFileSync(src, "utf8");
  const { record, error } = parseSourceVerifyRecord(text);
  if (error || !record) {
    console.error(`Not a valid source-verify record: ${error ?? "unparseable"}. Fill it in the workbench and re-download.`);
    return 2;
  }
  const dest = sourceVerifyRecordPath(bookId);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text, "utf8");
  console.log(`source-verify-import — ${bookId}: imported to the canonical path ${dest}`);
  console.log(`Now verify it (this is the exact record the publish gate reads):`);
  console.log(`  npx tsx src/cli.ts source-verify-check ${bookId}`);
  return 0;
}

/** `source-verify-check <bookId> [--record <path>]` — WS-4 consumer. Reads the FILLED
 *  verification record back and refuses a rubber-stamp (uniform notes/sources, missing
 *  coverage, non-VERIFIED items). This is what makes the source-reality gate real
 *  rather than decorative; it also runs inside the publish preflight. */
async function runSourceVerifyCheck(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: source-verify-check <bookId> [--record <path>]");
    return 2;
  }
  const { expectedSourceChapters, loadSourceV2Sidecar } = await import("./qc/sourceV2Gate.js");
  const { verifiableItems, parseSourceVerifyRecord, checkSourceVerifyRecord, sourceVerifyRecordPath } = await import("./critics/sourceVerify.js");
  const items = expectedSourceChapters(bookId).flatMap((n) => {
    const sc = loadSourceV2Sidecar(bookId, n);
    return sc ? verifiableItems(sc) : [];
  });
  if (items.length === 0) {
    console.error(`No verifiable source items for "${bookId}" — run research (phase 1) and check-source first.`);
    return 2;
  }
  const recordPath = typeof flags["record"] === "string" ? resolve(process.cwd(), flags["record"] as string) : sourceVerifyRecordPath(bookId);
  if (!existsSyncFs(recordPath)) {
    console.error(`No source-verify record at ${recordPath}.`);
    console.error(`Emit one: npx tsx src/cli.ts source-verify ${bookId} --write — then verify every item against a real source.`);
    return 2;
  }
  const { record, error } = parseSourceVerifyRecord(readFileSync(recordPath, "utf8"));
  if (error || !record) {
    console.error(`source-verify-check — ${bookId}: ${error ?? "unparseable record"}`);
    return 2;
  }
  const findings = checkSourceVerifyRecord(items, record);
  if (findings.length === 0) {
    console.log(`source-verify-check — ${bookId}: PASS — ${items.length} item(s) VERIFIED with distinct, cited sources.`);
    return 0;
  }
  const blockers = findings.filter((f) => f.severity === "blocker");
  console.log(`source-verify-check — ${bookId}: ${blockers.length} blocker(s) of ${findings.length} finding(s)`);
  for (const f of findings) console.log(`  [${f.checkId}${f.chapterNumber ? ` ch${f.chapterNumber}` : ""}] ${f.severity}: ${f.message}`);
  return blockers.length > 0 ? 1 : 0;
}

/** `runbook <bookId> [--json]` — deterministic, READ-ONLY operator control panel: the book's
 *  phase (from book-status), the strict env with live OK/MISSING status, the source-v2 gate +
 *  source-verify record state, the latest QC round, the exact next command, the prompt to open,
 *  and any blockers. Re-derives nothing — phase comes from computeBookStatus, gate/record state
 *  from the existing checks; the phase→prompt map + formatting live in src/runbook.ts. */
async function runRunbook(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const input = args.join(" ").trim();
  if (!input) {
    console.error("Usage: runbook <bookId|title> [--json]");
    return 2;
  }
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  const { computeBookStatus } = await import("./lifecycle/bookStatus.js");
  const { runbookPlan, formatRunbook, runbookJson, strictEnvStatus } = await import("./runbook.js");
  const bookStatus = computeBookStatus(bookId);
  const plan = runbookPlan(bookStatus.phase, bookId);

  const { sourceVerifyRecordPath, parseSourceVerifyRecord, checkSourceVerifyRecord, verifiableItems } = await import("./critics/sourceVerify.js");
  const { expectedSourceChapters, loadSourceV2Sidecar, checkSourceV2Gate } = await import("./qc/sourceV2Gate.js");
  const { latestRoundId } = await import("./qc/orchestrator/artifacts.js");

  const blockers: { kind: string; message: string }[] = [];

  // source-v2 STRUCTURE gate (cheap; "N/A" when there are no source chapters yet).
  let sourceV2: RunbookStatus["sourceV2"] = "N/A";
  try {
    const v2 = checkSourceV2Gate(bookId);
    if (v2.chaptersChecked > 0) {
      sourceV2 = v2.passed ? "PASS" : "BLOCK";
      if (!v2.passed) for (const f of v2.findings) blockers.push({ kind: "sourceV2", message: f.message });
    }
  } catch {
    sourceV2 = "N/A";
  }

  // source-verify REALITY record state.
  const items = expectedSourceChapters(bookId).flatMap((n) => {
    const sc = loadSourceV2Sidecar(bookId, n);
    return sc ? verifiableItems(sc) : [];
  });
  let sourceVerify: RunbookStatus["sourceVerify"] = "N/A";
  if (items.length > 0) {
    const svPath = sourceVerifyRecordPath(bookId);
    if (!existsSyncFs(svPath)) {
      sourceVerify = "ABSENT";
    } else {
      const { record, error } = parseSourceVerifyRecord(readFileSync(svPath, "utf8"));
      if (error || !record) {
        sourceVerify = "UNPARSEABLE";
        blockers.push({ kind: "sourceVerify", message: `record present but unparseable (${error ?? "?"}) — re-emit and re-fill` });
      } else {
        const svBlockers = checkSourceVerifyRecord(items, record).filter((f) => f.severity === "blocker");
        sourceVerify = svBlockers.length === 0 ? "PRESENT_PASS" : "PRESENT_BAD";
        for (const f of svBlockers) blockers.push({ kind: "sourceVerify", message: f.message });
      }
    }
  }

  const notes: string[] = [];
  if (plan.label === "QC" || plan.label === "Publish") {
    notes.push("REVIEW-PACKET.md (if present) carries live role tokens — publish cleanup removes it");
  }

  const status: RunbookStatus = {
    phase: bookStatus.phase,
    env: strictEnvStatus(process.env),
    sourceV2,
    sourceVerify,
    qcRound: latestRoundId(bookId),
    blockers,
    notes,
  };

  if (flags["json"] === true) console.log(JSON.stringify(runbookJson(bookId, plan, status), null, 2));
  else console.log(formatRunbook(bookId, plan, status));
  return 0;
}

/** `diagnose <bookId|title>` — one triage entry point for "why didn't this book pass?".
 *  Composes the existing book-level diagnostics in order (book-status → major-status →
 *  source-verify-check → qc-diagnose on the latest round) behind one command, so the operator
 *  stops debugging by vibes. It RUNS the existing renderers (no re-implemented logic — they stay
 *  the single source of truth); the only new logic is the ordering + latest-round resolution,
 *  which lives pure + tested in src/diagnose.ts. Always exits 0 — it is informational; the
 *  individual commands remain the gates. */
async function runDiagnose(args: string[], _flags: Record<string, string | boolean>): Promise<number> {
  const input = args.join(" ").trim();
  if (!input) {
    console.error("Usage: diagnose <bookId|title>");
    return 2;
  }
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  if (resolved.ok === false) console.log(`note: could not resolve "${input}" to a known book — using raw id "${bookId}".`);

  const { latestRoundId } = await import("./qc/orchestrator/artifacts.js");
  const { diagnosePlan, formatDiagnoseHeader, formatDiagnoseStep, formatDiagnoseNotes } = await import("./diagnose.js");
  const roundId = latestRoundId(bookId);
  const { steps, notes } = diagnosePlan(bookId, roundId);

  console.log(formatDiagnoseHeader(bookId, roundId));
  for (const step of steps) {
    console.log(formatDiagnoseStep(step));
    switch (step.kind) {
      case "book-status":
        await runBookStatus([bookId], {});
        break;
      case "major-status":
        await runMajorStatus([bookId]);
        break;
      case "source-verify-check":
        await runSourceVerifyCheck([bookId], {});
        break;
      case "qc-diagnose":
        await runQcDiagnose([bookId], { round: roundId as string });
        break;
    }
  }
  if (notes.length > 0) {
    console.log("");
    console.log(formatDiagnoseNotes(notes));
  }
  return 0;
}

/** `next-task <bookId>` — operator helper for inline-session generation.
 *  Scans on-disk state and prints the next artifact the operator (Claude
 *  in this session) should produce, with the path and playbook reference. */
async function runNextTask(args: string[]): Promise<number> {
  const input = args.join(" ").trim();
  if (!input) {
    console.error("Usage: next-task <bookId|title>");
    return 2;
  }
  // Resolve a title to its bookId (else a pasted title silently re-researches an
  // existing book under the raw title as a new id). A brand-new book won't resolve
  // yet — fall back to the raw input (the slug the operator will author under).
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  if (resolved.ok === false) console.log(`note: could not resolve "${input}" to a known book — using raw id "${bookId}".`);
  const { computeNextTask, formatNextTask } = await import("./next-task.js");
  try {
    const task = computeNextTask(bookId);
    console.log(formatNextTask(task));
    return task.kind === "all-done" ? 0 : 0; // 0 either way — exit code reflects whether the helper itself succeeded
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
}

/** `research "<title>" "<author>" [--book-id <slug>] [--concurrency N] [--force-refresh]`
 *
 *  Runs the researcher orchestrator. Produces the source-freeze bundle and
 *  chapter index that the existing generation pipeline reads. Does NOT call
 *  the writer agents — use `generate` to run the full pipeline end-to-end. */
async function runResearch(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const title = args[0];
  const author = args[1];
  if (!title || !author) {
    console.error('Usage: research "<title>" "<author>" [--book-id <slug>] [--concurrency N] [--force-refresh]');
    return 2;
  }
  const { researchBook } = await import("./researcher.js");
  const bookIdFlag = typeof flags["book-id"] === "string" ? (flags["book-id"] as string) : undefined;
  const concurrency = typeof flags["concurrency"] === "string" ? parseInt(flags["concurrency"] as string, 10) : 3;
  const forceRefresh = flags["force-refresh"] === true;

  const result = await researchBook(title, author, {
    bookId: bookIdFlag,
    chapterConcurrency: concurrency,
    forceRefresh,
    failOnCoherenceBlockers: true,
  });
  console.log(`\nResearch complete:`);
  console.log(`  bookId:   ${result.bookId}`);
  console.log(`  runId:    ${result.runId}`);
  console.log(`  bundle:   ${result.bundlePath}`);
  console.log(`  index:    ${result.chapterIndexPath}`);
  console.log(`\nNext step: npx tsx src/cli.ts generate "${title}" "${author}" --book-id ${result.bookId}`);
  return result.coherence.passed ? 0 : 1;
}

/** `generate "<title>" "<author>" [--book-id <slug>] [--from N] [--to N] [--skip-research]`
 *
 *  End-to-end fresh generation. If no source bundle exists for the bookId,
 *  runs the researcher first; otherwise resumes from the existing bundle.
 *  --skip-research forces use of an existing bundle and errors if missing. */
async function runGenerate(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const title = args[0];
  const author = args[1];
  if (!title || !author) {
    console.error('Usage: generate "<title>" "<author>" [--book-id <slug>] [--from N] [--to N] [--skip-research]');
    return 2;
  }
  const bookIdFlag = typeof flags["book-id"] === "string" ? (flags["book-id"] as string) : undefined;
  const skipResearch = flags["skip-research"] === true;
  const fromChapter = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : undefined;
  const toChapter = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : undefined;
  const force = flags["force"] === true;

  // Resolve bookId. Prefer the flag, else slugify the title for a quick
  // is-research-already-done check before the model call.
  const { hasChapterIndex, titleToSlug, researchBook } = await import("./researcher.js");
  let resolvedBookId = bookIdFlag ?? titleToSlug(title);

  let researchedResult: Awaited<ReturnType<typeof researchBook>> | null = null;
  if (!hasChapterIndex(resolvedBookId)) {
    if (skipResearch) {
      console.error(`No chapter index found for "${resolvedBookId}" and --skip-research was set. Run: research "${title}" "${author}" first.`);
      return 2;
    }
    console.log(`No chapter index for "${resolvedBookId}" — running researcher first…`);
    researchedResult = await researchBook(title, author, {
      bookId: bookIdFlag,
      chapterConcurrency: 3,
      failOnCoherenceBlockers: true,
    });
    resolvedBookId = researchedResult.bookId;
  }

  // Proceed to generation.
  const { generateBook, loadChapterIndex } = await import("./generateBook.js");
  const chapters = loadChapterIndex(resolvedBookId);
  console.log(`\nGenerating ${chapters.length} chapter(s) for "${resolvedBookId}"…`);
  const result = await generateBook(
    { bookId: resolvedBookId, title, author },
    chapters,
    { fromChapter, toChapter, continueOnError: false, force },
  );
  if (result.failed.length > 0) return 1;
  return result.bookGate.passed ? 0 : 1;
}

async function runPromoteBook(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: promote-book <bookId> --title X --author Y");
    return 2;
  }
  // H4: promoteBook runs the book-level no-API gate stack (sweep + source-verify + manual
  // key-judge) ONLY when CHAPTERFLOW_NO_API_CODEX_QC=1. The codex/no-API flow is the canonical
  // operating mode for these verbs, and a book-level SWEEP REVISE has NO other enforcer at
  // promote time — so an env-less invocation (the command book-status used to print) silently
  // skipped the sweep gate and could ship a REVISE book. Enforce the mode here. Unresolved
  // majors are also production-blocking by default unless a content-bound reviewer waiver closes
  // the exact current finding. Serious generation degradation follows the same production rule:
  // it must be resolved or closed by an exact-content waiver before promoteBook ships.
  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    console.log("promote/publish: enforcing the no-API QC gate stack (CHAPTERFLOW_NO_API_CODEX_QC=1) — sweep + source-verify + manual key-judge must pass before shipping.");
  }
  const title = typeof flags["title"] === "string" ? flags["title"] : null;
  const author = typeof flags["author"] === "string" ? flags["author"] : null;
  if (!title || !author) {
    console.error("Both --title and --author are required.");
    return 2;
  }
  const { promoteBook, formatPromotionResult } = await import("./promoteBook.js");
  const { loadChapterIndex } = await import("./generateBook.js");
  const chapters = loadChapterIndex(bookId);

  let categories = parseCsvFlag(flags["categories"]);
  let tags = parseCsvFlag(flags["tags"]);

  // Auto-fill categories/tags with the NO-API deterministic categorizer when the
  // operator doesn't pass them (the default). It reads the book's own content, so
  // it works without the model API and never ships empty (which the strict
  // package validator rejects). --categories/--tags always override.
  if (!categories || !tags) {
    const { deriveCategoriesAndTags } = await import("./agents/autoCategorize.js");
    const auto = deriveCategoriesAndTags(bookId, { title, chapterTitles: chapters.map((c) => c.chapterTitle) });
    if (!categories) categories = auto.categories;
    if (!tags) tags = auto.tags;
    console.log(`Auto-categorized (no-API, source: ${auto.source}): categories=[${categories.join(", ")}]  tags=[${tags.join(", ")}]`);
  }

  const result = promoteBook({ bookId, title, author, chapters, categories, tags });
  console.log(formatPromotionResult(result));
  return result.promoted ? 0 : 1;
}

async function runVerifyProductionPackage(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const input = args[0];
  if (!input) {
    console.error("Usage: verify-production-package <bookId|package.json> [--compare-loose-state] [--json]");
    return 2;
  }
  const { verifyProductionPackage, formatVerifyProductionPackageResult, packagePathForBook } = await import("./verifyProductionPackage.js");
  const packagePath = input.endsWith(".json") || input.includes("/")
    ? resolve(process.cwd(), input)
    : packagePathForBook(input);
  const result = verifyProductionPackage({
    packagePath,
    stateRoot: typeof flags["state-root"] === "string" ? resolve(process.cwd(), flags["state-root"] as string) : undefined,
    runsRoot: typeof flags["runs-root"] === "string" ? resolve(process.cwd(), flags["runs-root"] as string) : undefined,
    // v2: read-location overrides for the source-reality record/exemption registry
    // (keeps automated verification sandboxable without polluting the real pipeline dir).
    recordPath: typeof flags["record-path"] === "string" ? resolve(process.cwd(), flags["record-path"] as string) : undefined,
    exemptionsFile: typeof flags["exemptions-file"] === "string" ? resolve(process.cwd(), flags["exemptions-file"] as string) : undefined,
    compareLooseState: flags["compare-loose-state"] === true || flags["loose-state"] === true,
  });
  if (flags["json"] === true) console.log(JSON.stringify(result, null, 2));
  else console.log(formatVerifyProductionPackageResult(result));
  return result.ok ? 0 : 1;
}

/** `publish "<book name or id>"` — one-verb ship. Resolves the book, auto-fills
 *  title/author from its brief (flags override), then runs promote-book, whose
 *  gates already require a fresh no-API PUBLISHABLE attestation per chapter. So
 *  publish CANNOT ship a book that has not passed QC — it is a friendly wrapper,
 *  not a bypass. A fresh QC session runs `qc-auto ... --pass` then `publish`. */
async function runPublish(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const input = args.join(" ").trim();
  if (!input) {
    console.error('Usage: publish "<book name or id>" [--title X --author Y] [--categories A,B] [--tags x,y]');
    return 2;
  }
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  if (resolved.ok === false) {
    console.error(resolved.message);
    if (resolved.reason === "ambiguous" && resolved.candidates?.length) {
      console.error("Candidates:");
      for (const c of resolved.candidates) console.error(`  ${c.bookId}${c.title ? ` — ${c.title}` : ""} (${c.source})`);
    }
    return 2;
  }
  const bookId = resolved.bookId;
  const { loadBrief } = await import("./lib/voiceBible.js");
  const brief = loadBrief(bookId) as Record<string, unknown> | null;
  const briefTitle = typeof brief?.title === "string" ? brief.title : undefined;
  const briefAuthor = typeof brief?.author === "string" ? brief.author : undefined;
  const title = typeof flags["title"] === "string" ? flags["title"] : briefTitle;
  const author = typeof flags["author"] === "string" ? flags["author"] : briefAuthor;
  if (!title || !author) {
    console.error(`Could not resolve title/author for ${bookId} from its brief. Pass them explicitly:`);
    console.error(`  npx tsx src/cli.ts publish ${bookId} --title "..." --author "..."`);
    return 2;
  }
  // Cross-book variety advisory (non-blocking): surface catalog sameness BEFORE
  // shipping, so a one-voice / name-reuse book is a visible choice, not a silent
  // drift. This never blocks promote — promote's gates are unchanged.
  try {
    const { computeBookStatus } = await import("./lifecycle/bookStatus.js");
    const v = computeBookStatus(bookId).variety;
    if (v && v.notes.length > 0) {
      console.log("variety (advisory — does not block):");
      for (const n of v.notes) console.log(`  ⚠ ${n}`);
    }
  } catch { /* advisory only */ }
  console.log(`publish: ${bookId} (title="${title}", author="${author}") — running promote-book gates...`);
  // Delegate to promote-book with the resolved title/author so all gating (incl.
  // the no-API QC-attestation gate) runs exactly once, in one place.
  return runPromoteBook([bookId], { ...flags, title, author });
}

/** `publish-to-live <bookId> [--commit]` — the sandbox→live bridge (v24 A3).
 *  Verify the local sandbox package, copy it to the OUTER checkout root's
 *  git-tracked book-packages/ (what the live app bundles), byte-hash verify,
 *  probe lib/bookPackages.ts registration, and optionally commit ONLY that
 *  file in the outer repo. Fail-closed; never pushes. See src/publish/publishToLive.ts. */
async function runPublishToLive(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: publish-to-live <bookId> [--commit] [--outer-root <path>]");
    return 2;
  }
  const { publishToLive } = await import("./publish/publishToLive.js");
  const result = await publishToLive(bookId, {
    commit: flags["commit"] === true,
    outerRoot: typeof flags["outer-root"] === "string" ? resolve(process.cwd(), flags["outer-root"] as string) : undefined,
  });
  for (const step of result.steps) console.log(`  ${step}`);
  if (!result.ok) {
    console.error(`publish-to-live: BLOCK — ${result.error}`);
    return 1;
  }
  console.log(`publish-to-live: OK (${bookId})`);
  return 0;
}

/** `qc-stamp-author <bookId> [--chapters 1,2] [--session <id>]` — record the
 *  authoring session for a book's chapters (state/provenance/<chapterId>.json).
 *  An authoring session runs this after writing chapters; a later FRESH QC
 *  session (different CHAPTERFLOW_SESSION_ID) then can't grade its own work when
 *  CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1. No-op without a session id. */
async function runStampAuthor(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: qc-stamp-author <bookId> [--chapters 1,2] [--session <id>]");
    return 2;
  }
  const { recordAuthorProvenance, currentSessionId, AuthorProvenanceConflictError } = await import("./qc/sessionProvenance.js");
  const { chapterContentHash } = await import("./critics/qcAttestation.js");
  const session = typeof flags["session"] === "string" ? flags["session"] : currentSessionId();
  if (!session) {
    console.error("No author session id. Set CHAPTERFLOW_SESSION_ID or pass --session <id>.");
    return 2;
  }
  const { loadBookChapters } = await import("./qc/manualKeyJudge.js");
  const only = typeof flags["chapters"] === "string"
    ? new Set(flags["chapters"].split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n)))
    : null;
  const chapters = loadBookChapters(bookId).filter((ch) => !only || only.has(ch.number));
  let wrote = 0;
  const conflicts: string[] = [];
  for (const ch of chapters) {
    try {
      // Bind to the on-disk content so re-stamping IDENTICAL content under a
      // different session is refused (a cache accepter is not an author).
      if (recordAuthorProvenance(ch.chapterId, session, chapterContentHash(ch))) wrote++;
    } catch (err) {
      if (err instanceof AuthorProvenanceConflictError) conflicts.push(`${ch.chapterId}: ${err.message}`);
      else throw err;
    }
  }
  console.log(`qc-stamp-author: recorded ${wrote} author-provenance sidecar(s) for session "${session}".`);
  if (conflicts.length) {
    console.error(
      `qc-stamp-author: refused to re-stamp ${conflicts.length} chapter(s) whose content is already attributed ` +
        `to a different author session:\n  ${conflicts.join("\n  ")}`,
    );
    return 1;
  }
  return 0;
}

/** `book-status "<book name or id>"` — the whole lifecycle in one view (research →
 *  written → gate-clean → QC'd → publishable) plus the single exact next command.
 *  Read-only: a resolvable read never fails the command (exit 0, even on a corrupt
 *  chapter — it degrades to an error line and points at `doctor`). Exit 2 only on a
 *  missing argument. */
async function runBookStatus(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const input = args.join(" ").trim();
  if (!input) {
    console.error('Usage: book-status "<book name or id>" [--json]');
    return 2;
  }
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  if (resolved.ok === false) {
    console.log(`note: could not resolve "${input}" to a known book — showing status for the raw id "${bookId}".`);
  }
  const { computeBookStatus, formatBookStatus } = await import("./lifecycle/bookStatus.js");
  try {
    const status = computeBookStatus(bookId);
    if (flags["json"] === true) console.log(JSON.stringify(status, null, 2));
    else console.log(formatBookStatus(status));
  } catch (err) {
    // A status read must never crash with a raw stack (the documented corrupt-
    // chapter failure mode). Degrade to a one-line error and point at doctor.
    console.log(`BOOK STATUS — ${bookId}`);
    console.log(`  could not read status: ${(err as Error).message}`);
    console.log(`  run: npx tsx src/cli.ts doctor ${bookId}`);
  }
  return 0;
}

/** `doctor [<bookId>]` — preflight that catches the known workspace traps
 *  (shadow state dir, dual brief, chapter-number drift, untracked imports).
 *  Exit 0 healthy, 1 warnings, 2 a blocking trap. */
async function runDoctor(args: string[], _flags: Record<string, string | boolean>): Promise<number> {
  // doctor takes an OPTIONAL bookId (no arg = global checks). When given, resolve
  // a title to its bookId so per-book checks match the right files.
  const input = args.join(" ").trim();
  let bookId: string | undefined = input || undefined;
  if (input) {
    const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
    const resolved = resolveBookIdentifier(input);
    bookId = resolved.ok === false ? input : resolved.bookId;
    if (resolved.ok === false) console.log(`note: could not resolve "${input}" to a known book — using raw id "${bookId}".`);
  }
  const { runDoctorChecks, formatDoctor, doctorExitCode } = await import("./lifecycle/doctor.js");
  const findings = runDoctorChecks(bookId);
  const exitCode = doctorExitCode(findings);
  if (_flags.json === true) {
    const fatal = findings.filter((f) => f.level === "fatal").length;
    const warnings = findings.filter((f) => f.level === "warn").length;
    console.log(JSON.stringify({
      status: exitCode === 0 ? "ok" : exitCode === 1 ? "warn" : "fatal",
      exitCode,
      bookId,
      summary: {
        fatal,
        warnings,
        ok: findings.filter((f) => f.level === "ok").length,
        total: findings.length,
      },
      findings,
    }, null, 2));
  } else {
    console.log(formatDoctor(findings));
  }
  return exitCode;
}

/** `authoring-guardrails <bookId> [--chapters N]` — write the pre-authoring sheet
 *  (per-chapter reserved names + banned-phrase registry) that every chapter author
 *  reads before writing, so parallel authors don't collide on names/stock phrases. */
async function runAuthoringGuardrails(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const input = args.join(" ").trim();
  if (!input) {
    console.error("Usage: authoring-guardrails <bookId|title> [--chapters N]");
    return 2;
  }
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  if (resolved.ok === false) console.log(`note: could not resolve "${input}" to a known book — using raw id "${bookId}".`);
  const chapters = typeof flags["chapters"] === "string" ? parseInt(flags["chapters"], 10) : undefined;
  const { writeAuthoringGuardrails } = await import("./librarian/authoringGuardrails.js");
  try {
    const path = writeAuthoringGuardrails(bookId, { chapters: Number.isInteger(chapters) ? chapters : undefined });
    console.log(`authoring-guardrails: wrote ${path}`);
    console.log("Paste this into every chapter authoring prompt before writing.");
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
}

/** `book-gate <bookId>` — standalone book-gate runner.
 *
 *  Loads every state/chapters/<bookId>-ch*.v21-native.chapter.json file,
 *  auto-derives brief + plan artifacts (so BP7 doesn't false-fire on the
 *  manual workflow), and runs runBookGate. Exits 0 on PASS, 1 on BLOCK.
 *
 *  Added May 2026 after the SWW post-mortem to eliminate the "forgot to
 *  run derive-artifacts" failure mode. Operators and writer agents can
 *  now QC an assembled book with one command. */
/** `author-check <chapter.json>` — Phase 1. Runs the authoring-contract checks
 *  (the field-JOB layer the structural gate lacks) and prints a JOB-grouped
 *  report Codex uses to converge in-session. Exit 1 on any finding so a write
 *  loop (`author-check && gate-chapter`) iterates to clean. SHADOW: these are
 *  advisory and do NOT affect the ship gate's blocker count yet. */
async function runAuthorCheck(args: string[]): Promise<number> {
  const chapterFile = args[0];
  if (!chapterFile) {
    console.error("Usage: author-check <path/to/chapter.json>");
    return 2;
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(chapterFile), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${chapterFile}: ${(err as Error).message}`);
    return 2;
  }
  const { checkAuthoringContract, formatAuthoringReport } = await import("./critics/authoringContract.js");
  const { loadChapterSidecar } = await import("./critics/sourceGrounding.js");
  const sidecar = loadChapterSidecar(chapter.chapterId);
  const findings = checkAuthoringContract(chapter, { sidecar, filePath: resolve(chapterFile) });
  console.log(formatAuthoringReport(chapter.chapterId, findings));
  // Advisory: answer-position balance vs the dealt answer-key plan (the chapter-time
  // twin of book-gate F3). Only fires when a plan exists; never blocks here.
  const { loadAnswerKeyPlan, checkChapterAnswerBalance } = await import("./librarian/answerKeyPlan.js");
  // normSlug via parseChapterId so capital-cased chapterIds (e.g. Unreasonable-Hospitality-Ch01)
  // resolve to the canonical bookId the answer-key plan is filed under.
  const bookId = parseChapterId(chapter.chapterId)?.bookId ?? chapter.chapterId.replace(/-ch\d+$/i, "");
  const balance = checkChapterAnswerBalance(chapter, loadAnswerKeyPlan(bookId));
  for (const f of balance) console.log(`  [${f.checkId}] ${f.message}`);
  return findings.length === 0 ? 0 : 1;
}

/** `quarantine-book <bookId> [--reason "..."]` — Phase 0. Moves a shipped-but-bad
 *  package out of `book-packages/` into `book-packages/_quarantined/` (reversible)
 *  and writes a quarantine record, so a known-corrupt book (e.g. range: 108/108
 *  word-salad quizzes) stops being part of the shipped set until it's redone. */
async function runQuarantineBook(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error('Usage: quarantine-book <bookId> [--reason "..."]');
    return 2;
  }
  const reason = typeof flags["reason"] === "string" ? (flags["reason"] as string) : "quarantined: shipped corrupt / diverged from current chapters";
  const pkgDir = resolve(REPO_ROOT, "book-packages");
  const pkg = resolve(pkgDir, `${bookId}.v21.json`);
  if (!existsSyncFs(pkg)) {
    console.error(`No promoted package at ${pkg} — nothing to quarantine.`);
    return 2;
  }
  const qDir = resolve(pkgDir, "_quarantined");
  mkdirSync(qDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = resolve(qDir, `${bookId}.${ts}.v21.json`);
  renameSync(pkg, dest);
  const recDir = resolve(__dirname, "../state/books/_quarantined");
  mkdirSync(recDir, { recursive: true });
  const recPath = resolve(recDir, `${bookId}.json`);
  writeFileSync(recPath, JSON.stringify({ bookId, reason, quarantinedAt: ts, movedTo: dest }, null, 2) + "\n", "utf8");
  console.log(`Quarantined ${bookId}:`);
  console.log(`  package moved: ${pkg}\n             ->  ${dest}`);
  console.log(`  reason: ${reason}`);
  console.log(`  record: ${recPath}`);
  console.log(`  promote-book and register-web now REFUSE this book until \`unquarantine-book ${bookId}\` releases it.`);
  return 0;
}

/** `unquarantine-book <bookId>` — explicit release of a quarantine tombstone.
 *  The record is archived (not deleted) so the quarantine history survives.
 *  Releasing does NOT re-ship anything: the book still has to pass promote's
 *  full gate stack (ship + intra-book + book + QC attestations) again. */
async function runUnquarantineBook(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: unquarantine-book <bookId>");
    return 2;
  }
  const recDir = resolve(__dirname, "../state/books/_quarantined");
  const recPath = resolve(recDir, `${bookId}.json`);
  if (!existsSyncFs(recPath)) {
    console.error(`No quarantine record for "${bookId}" at ${recPath} — nothing to release.`);
    return 2;
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const archived = resolve(recDir, `${bookId}.released.${ts}.json`);
  renameSync(recPath, archived);
  console.log(`Released quarantine for ${bookId}.`);
  console.log(`  record archived: ${archived}`);
  console.log(`  Next: the book must re-pass the full gate stack — \`promote-book ${bookId} --title … --author …\`.`);
  return 0;
}

/** `state-status` — Phase 0 operator visibility. Per book: chapters on disk,
 *  how many are UNTRACKED in git (durability risk — uncommitted Step-2 work),
 *  chapterId/filename mismatches (IDN risk), and whether it's promoted. Read-only. */
async function runStateStatus(_args: string[], _flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const chaptersDir = resolve(__dirname, "../state/chapters");
  const files = readdirSync(chaptersDir).filter((f) => f.endsWith(".chapter.json"));
  const untracked = new Set<string>();
  try {
    const out = execSync(`git status --porcelain -- "${chaptersDir}"`, { cwd: REPO_ROOT, encoding: "utf8" });
    for (const line of out.split("\n")) {
      const m = line.match(/^\?\?\s+(.*)$/);
      if (m) untracked.add(basename(m[1].trim()));
    }
  } catch {
    /* git unavailable — skip the tracked column */
  }
  const byBook: Record<string, { n: number; untracked: number; idMismatch: number }> = {};
  for (const f of files) {
    const bk = f.replace(/-ch\d+.*$/, "");
    byBook[bk] ??= { n: 0, untracked: 0, idMismatch: 0 };
    byBook[bk].n++;
    if (untracked.has(f)) byBook[bk].untracked++;
    try {
      const obj = JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21;
      if (obj.chapterId !== chapterIdFromFileName(f)) byBook[bk].idMismatch++;
    } catch {
      /* ignore parse errors here */
    }
  }
  const pkgDir = resolve(REPO_ROOT, "book-packages");
  const promoted = new Set(
    existsSyncFs(pkgDir) ? readdirSync(pkgDir).filter((f) => f.endsWith(".v21.json")).map((f) => f.replace(/\.v21\.json$/, "")) : [],
  );
  console.log(`${"book".padEnd(40)}${"ch".padStart(4)}${"untracked".padStart(11)}${"idMismatch".padStart(12)}   promoted`);
  for (const bk of Object.keys(byBook).sort()) {
    const b = byBook[bk];
    console.log(
      `${bk.padEnd(40)}${String(b.n).padStart(4)}${String(b.untracked).padStart(11)}${String(b.idMismatch).padStart(12)}   ${promoted.has(bk) ? "yes" : "-"}`,
    );
  }
  const totalUntracked = Object.values(byBook).reduce((a, b) => a + b.untracked, 0);
  const totalMismatch = Object.values(byBook).reduce((a, b) => a + b.idMismatch, 0);
  console.log("");
  if (totalUntracked > 0) console.log(`⚠️  ${totalUntracked} chapter file(s) UNTRACKED in git — commit them so Step-2 work isn't lost (manual-commit mode).`);
  if (totalMismatch > 0) console.log(`⚠️  ${totalMismatch} chapter file(s) have chapterId != filename — run \`fix-chapter-ids\` before promoting IDN1 to a blocker.`);
  if (!totalUntracked && !totalMismatch) console.log("All chapters tracked and identity-clean.");
  return 0;
}

/** `toc-migrate <bookId> [--path p] [--apply]` — audit a research TOC and
 *  optionally rewrite it to the canonical v1 shape. Legacy `chapters`,
 *  `flatChapters`, and `sections[].chapters` are accepted only through the
 *  shared parser, so the migration is deterministic and preserves the flattened
 *  chapter sequence. */
async function runTocMigrate(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: toc-migrate <bookId> [--path <toc.json>] [--apply]");
    return 2;
  }
  const REPO = resolve(__dirname, "..");
  const RUNS_DIR = resolve(REPO, ".chapterflow/runs");
  const { findRunArtifact } = await import("./lib/runDirs.js");
  const tocPath = typeof flags["path"] === "string"
    ? resolve(process.cwd(), flags["path"] as string)
    : findRunArtifact(RUNS_DIR, bookId, "source-freeze/toc.json", {
        allowedStatuses: ["running", "failed", "coherence_failed", "complete"],
      });
  if (!tocPath) {
    console.error(`No TOC found for "${bookId}". Pass --path <toc.json> to audit a specific legacy file.`);
    return 2;
  }
  const { parseTocFile, formatTocIssues } = await import("./lib/tocContract.js");
  const parsed = parseTocFile(tocPath, { bookId });
  if (!parsed.ok) {
    console.log(`toc-migrate — ${bookId}`);
    console.log(`  path: ${tocPath}`);
    console.log(`  status: INVALID`);
    console.log(`  issues: ${formatTocIssues(parsed.issues)}`);
    return 2;
  }
  const canonical = `${JSON.stringify(parsed.toc, null, 2)}\n`;
  const current = readFileSync(tocPath, "utf8");
  const changed = current !== canonical;
  console.log(`toc-migrate — ${bookId}`);
  console.log(`  path: ${tocPath}`);
  console.log(`  shape: ${parsed.migration.inputShape}`);
  console.log(`  chapters: ${parsed.migration.chapterCount}`);
  console.log(`  canonical rewrite needed: ${changed ? "yes" : "no"}`);
  for (const warning of parsed.migration.warnings) console.log(`  warning: ${warning}`);
  if (flags["apply"] === true) {
    if (changed) {
      writeFileAtomic(tocPath, canonical);
      console.log("  wrote canonical chapterflow.toc.v1 TOC");
    } else {
      console.log("  already canonical; no file written");
    }
  } else {
    console.log("  dry-run: no file written (use --apply to rewrite)");
  }
  return 0;
}

/** `migrate-state [--apply] [--prefer-canonical|--prefer-shadow]` — Phase 0.
 *  Reconciles the accidental repo-root `state/chapters` SHADOW dir (whose files
 *  are invisible to gates/promote) against the canonical pipeline dir. Default is
 *  a dry-run. Identical shadow files are redundant (deleted on --apply); files
 *  missing from canonical are moved in; DIVERGENT files are refused unless an
 *  explicit --prefer-canonical (drop shadow) / --prefer-shadow (overwrite
 *  canonical) is given. Never silently overwrites — divergence is the hazard. */
async function runMigrateState(_args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const apply = !!flags["apply"];
  const preferCanonical = !!flags["prefer-canonical"];
  const preferShadow = !!flags["prefer-shadow"];
  const canonDir = resolve(__dirname, "../state/chapters");
  const shadowDir = resolve(REPO_ROOT, "state/chapters");
  if (!existsSyncFs(shadowDir)) {
    console.log(`No shadow dir at ${shadowDir} — nothing to migrate. State is canonical.`);
    return 0;
  }
  const shadowFiles = readdirSync(shadowDir).filter((f) => f.endsWith(".chapter.json")).sort();
  if (shadowFiles.length === 0) {
    console.log(`Shadow dir ${shadowDir} has no chapter files.`);
    return 0;
  }
  const identical: string[] = [];
  const moveIn: string[] = [];
  const divergent: string[] = [];
  for (const f of shadowFiles) {
    const s = resolve(shadowDir, f);
    const c = resolve(canonDir, f);
    if (!existsSyncFs(c)) moveIn.push(f);
    else if (readFileSync(s, "utf8") === readFileSync(c, "utf8")) identical.push(f);
    else divergent.push(f);
  }
  console.log(`Shadow: ${shadowDir}`);
  console.log(`Canonical: ${canonDir}`);
  console.log(
    `  ${identical.length} identical (redundant) · ${moveIn.length} missing-in-canonical (move in) · ${divergent.length} DIVERGENT`,
  );
  for (const f of divergent) {
    const sm = statSync(resolve(shadowDir, f)).mtimeMs;
    const cm = statSync(resolve(canonDir, f)).mtimeMs;
    console.log(`    DIVERGENT ${f} — shadow ${sm > cm ? "NEWER" : "older"}, canonical ${cm > sm ? "NEWER" : "older"}`);
  }
  if (!apply) {
    console.log(`\n[dry-run] no files changed. Re-run with --apply` + (divergent.length ? ` --prefer-canonical|--prefer-shadow (for the ${divergent.length} divergent)` : ``) + `.`);
    return 0;
  }
  if (divergent.length && !preferCanonical && !preferShadow) {
    console.error(`\nREFUSING: ${divergent.length} divergent file(s). Re-run with --prefer-canonical (drop shadow copies) or --prefer-shadow (overwrite canonical). Nothing changed.`);
    return 2;
  }
  let removed = 0, moved = 0, resolved = 0;
  for (const f of identical) { rmSync(resolve(shadowDir, f)); removed++; }
  for (const f of moveIn) { renameSync(resolve(shadowDir, f), resolve(canonDir, f)); moved++; }
  for (const f of divergent) {
    if (preferShadow) { renameSync(resolve(shadowDir, f), resolve(canonDir, f)); }
    else { rmSync(resolve(shadowDir, f)); }
    resolved++;
  }
  // Remove the shadow dir if it's now empty of chapter files.
  const leftover = readdirSync(shadowDir).filter((f) => f.endsWith(".chapter.json"));
  if (leftover.length === 0) { try { rmSync(shadowDir, { recursive: true }); } catch { /* non-empty of other files */ } }
  console.log(`\nmigrate-state: removed ${removed} redundant, moved ${moved} in, resolved ${resolved} divergent (--prefer-${preferShadow ? "shadow" : "canonical"}). Canonical is now the single source of truth.`);
  return 0;
}

/** `fix-chapter-ids [<bookId>] [--dry-run]` — Phase 0 migration. Normalizes each
 *  chapter's in-JSON `chapterId` to equal its filename stem, so the IDN1 guard
 *  can be promoted to a blocker without hard-blocking already-mismatched files
 *  (e.g. the capital-U "Unreasonable-hospitality-chNN" the slot-fill scripts
 *  wrote). With no bookId, scans every chapter. Only touches the `chapterId`
 *  field; all other content is left byte-for-byte unchanged. */
async function runFixChapterIds(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const dryRun = !!flags["dry-run"];
  const chaptersDir = resolve(__dirname, "../state/chapters");
  if (!existsSyncFs(chaptersDir)) {
    console.error(`Chapters directory not found: ${chaptersDir}`);
    return 2;
  }
  const files = readdirSync(chaptersDir)
    .filter((f) => f.endsWith(".v21-native.chapter.json") && (!bookId || isSiblingFile(f, bookId)))
    .sort();
  if (files.length === 0) {
    console.error(`No chapter files found${bookId ? ` for "${bookId}"` : ""} under ${chaptersDir}`);
    return 2;
  }
  let changed = 0;
  for (const f of files) {
    const full = resolve(chaptersDir, f);
    let raw: string;
    let obj: ChapterV21;
    try {
      raw = readFileSync(full, "utf8");
      obj = JSON.parse(raw) as ChapterV21;
    } catch (err) {
      console.error(`  skip ${f}: ${(err as Error).message}`);
      continue;
    }
    const stem = chapterIdFromFileName(f);
    if (obj.chapterId === stem) continue;
    console.log(`  ${dryRun ? "[dry-run] would fix" : "fixed"} ${f}: chapterId "${obj.chapterId}" -> "${stem}"`);
    changed++;
    if (!dryRun) {
      obj.chapterId = stem;
      // Preserve the file's exact formatting style (2-space indent, trailing NL if present).
      const out = JSON.stringify(obj, null, 2) + (raw.endsWith("\n") ? "\n" : "");
      // Atomic: this rewrites a chapter JSON in place — a crash mid-write would leave a torn file
      // that wedges loadBookChapters/the conductor (the H6 vector), so use tmp+rename here too.
      writeFileAtomic(full, out);
    }
  }
  console.log(
    `fix-chapter-ids: ${changed} chapter(s) ${dryRun ? "would be" : ""} normalized across ${files.length} file(s)${dryRun ? " (dry-run — no files written)" : ""}.`,
  );
  return 0;
}

/** `batch <manifest.json> [--run]` — multi-book driver. The manifest is a JSON
 *  array of { bookId, title, author }. For each book it computes the pipeline
 *  stage (RESEARCH / AUTHOR / GATE_FIX / QC / SHIP / DONE), and with --run it
 *  auto-runs the terminal steps (promote-book + register-web) for every book whose
 *  QC is complete. The AI steps (research, authoring, QC) are surfaced as a work
 *  queue with the exact command to run. Re-run it as books progress. */
async function runBatch(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const guard = shadowGuard();
  if (guard) return guard;
  const manifestPath = args[0];
  if (!manifestPath) {
    console.error('Usage: batch <manifest.json> [--run]\n  manifest = [{ "bookId": "...", "title": "...", "author": "..." }, ...]');
    return 2;
  }
  let books: Array<{ bookId: string; title: string; author: string }>;
  try {
    books = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
    if (!Array.isArray(books)) throw new Error("manifest must be a JSON array");
  } catch (err) {
    console.error(`Could not read manifest ${manifestPath}: ${(err as Error).message}`);
    return 2;
  }
  const doRun = flags["run"] === true;
  const { computeNextTask } = await import("./next-task.js");
  const { runShipGate } = await import("./critics/finalGate.js");
  const { runBookGate } = await import("./critics/bookGate.js");
  const { loadAttestation, isAttestationFresh } = await import("./critics/qcAttestation.js");
  const STATE = resolve(__dirname, "../state");
  const REPO = resolve(__dirname, "..");
  const chaptersDir = resolve(STATE, "chapters");

  type Row = { bookId: string; title: string; stage: string; detail: string; action: string | null };
  const rows: Row[] = [];
  for (const b of books) {
    const bookId = parseChapterId(`${b.bookId}-ch01`)?.bookId ?? b.bookId; // normSlug
    let stage = "RESEARCH";
    let detail = "needs Step-1 research";
    let action: string | null = "research";
    let task: any;
    try { task = computeNextTask(bookId); } catch { task = { kind: "research-bibliography" }; }
    if (["research-bibliography", "research-chapter", "chapter-index"].includes(task.kind)) {
      stage = "RESEARCH"; detail = "needs Step-1 research (toc + source sidecars)"; action = "research";
    } else if (task.kind === "write-chapter") {
      stage = "AUTHOR"; detail = `chapter ${task.chapterNumber}+ still to write`; action = "author";
    } else if (existsSyncFs(resolve(REPO, "book-packages", `${bookId}.v21.json`))) {
      // Already promoted — the batch's job is to drive books TO shipped, so a
      // shipped book is DONE (re-gating it against newer/stricter gates is not the
      // batch's concern).
      stage = "DONE"; detail = "promoted"; action = null;
    } else {
      const files = existsSyncFs(chaptersDir) ? readdirSync(chaptersDir).filter((f) => isSiblingFile(f, bookId)).sort() : [];
      const chapters = files.map((f) => JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21);
      let blockers = 0;
      for (const ch of chapters) blockers += runShipGate(ch).blockers.length;
      blockers += runBookGate(bookId, chapters).findings.filter((f) => f.severity === "blocker").length;
      // Intra-book AS5-AS12, same priors-only pass promote enforces — without
      // it batch staged books as QC/SHIP that promote would then block.
      const { runIntraBookChecks } = await import("./critics/intraBook.js");
      for (const ch of chapters) {
        blockers += runIntraBookChecks(ch, chapters.filter((o) => o.number < ch.number)).filter((f) => f.severity === "blocker").length;
      }
      if (blockers > 0) {
        stage = "GATE_FIX"; detail = `${blockers} gate blocker(s)`; action = "gatefix";
      } else {
        const qcPassed = chapters.filter((ch) => {
          const a = loadAttestation(bookId, ch.number);
          // isAttestationFresh, NOT a raw hash compare — attestations carry a
          // hashVersion and a raw compare goes wrong the moment the hash evolves.
          return a && a.verdict === "PUBLISHABLE" && isAttestationFresh(a, ch);
        }).length;
        if (chapters.length === 0 || qcPassed < chapters.length) {
          stage = "QC"; detail = `${qcPassed}/${chapters.length} chapters QC-passed`; action = "qc";
        } else {
          stage = "SHIP"; detail = "QC complete — ready to promote + register"; action = "ship";
        }
      }
    }
    rows.push({ bookId, title: b.title, stage, detail, action });
  }

  // --run: auto-advance the terminal steps (promote + register) for SHIP books.
  // Exit contract: status mode (no --run) is a WORK-QUEUE REPORT and exits 0
  // unless the manifest itself is unusable; --run mode exits 1 if ANY attempted
  // promote/register failed (it previously always exited 0 and printed
  // "DONE — promoted + registered" even when register-web had failed).
  let runFailures = 0;
  if (doRun) {
    // H4 (missed-call-site): force the no-API gate stack for EVERY shipped book, same as
    // runPromoteBook. A `batch --run` invoked env-less would otherwise skip the book-level
    // sweep/source-verify gate and could ship a SWEEP-REVISE book on per-chapter attestations alone.
    if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    for (const r of rows.filter((x) => x.action === "ship")) {
      const b = books.find((x) => (parseChapterId(`${x.bookId}-ch01`)?.bookId ?? x.bookId) === r.bookId)!;
      try {
        const { promoteBook } = await import("./promoteBook.js");
        const { loadChapterIndex } = await import("./generateBook.js");
        const { deriveCategoriesAndTags } = await import("./agents/autoCategorize.js");
        const chapters = loadChapterIndex(r.bookId);
        const auto = deriveCategoriesAndTags(r.bookId, { title: b.title, chapterTitles: chapters.map((c) => c.chapterTitle) });
        const res = promoteBook({ bookId: r.bookId, title: b.title, author: b.author, chapters, categories: auto.categories, tags: auto.tags });
        if (!res.promoted) { r.stage = "SHIP_BLOCKED"; r.detail = (res.reason ?? "promote blocked").slice(0, 90); runFailures++; continue; }
        const regCode = await runRegisterWeb([r.bookId], {});
        if (regCode !== 0) {
          r.stage = "REGISTER_FAILED";
          r.detail = `promoted, but register-web exited ${regCode} — run \`register-web ${r.bookId}\` manually`;
          runFailures++;
          continue;
        }
        r.stage = "DONE"; r.detail = "promoted + registered";
      } catch (err) {
        r.stage = "SHIP_BLOCKED"; r.detail = (err as Error).message.slice(0, 90); runFailures++;
      }
    }
  }

  // Dashboard
  console.log(`\nBatch: ${manifestPath}  (${rows.length} book(s))${doRun ? "  [--run: promoted/registered ready books]" : ""}\n`);
  const w = Math.max(...rows.map((r) => r.bookId.length), 8);
  for (const r of rows) console.log(`  ${r.bookId.padEnd(w)}  ${r.stage.padEnd(11)}  ${r.detail}`);

  // Work queue (the human/AI steps)
  const group = (a: string) => rows.filter((r) => r.action === a).map((r) => r.bookId);
  const research = group("research"), author = group("author"), gatefix = group("gatefix"), qc = group("qc"), ship = group("ship");
  console.log(`\nWork queue:`);
  if (research.length) console.log(`  RESEARCH (${research.length}): ${research.join(", ")}\n     → one Codex agent per book, per agent-prompts/STEP-1-RESEARCH.md (give it the title+author)`);
  if (author.length) console.log(`  AUTHOR (${author.length}): ${author.join(", ")}\n     → per book: npx tsx src/cli.ts fanout <bookId>  (paste each block into a Codex agent)`);
  if (gatefix.length) console.log(`  GATE_FIX (${gatefix.length}): ${gatefix.join(", ")}\n     → per book: npx tsx src/cli.ts book-gate <bookId>  (fix the blockers it names)`);
  if (qc.length) console.log(`  QC (${qc.length}): ${qc.join(", ")}\n     → per book: a Claude QC session (agent-prompts/QC-SESSION-PROMPT.md), qc-attest each chapter`);
  if (!doRun && ship.length) console.log(`  SHIP (${ship.length}): ${ship.join(", ")}\n     → re-run with --run to auto promote + register these`);
  if (![research, author, gatefix, qc, ship].some((g) => g.length)) console.log(`  (nothing pending — all books DONE)`);
  if (runFailures > 0) {
    console.log(`\n${runFailures} --run action(s) FAILED (see SHIP_BLOCKED / REGISTER_FAILED rows above). (exit 1)`);
    return 1;
  }
  return 0;
}

/** `register-web <bookId>` — make a promoted book show up in the reader (local/dev).
 *  Append-only registration into app/book/data/bookPackages.ts (one import + a
 *  self-contained block that pushes the package and registers its tone getter —
 *  no existing line is touched; presentation auto-infers), then regenerates the
 *  catalog metadata (which imports BOOK_PACKAGES, so it also verifies the edit
 *  compiles). Idempotent. Production publish (DynamoDB/S3) is a separate step that
 *  needs AWS env — printed at the end. */
async function runRegisterWeb(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: register-web <bookId> [--created-by <name>] [--skip-ingest]");
    return 2;
  }
  const REPO = resolve(__dirname, "..");
  const tombstone = resolve(__dirname, "../state/books/_quarantined", `${bookId}.json`);
  if (existsSyncFs(tombstone)) {
    console.error(
      `QUARANTINED: ${bookId} was explicitly quarantined — refusing to register it for the web. ` +
        `Run \`unquarantine-book ${bookId}\` first (after the defect is fixed and re-QC'd).`,
    );
    return 2;
  }
  const pkgPath = resolve(REPO, "book-packages", `${bookId}.v21.json`);
  if (!existsSyncFs(pkgPath)) {
    console.error(`No package at ${pkgPath}. Run \`promote-book ${bookId} ...\` first.`);
    return 2;
  }
  const { verifyProductionPackage } = await import("./verifyProductionPackage.js");
  const verification = verifyProductionPackage({ packagePath: pkgPath, compareLooseState: true });
  if (!verification.ok) {
    console.error(
      `Package at ${pkgPath} is not verified; refusing to update web registries: ` +
        verification.findings.slice(0, 5).map((f) => f.message).join("; "),
    );
    return 1;
  }
  const bpPath = resolve(REPO, "app/book/data/bookPackages.ts");
  if (!existsSyncFs(bpPath)) {
    console.error(`Web registry not found at ${bpPath}. (Are you on the web-app branch / is app/ present?)`);
    return 2;
  }
  let src = readFileSync(bpPath, "utf8");
  if (src.includes(`from "@/book-packages/${bookId}.v21.json"`)) {
    console.log(`${bookId} is already registered in bookPackages.ts — leaving it; just refreshing the catalog.`);
  } else {
    const ident = `auto_${bookId.replace(/[^a-zA-Z0-9]/g, "_")}_Json`;
    const lines = src.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('from "@/book-packages/') && lines[i].includes(".v21.json")) lastImport = i;
    }
    if (lastImport === -1) {
      console.error("Could not find the book-packages import block in bookPackages.ts to anchor the new import.");
      return 2;
    }
    lines.splice(lastImport + 1, 0, `import ${ident} from "@/book-packages/${bookId}.v21.json";`);
    src = lines.join("\n");
    const block =
      `\n// --- auto-registered by \`register-web\` for "${bookId}" (do not edit by hand) ---\n` +
      `{\n` +
      `  const __autoPkg = normalizeAnyPackage(${ident}, "direct");\n` +
      `  BOOK_PACKAGES.push(__autoPkg);\n` +
      `  BOOK_PACKAGE_TONE_GETTERS["${bookId}"] = (tone) => normalizeAnyPackage(${ident}, tone);\n` +
      `}\n`;
    src = src.replace(/\s*$/, "\n") + block;
    writeFileAtomic(bpPath, src);
    console.log(`Registered "${bookId}" in app/book/data/bookPackages.ts (import + BOOK_PACKAGES + tone getter; presentation auto-infers).`);
  }
  // Regenerate the catalog metadata — this imports BOOK_PACKAGES, so success also
  // confirms the registration compiles and the book is picked up.
  const genScript = resolve(REPO, "scripts/book/generate-catalog-metadata.ts");
  if (existsSyncFs(genScript)) {
    try {
      execSync(`npx tsx ${JSON.stringify(genScript)}`, { cwd: REPO, stdio: "inherit" });
      console.log(`✓ Catalog regenerated — "${bookId}" will appear in the library when you run the app locally.`);
    } catch (err) {
      console.error(
        `Catalog regeneration FAILED (${(err as Error).message}). The registration may be malformed — ` +
          `review the auto-registered block at the bottom of app/book/data/bookPackages.ts, or revert it with git.`,
      );
      return 1;
    }
  } else {
    console.warn(`Catalog generator not found at ${genScript}; run it yourself to refresh the library list.`);
  }
  // Reader ingest (DynamoDB/S3) — the in-app library + reader read from the
  // published catalog, NOT the static one above. Auto-run the ingest when the
  // AWS env is present; otherwise print the command to run later.
  const publishCmd = `npx tsx scripts/book/publish-single-package.ts --file book-packages/${bookId}.v21.json --created-by you`;
  const hasAwsEnv = !!(process.env.BOOK_TABLE_NAME && process.env.BOOK_INGEST_BUCKET && process.env.BOOK_CONTENT_BUCKET);
  const publishScript = resolve(REPO, "scripts/book/publish-single-package.ts");
  if (flags["skip-ingest"] === true) {
    console.log(`\nReader ingest skipped (--skip-ingest). To do it later:\n  ${publishCmd}`);
  } else if (hasAwsEnv && existsSyncFs(publishScript)) {
    const createdBy = typeof flags["created-by"] === "string" ? (flags["created-by"] as string) : "register-web";
    console.log(`\nAWS env detected — ingesting "${bookId}" into the reader catalog (DynamoDB/S3)…`);
    try {
      // #17: pass args as an ARGV array via execFileSync — NOT a shell string. JSON.stringify is
      // not shell-safe (a crafted bookId could break out of the quotes), and bookId/createdBy are
      // operator-supplied. argv has no shell to inject into.
      execFileSync(
        "npx",
        ["tsx", publishScript, "--file", `book-packages/${bookId}.v21.json`, "--created-by", createdBy],
        { cwd: REPO, stdio: "inherit" },
      );
      console.log(`✓ Ingested — "${bookId}" is now in the in-app library + reader (just refresh the page).`);
    } catch (err) {
      console.error(`Reader ingest FAILED (${(err as Error).message}). Run it manually:\n  ${publishCmd}`);
      return 1;
    }
  } else {
    console.log(`\nReader ingest skipped — AWS env not set (need BOOK_TABLE_NAME / BOOK_INGEST_BUCKET / BOOK_CONTENT_BUCKET${process.env.AWS_REGION ? "" : " / AWS_REGION"}).`);
    console.log(`This step puts the book in the actual in-app reader. When your AWS env is set, run:\n  ${publishCmd}`);
  }
  return 0;
}

/** `categorize <bookId> [--title "..."]` — preview the no-API auto-categorizer's
 *  pick (categories + tags derived from the book's own content). promote-book runs
 *  this automatically when --categories/--tags aren't passed. */
async function runCategorize(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: categorize <bookId>");
    return 2;
  }
  const { deriveCategoriesAndTags } = await import("./agents/autoCategorize.js");
  let chapterTitles: string[] = [];
  try {
    const { loadChapterIndex } = await import("./generateBook.js");
    chapterTitles = loadChapterIndex(bookId).map((c) => c.chapterTitle);
  } catch {/* index may not exist yet */}
  const auto = deriveCategoriesAndTags(bookId, { chapterTitles });
  console.log(`Auto-categorize — ${bookId}  (no-API, source: ${auto.source})`);
  console.log(`  categories: ${auto.categories.join(", ") || "(none)"}`);
  console.log(`  tags:       ${auto.tags.join(", ") || "(none)"}`);
  console.log(`\npromote-book uses these automatically. Override with --categories "A,B" --tags "x,y".`);
  return 0;
}

/** `fanout <bookId> [--from N --to M] [--all]` — print a ready-to-paste authoring
 *  prompt for each chapter still to write: title, real source-notes path (with the
 *  run timestamp resolved), the chapter's allocated names, the save path, and the
 *  self-gate command — all filled in. Paste each block into its own Codex agent to
 *  write the whole book in parallel. Skips already-written chapters unless --all. */
async function runFanout(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  // fanout WRITES plan artifacts to state/ (name/shape/pedagogy/exemplar/venue/
  // rhetoric/answerKey/callback/sceneMode/timing/actionMechanism/weeklyPractice/
  // fullReadSkeleton). Like every other state-writing gate command, refuse to run
  // when the forbidden repo-root /state shadow exists, so plan output can't land
  // in the wrong copy the gates don't read.
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: fanout <bookId> [--from N --to M] [--all] [--write-dir <path>]");
    return 2;
  }
  const { planNames, writeNamePlan } = await import("./librarian/namePlan.js");
  const { planShapes, writeShapePlan, loadSceneShapes } = await import("./librarian/shapePlan.js");
  const { planOpeners, formatOpenerPlanForChapter } = await import("./librarian/openerPlan.js");
  const { planStakes, writeStakesPlan, formatStakesForChapter } = await import("./librarian/stakesPlan.js");
  const { planPedagogy, writePedagogyPlan, loadPedagogyPalettes } = await import("./librarian/pedagogyPlan.js");
  const { planExemplars, writeExemplarPlan, formatExemplarOwned, formatExemplarForbidden } = await import("./librarian/exemplarPlan.js");
  const { planVenues, writeVenuePlan } = await import("./librarian/venuePlan.js");
  const { findRunArtifact } = await import("./lib/runDirs.js");
  const { formatVoiceBible } = await import("./lib/voiceBible.js");
  const REPO = resolve(__dirname, "..");
  const PIPE = resolve(__dirname, "..");
  const RUNS = resolve(REPO, ".chapterflow/runs");
  // Artifact-aware: the toc comes from the newest run that HAS one (a rework
  // run dir without a toc must not hide the original — the zz- burial class).
  const tocPath = findRunArtifact(RUNS, bookId, "source-freeze/toc.json");
  if (!tocPath) {
    console.error(`No research run with a toc.json for "${bookId}". Do Step 1 (research) first:  npx tsx src/cli.ts next-task ${bookId}`);
    return 2;
  }
  const toc = JSON.parse(readFileSync(tocPath, "utf8"));
  const { flattenTocChapters, formatTocIssues, parseToc } = await import("./lib/tocContract.js");
  const tocParsed = parseToc(toc, { bookId, path: tocPath });
  if (!tocParsed.ok) {
    console.error(`Chapter list at ${tocPath} is invalid: ${formatTocIssues(tocParsed.issues)}`);
    return 2;
  }
  const title = tocParsed.toc.title ?? bookId;
  const flat: Array<{ number: number; title: string }> = flattenTocChapters(toc, { bookId, path: tocPath });
  const { isNoApiCodexQcMode } = await import("./qc/noApiMode.js");
  if (isNoApiCodexQcMode()) {
    const { checkSourceV2PrewriteGate, formatSourceV2GateReport } = await import("./qc/sourceV2Gate.js");
    const sourceGate = checkSourceV2PrewriteGate(bookId);
    if (!sourceGate.passed) {
      console.error(formatSourceV2GateReport(sourceGate));
      console.error("fanout refuses to print authoring prompts in CHAPTERFLOW_NO_API_CODEX_QC=1 until source-v2-gate --prewrite passes. Repair research sidecars first; do not write chapters from thin/unsupported source notes.");
      return 1;
    }
  }
  const indexPath = resolve(PIPE, "state/indexes", `${bookId}.json`);
  const idx: Array<{ chapterId: string; chapterNumber: number }> = existsSyncFs(indexPath)
    ? JSON.parse(readFileSync(indexPath, "utf8"))
    : [];
  const idById = new Map(idx.map((c) => [c.chapterNumber, c.chapterId]));
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : flat[0].number;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : flat[flat.length - 1].number;
  const includeAll = flags["all"] === true;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    console.error(`Invalid chapter range: --from ${String(flags["from"] ?? from)} --to ${String(flags["to"] ?? to)}. Use integers with 1 <= from <= to.`);
    return 2;
  }
  // --write-dir (deal cards to files, step 1) and --barrier (post-write gate, step 3)
  // are separate workflow steps — combining them would silently drop the barrier (the
  // write-dir path returns before the barrier block runs). Fail fast, don't no-op the gate.
  if (flags["write-dir"] && flags["barrier"] === true) {
    console.error("fanout: --write-dir and --barrier are separate steps — run --write-dir to deal cards, then `fanout <bookId> --barrier` after authoring.");
    return 2;
  }
  // The WHOLE-book range — cross-chapter plans (name pools, exemplar ownership) must
  // be derived over every chapter so a partial-range deal can't persist an incomplete
  // cross-chapter view that later disagrees with the gate / a sibling's card.
  const fullFrom = flat[0].number;
  const fullTo = flat[flat.length - 1].number;
  // REDO path (--all): deal FRESH names/shapes/pedagogy — carrying a chapter's own
  // CURRENT values would re-pin the very thing the redo exists to break. For names
  // specifically, the carry-through echoes the colliding names that triggered F1
  // (and `extractNamesFromText` proper-noun pollution), so a `--all` re-dispatch must
  // deal a fresh disjoint pool — otherwise the offender card re-emits the collision.
  //
  // INITIAL deal (no --all): derive over the WHOLE book, not the requested range. A
  // per-chapter `fanout --from N --to N` (what an operator runs when the full output is
  // too large) used to start the cursor at 0 for every unauthored chapter, so ch1..ch6
  // all got available[0:7] — the F1 collision digital-minimalism ate a re-author round
  // on. Deriving whole-book gives chapter N its disjoint slice regardless of the range.
  // The `--all` redo stays range-scoped (a TARGETED refresh of the offender only).
  const plan = includeAll
    ? planNames(bookId, from, to, 7, { forceFresh: true })
    : planNames(bookId, fullFrom, fullTo, 7, { forceFresh: false });
  writeNamePlan(plan);
  const shapePlan = planShapes(bookId, from, to, 6, { forceFresh: includeAll });
  writeShapePlan(shapePlan);
  // Per-example scenario-opener archetypes (the missing twin of shapePlan/venuePlan): deals a
  // distinct opening CONSTRUCTION per slot so scenarios are born varied instead of defaulting
  // to "At the [venue], …" / "On [day], …" stamps (scene_skeleton / location_stamping).
  const openerPlan = planOpeners(bookId, from, to, 6);
  // Per-chapter modern STAKES menu: deals concrete felt-consequences so chapters land a real
  // cost the reader recognizes (reader review: "more useful than exciting"). A CONTENT cue, not
  // a scene position; the card frames it fit-or-substitute so an ill-fitting stake is never forced.
  const stakesPlan = planStakes(bookId, from, to, 3);
  writeStakesPlan(stakesPlan);
  const shapeDefs = new Map(loadSceneShapes().map((s) => [s.id, s.definition]));
  const pedagogyPlan = planPedagogy(bookId, from, to, { forceFresh: includeAll });
  writePedagogyPlan(pedagogyPlan);
  const pedagogyPalettes = loadPedagogyPalettes();
  const hookDefs = new Map(pedagogyPalettes.hookShapes.map((s) => [s.id, s.definition]));
  const tryDefs = new Map(pedagogyPalettes.tryThisNowGrammars.map((g) => [g.id, g]));
  const tacticDefs = new Map(pedagogyPalettes.tacticFamilies.map((f) => [f.id, f.definition]));
  const quizDefs = new Map(pedagogyPalettes.quizOpeners.map((q) => [q.id, q]));
  // Exemplar OWNERSHIP is cross-chapter: who owns a repeated source figure can only
  // be decided by looking at the WHOLE book. A range-scoped deal (the per-chapter
  // `fanout --from N --to N` an operator runs when the full output is too large)
  // would compute forbidden=∅ for every chapter and OVERWRITE the persisted plan with
  // that partial view — so the card says "FORBIDDEN: none" while the SP5 gate later
  // enforces the full-book owner (the digital-minimalism ch5/"Facebook Like" publish
  // block). Always derive ownership over every chapter (fullFrom..fullTo, computed
  // above) so the card a writer sees and the gate that judges it read one identical,
  // complete plan.
  const exemplarPlan = planExemplars(bookId, fullFrom, fullTo);
  writeExemplarPlan(exemplarPlan);
  const venuePlan = planVenues(bookId, fullFrom, fullTo);
  writeVenuePlan(venuePlan);
  // Rhetoric plan: per-chapter counterintuition shape + hook opener class so the
  // BOOK doesn't converge on one opener (B11 negation-shell / B13 "what" hook).
  const { planRhetoric, writeRhetoricPlan } = await import("./librarian/rhetoricPlan.js");
  const rhetoricPlan = planRhetoric(bookId, from, to);
  writeRhetoricPlan(rhetoricPlan);
  // Chapter-cadence plan: rotate the BODY ARC (which beat leads the breakdown + deepRead
  // order) so chapters don't all run the identical "named scene -> you-lesson" floor plan
  // (the cold-validation monotony finding). Does not touch the hook.
  const { planChapterArchetypes, writeCadencePlan, formatCadenceForChapter } = await import("./librarian/chapterArchetypePlan.js");
  const cadencePlan = planChapterArchetypes(bookId, from, to);
  writeCadencePlan(cadencePlan);
  // Answer-key plan: per-chapter balanced correctIndex target so the book stays
  // under the F3 ceiling by construction instead of drifting to index 0.
  const { planAnswerKeys, writeAnswerKeyPlan } = await import("./librarian/answerKeyPlan.js");
  const answerKeyPlan = planAnswerKeys(bookId, from, to);
  writeAnswerKeyPlan(answerKeyPlan);
  // Callback plan: per-chapter spaced-recall target (which prior chapter + which
  // question frame) so review-card callbacks don't collapse onto one concept+shell
  // (the repeated_unit sweep family / BP28).
  const { planCallbacks, writeCallbackPlan } = await import("./librarian/callbackPlan.js");
  const callbackPlan = planCallbacks(bookId, from, to);
  writeCallbackPlan(callbackPlan);
  // Scene-mode plan: per-chapter narrative stance, capping the retrospective-
  // evidence-review stance book-wide (the scene_skeleton sweep family). Used to
  // reconcile the shapePlan slots below.
  const { planSceneModes, writeSceneModePlan, dampenRetrospectiveShapes } = await import("./librarian/sceneModePlan.js");
  const sceneModePlan = planSceneModes(bookId, from, to);
  writeSceneModePlan(sceneModePlan);
  // Timing plan: per-chapter situational action trigger so try-this-now actions
  // don't reuse one arbitrary clock stamp (the location_stamping sweep family / BP29).
  const { planTiming, writeTimingPlan } = await import("./librarian/timingPlan.js");
  const timingPlan = planTiming(bookId, from, to);
  writeTimingPlan(timingPlan);
  // Action-mechanism plan: per-chapter ACTION CONTAINER for the try-this-now /
  // 24-hour action so the practice doesn't funnel into one timer/calendar shell
  // across chapters (the location_stamping sweep family, action-mechanism variant
  // / BP30). Reserves the timer/calendar container for the one scheduling chapter.
  const { planActionMechanisms, writeActionMechanismPlan } = await import("./librarian/actionMechanismPlan.js");
  const actionMechanismPlan = planActionMechanisms(bookId, from, to);
  writeActionMechanismPlan(actionMechanismPlan);
  // Weekly-practice plan: per-chapter practice FORM so weeklyPractice doesn't
  // collapse onto one "seven-day log" shell (the repeated_unit sweep family).
  // Prevention-only (no gate — not separable from the clean corpus).
  const { planWeeklyPractices, writeWeeklyPracticePlan } = await import("./librarian/weeklyPracticePlan.js");
  const weeklyPracticePlan = planWeeklyPractices(bookId, from, to);
  writeWeeklyPracticePlan(weeklyPracticePlan);
  // Full-read skeleton plan: per-chapter boundary BEAT so breakdown.fullRead
  // doesn't close every chapter with the same bare "limit" hinge (the
  // scene_skeleton sweep family). Prevention-only (no gate — not separable).
  const { planFullReadSkeletons, writeFullReadSkeletonPlan } = await import("./librarian/fullReadSkeletonPlan.js");
  const fullReadSkeletonPlan = planFullReadSkeletons(bookId, from, to);
  writeFullReadSkeletonPlan(fullReadSkeletonPlan);
  // Scene-mechanism plan: per-chapter FUNCTIONAL MOVE (the dramatic transaction the
  // chapter's marquee scene dramatizes) so the book can't reuse ONE scene device — e.g.
  // "a leader loses her voice → a substitute seizes the teaching prop → teaches" across
  // chapters — with only the nouns swapped (the-happiness-hypothesis scene_skeleton/
  // repeated_unit). Orthogonal to shapePlan (grammar) and sceneModePlan (stance).
  // Prevention-only: no deterministic adherence gate exists; the model QC sweep is the backstop.
  const { planSceneMechanisms, writeSceneMechanismPlan } = await import("./librarian/sceneMechanismPlan.js");
  const sceneMechanismPlan = planSceneMechanisms(bookId, from, to);
  writeSceneMechanismPlan(sceneMechanismPlan);
  // Carried name allocations for authored chapters include every capitalized
  // token the extractor saw ("University", "All", "Tonight" — junk from
  // scenario text). Pasting those as an exclusive allowlist breaks redo
  // prompts; keep only entries that are actually in the name bank.
  const { loadNameBank } = await import("./librarian/namePlan.js");
  const bankSet = new Set(loadNameBank());
  const chaptersDir = resolve(PIPE, "state/chapters");
  const blocks: string[] = [];
  const cardMeta: Array<{ number: number; chapterId: string }> = [];
  // Soft-banned tics (book-wide). The tight-budget ones recur across mutually-
  // blind chapters and blow a 0–3/book budget that NO single chapter author can
  // see (post-hoc F4 at book-gate is the only enforcement) — the-undoing-style
  // "treats it as" ×6 vs budget 2. Surface the near-forbidden ones to every
  // author here, sourced from banned-phrases.json so it can't drift.
  const { loadBannedPhrases } = await import("./critics/shared.js");
  const softBanTics = ((loadBannedPhrases().softBanned ?? []) as Array<{ phrase: string; perBookBudget: number }>)
    .filter((s) => (s.perBookBudget ?? 0) <= 3)
    .map((s) => `"${s.phrase}" (≤${s.perBookBudget}/book)`);
  const softBanLine = softBanTics.length
    ? `• SOFT-BANNED TICS (book-wide budget — treat as near-forbidden; QC's F4 REVISEs the whole book when the count is blown): avoid ${softBanTics.join(", ")}. Each reads fine once, but recurs across mutually-blind chapters and blows a tiny per-book budget; prefer a plain verb or a restructure (e.g. "treats it as" → "reads … as", "counts … as", "sees … as").\n`
    : "";
  // BOOK-WIDE VARIETY MAP. The documented root cause of the scene_skeleton / repeated_unit
  // sweep class: mutually-blind parallel writers converge on ONE scene frame because each
  // sees only its OWN dealt move/stance, never the siblings'. The deal already makes each
  // chapter's marquee MOVE (sceneMechanism) and STANCE (sceneMode) distinct — surfacing the
  // whole map to every writer turns "other chapters got other moves" from an unverifiable
  // claim into an accountable, reserved-slot constraint, so a writer can actively
  // differentiate instead of drifting onto a default device. No deterministic post-write
  // gate can catch this (it false-fires on the gold corpus — config/scene-shapes.json), so
  // the lever is write-time awareness, not a gate.
  const varietyMapRows = flat
    .filter((c) => sceneMechanismPlan.allocation[c.number] || sceneModePlan.allocation[c.number])
    .map((c) => ({
      n: c.number,
      move: sceneMechanismPlan.allocation[c.number]?.mechanismId ?? "—",
      stance: sceneModePlan.allocation[c.number]?.stance ?? "—",
    }));
  const varietyMapFor = (n: number): string => {
    if (varietyMapRows.length < 2) return ""; // a single-chapter redo has no map to show
    const rows = varietyMapRows
      .map((r) => `    ch${r.n}${r.n === n ? "  ← YOURS" : ""}: move=${r.move} · stance=${r.stance}`)
      .join("\n");
    return `• BOOK-WIDE VARIETY MAP — every chapter's marquee MOVE and narrative STANCE are dealt DISTINCT and RESERVED. Sibling chapters are authored in parallel; this is the only way you can see their dealt moves. Build YOUR marquee scene on YOUR move+stance and do NOT drift onto another row's move (mutually-blind writers collapsing onto one shared frame is the scene_skeleton defect QC REVISEs the whole book on). Before you submit, confirm your marquee scene enacts YOUR dealt move — not a generic "person faces a hard choice and decides" frame.\n${rows}\n`;
  };
  let pending = 0;
  let done = 0;
  for (const ch of flat) {
    if (ch.number < from || ch.number > to) continue;
    const numStr = String(ch.number).padStart(2, "0");
    const chapterId = idById.get(ch.number) ?? `${bookId}-ch${numStr}`;
    const written = existsSyncFs(resolve(chaptersDir, `${chapterId}.v21-native.chapter.json`));
    if (written && !includeAll) {
      done++;
      continue;
    }
    pending++;
    const allocated = plan.allocation[ch.number] ?? [];
    const bankNames = allocated.filter((n) => bankSet.has(n));
    // Prefer real bank names; an authored chapter whose carried tokens are all
    // junk falls back to the raw allocation rather than an empty list.
    const names = (bankNames.length >= 3 ? bankNames : allocated).join(", ");

    // Shape palette: slot-pinned structural variety (the anti-skeleton plan),
    // reconciled with the dealt narrative stance so chapters NOT dealt the
    // retrospective stance don't get a postmortem/audit scene — capping the
    // postmortem-evidence skeleton book-wide (scene_skeleton family).
    const dealtShapeIds = shapePlan.allocation[ch.number] ?? [];
    const stance = sceneModePlan.allocation[ch.number]?.stance ?? "live_unfolding";
    const shapeIds = dampenRetrospectiveShapes(dealtShapeIds, stance);
    const shapeLines = shapeIds
      .map((id, i) => `    ${i + 1}. ${id} — ${shapeDefs.get(id) ?? "use the format the planSpec names"}`)
      .join("\n");
    const openerLines = formatOpenerPlanForChapter(openerPlan, ch.number).map((l) => `    ${l}`).join("\n");
    const stakesLines = formatStakesForChapter(stakesPlan, ch.number).map((l) => `    ${l}`).join("\n");
    const pedagogy = pedagogyPlan.allocation[ch.number];
    const tryGrammar = pedagogy ? tryDefs.get(pedagogy.tryThisNowGrammar) : undefined;
    const quizA = pedagogy ? quizDefs.get(pedagogy.quizOpeners[0]) : undefined;
    const quizB = pedagogy ? quizDefs.get(pedagogy.quizOpeners[1]) : undefined;
    const pedagogyLines = pedagogy
      ? `• HOOK SHAPE: ${pedagogy.hookShape} — ${hookDefs.get(pedagogy.hookShape) ?? "follow the dealt hook shape."} The definition gives the SHAPE, not a script: if it carries a miniature example, NEVER reuse its wording, object, or path — the same shape is dealt to other chapters, so a copied opener frame stamps the book (scene_skeleton). Open with your own concrete image.\n` +
        `• TRY-THIS-NOW GRAMMAR: ${pedagogy.tryThisNowGrammar} — ${tryGrammar?.definition ?? "follow the dealt exercise grammar."} (example: ${tryGrammar?.example ?? "keep it concrete."}); marquee tactic family: ${pedagogy.tacticFamily} — ${tacticDefs.get(pedagogy.tacticFamily) ?? "follow the dealt tactic family."}. The dealt GRAMMAR shapes the sentence; the dealt FAMILY shapes the action. Other chapters own other families — do not borrow their moves (no phone-facedown unless dealt). This is a FORM, not a stamp: write a fresh action for it — do not copy the example's WORDING, and not just its first words: any time, number, or name you copy from it (a clock like "9:30", a count) stamps book-wide across the chapters dealt this same form and trips BP29 timing / grammar stamps (the outliers fleet caught these recycling every third chapter).\n` +
        `• QUIZ OPENERS: draw from two FORMS — ${pedagogy.quizOpeners[0]} (e.g. ${quizA?.example ?? "use the dealt opener."}) and ${pedagogy.quizOpeners[1]} (e.g. ${quizB?.example ?? "use the dealt opener."}). These are question SHAPES, not sentences. The (e.g. …) is ONE illustration of the shape — NEVER copy its wording: the SAME form is dealt to many chapters, so a copied example stem stamps book-wide and trips BP20 (a gate BLOCKER) — the qc-run sweep has caught "What happens next" 34× and "what should the reader infer first" 10× exactly this way. Write every stem in your chapter's own scenario language; never reuse a literal stem twice in the chapter; vary the phrasing inside each form; let 1-2 questions per chapter break form entirely. Keyed answer must NOT be reliably the longest choice (BP25 — target ≤45% of questions, ~33% ideal).\n`
      : "";
    const exemplar = exemplarPlan.allocation[ch.number];
    const exemplarLine = exemplar
      ? `• MARQUEE EXEMPLARS: this chapter owns ${formatExemplarOwned(exemplar)}. ` +
        `FORBIDDEN (owned by other chapters): ${formatExemplarForbidden(exemplar)}` +
        ` — at most a passing mention, never with date/place stamping, never as a teaching unit, never in quiz/cards. Set example[i].planSpec.exemplar to the owned exemplar used by that scene, or "" when none is used.\n`
      : "";
    const venueIds = venuePlan.allocation[ch.number] ?? [];
    const venueLine = venueIds.length
      ? `• VENUES (a FALLBACK palette for variety — NOT a mandate): the SOURCE CASE is the stage. Stage each example in its source case's own natural setting. Only if a case has no natural setting, draw a venue FROM YOUR DEALT PALETTE BELOW for variety — do NOT reach for a generic kitchen table, conference room, or break room; those are the settings every chapter defaults to, and 3+ chapters sharing one venue trips BP27.venue_stamping (a book-gate major QC will REVISE on). NEVER relocate the real case to a dealt venue and demote the case to notes "glowing on a phone" or an invented onlooker (SL3 blocks this). A venue may be a relationship CHANNEL (a phone call, a text thread), not only a place. Don't put two examples at the same venue; FIT staging to the topic (a personal/relational subject belongs in a home or direct-channel setting, not a workplace prop). VARY the scene SHAPE — don't open every scenario "<Name> <verb>s at/beside a <prop>". Set example[i].planSpec.venue to the setting you actually used (optional).\n    palette: ${venueIds.join("; ")}\n`
      : "";
    const rhet = rhetoricPlan.allocation[ch.number];
    const rhetoricLine = rhet
      ? `• OPENERS (anti-clustering — the book must not converge on one shape): counterintuition = ${rhet.counterShape} — ${rhet.counterDirective} || hook = ${rhet.hookOpenerClass} — ${rhet.hookDirective} These are YOUR assigned shapes; do not default to the "X is not Y" negation shell (B11) or open the hook with "What" (B13).\n`
      : "";
    const cadenceLine = formatCadenceForChapter(cadencePlan, ch.number).map((l) => `    ${l}`).join("\n");
    const akTarget = answerKeyPlan.allocation[ch.number] ?? [];
    const answerKeyLine = akTarget.length
      ? `• ANSWER-KEY TARGET — place the correct answers at these positions across the ${akTarget.length} questions: [${akTarget.join(", ")}]. Score each question for TRUTH first, then arrange the (unchanged) choices so the correct one lands on its target position. This keeps the book balanced (prevents F3 answer-position drift). NEVER change which choice is true to hit a position.\n`
      : "";

    // Source specifics: the sidecar's real anchors, pasted so the writer
    // grounds scenes in them instead of inventing interchangeable ones (SC9's
    // root cause). Artifact-aware lookup per chapter. A THIN sidecar gets a
    // loud warning instead of silence — weak source reliably predicts
    // templated/ungrounded chapters, and the writer must flag, not invent.
    const sidecarPath = findRunArtifact(RUNS, bookId, `sidecars/source/ch${numStr}.source.json`);
    let specificsLine = "";
    if (sidecarPath) {
      try {
        const sc = JSON.parse(readFileSync(sidecarPath, "utf8"));
        const specs: string[] = [];
        let hardCount = 0;
        for (const ex of (sc?.namedExamples ?? []).slice(0, 5)) {
          const label = typeof ex === "string" ? ex : ex?.label;
          const hard = Array.isArray(ex?.hardSpecifics) ? ex.hardSpecifics[0] : undefined;
          if (hard) hardCount++;
          if (label) specs.push(hard ? `${label} (${String(hard).slice(0, 60)})` : String(label));
        }
        if (specs.length >= 2) {
          specificsLine = `• Ground the scenes in the source's REAL cases — use at least 2 of these meaningfully: ${specs.join("; ")}\n`;
        } else {
          specificsLine =
            `• ⚠️ THIN SOURCE: this chapter's sidecar has ${specs.length} named example(s) and ${hardCount} hard specific(s). ` +
            `Do NOT invent cases to compensate — write what the source supports and tell the operator the sidecar needs a Step-1 re-research pass.\n`;
        }
      } catch { /* unreadable sidecar → omit the line; STEP-2 still requires grounding */ }
    }

    // Voice bible: the book's charter from the editor-in-chief brief, pinned
    // BEFORE authoring so parallel agents share one register.
    const voice = formatVoiceBible(bookId);
    const voiceLine = voice ? `• VOICE (the book's charter — every field obeys it):\n    ${voice}\n` : "";

    // Spaced-recall callback: dealt a distinct prior chapter + question frame so
    // the book's callback cards don't collapse onto one concept+shell (BP28).
    const cb = callbackPlan.allocation[ch.number];
    const recallLine = ch.number > 1
      ? (cb
        ? `• Spaced recall: make ONE review card resurface the core concept from CHAPTER ${cb.callbackChapter} (name that concept on the front). ${cb.directive} Do NOT reuse one concept+question shell across the book (e.g. "How does X help with Y") — your callback target and frame are dealt to differ from every other chapter's.\n`
        : `• Spaced recall: make 1–2 review cards resurface a concept from an EARLIER chapter (name it on the front); use a question frame no other chapter reuses.\n`)
      : "";
    // Narrative stance: book-wide cap on the retrospective-evidence scene engine.
    const sceneMode = sceneModePlan.allocation[ch.number];
    const sceneModeLine = sceneMode
      ? `• SCENE STANCE (book-wide variety — most chapters must NOT review evidence after a closed outcome): ${sceneMode.stance} — ${sceneMode.directive}\n`
      : "";
    // Scene mechanism: the FUNCTIONAL MOVE the chapter's marquee scene dramatizes, so the
    // book can't reuse one device across chapters. A DIFFERENT axis from the dealt SHAPE
    // (grammar) and STANCE (vantage) — this is the dramatic transaction (who acts, what changes).
    const smech = sceneMechanismPlan.allocation[ch.number];
    const sceneMechanismLine = smech
      ? `• SCENE MECHANISM (build THIS chapter's marquee scene on this functional MOVE — book-wide variety): ${smech.directive} This is the WHAT-HAPPENS, not the construction (your dealt SHAPES decide that) and not the stance. Other chapters are dealt OTHER moves; do NOT fall back to a favorite device (a leader losing her voice and a substitute taking over; a message restarted/reframed) unless THIS move is the one dealt. Render it with this chapter's own concept, people, and source case.\n`
      : "";
    // Action timing: situational trigger, never an arbitrary clock stamp (BP29).
    const tm = timingPlan.allocation[ch.number];
    const timingLine = tm
      ? `• ACTION TIMING (try-this-now): ${tm.directive} Do NOT schedule the action at an arbitrary clock time (no "9:10 a.m.") — anchor it to a situational moment in the reader's own day.\n`
      : "";
    // Action mechanism: the CONTAINER the try-now/24-hour action lives in, so the
    // book doesn't funnel every action into a timer/calendar (BP30). Distinct
    // from pedagogy's tacticFamily (the teaching tactic) — this governs ONLY the
    // tryThisNow + 24-hour challenge fields.
    const am = actionMechanismPlan.allocation[ch.number];
    const actionMechanismLine = am
      ? `• ACTION MECHANISM (tryThisNow + 24-hour challenge ONLY): ${am.directive} Unless this is the dealt timer/calendar chapter, do NOT use a timer, calendar event, alarm, or reminder as the action container.\n`
      : "";
    // Weekly-practice form: vary the practice shape so weeklyPractice doesn't
    // collapse onto one "seven-day log" shell (repeated_unit).
    const wp = weeklyPracticePlan.allocation[ch.number];
    const weeklyPracticeLine = wp
      ? `• WEEKLY PRACTICE FORM (implementationPlan.weeklyPractice): ${wp.directive}\n`
      : "";
    // Full-read boundary beat: vary the third-angle caveat so fullRead doesn't
    // close every chapter with the same bare "limit" hinge (scene_skeleton).
    const fr = fullReadSkeletonPlan.allocation[ch.number];
    const fullReadSkeletonLine = fr
      ? `• FULLREAD THIRD-ANGLE / BOUNDARY (breakdown.fullRead close): ${fr.directive}\n`
      : "";

    blocks.push(
      `─── Chapter ${ch.number} — "${ch.title}"${written ? "  (already written — re-do)" : ""} ───\n` +
        `${roleHintHeader("write")}\n` +
        `You are an expert nonfiction writer. Write chapter ${ch.number} of "${title}" for ChapterFlow — one chapter a curious reader will actually remember and use. The dealt constraints below are not hoops to clear; they are the variety tools that keep this chapter from collapsing into the same scene-and-quiz shell as its siblings. Use them to make it genuinely good. Work in this folder:\n` +
        `  ${PIPE}\n` +
        `• SCOPE: author EXACTLY this one chapter (chapter ${ch.number}). Do NOT QC, publish, package, or edit any other chapter — sibling chapters are being authored in parallel; never touch their files.\n` +
        `• Read its source notes: ${sidecarPath ?? "(no sidecar found — STOP and run Step-1 research for this chapter first)"}\n` +
        `• Use ONLY these character names: ${names}\n` +
        `• SCENE SHAPES — example[i] MUST use shape i below. This is the anti-skeleton plan (R6): structurally different scenes cannot share the "[Name] does X at [time] in [place]" frame. A binary "must decide whether A or B" tension may appear at most ONCE (only in a 'dilemma' slot).\n` +
        `${shapeLines}\n` +
        (openerLines ? openerLines + "\n" : "") +
        (stakesLines ? stakesLines + "\n" : "") +
        sceneModeLine +
        sceneMechanismLine +
        varietyMapFor(ch.number) +
        venueLine +
        rhetoricLine +
        (cadenceLine ? cadenceLine + "\n" : "") +
        pedagogyLines +
        answerKeyLine +
        timingLine +
        actionMechanismLine +
        weeklyPracticeLine +
        fullReadSkeletonLine +
        specificsLine +
        exemplarLine +
        voiceLine +
        `• QUIZ DISTRACTORS — all three choices must read as the SAME KIND of answer (axis quiz_distractor_quality, weight 13, floor 0.6 — this axis is REVISE-ing the whole book). A reader who has NOT read the chapter must be unable to pick the key from surface form alone.\n` +
        `  1. NO labels or category prefixes on ANY choice. Each choice is a plain sentence. Never write 'Capitalized Phrase: …' (e.g. "Status Proof: …", "Assumption Test: …"). If you tag one choice, you must remove the tag from ALL choices.\n` +
        `  2. NO valence-sorting. The key must not be the choice that "sounds virtuous/correct" while the distractors "sound wrong." On their face, all three look equally reasonable to someone who doesn't know the answer.\n` +
        `  3. Each distractor is a genuine near-miss — what a thoughtful reader who skimmed THIS chapter would actually conclude — built from the source fact's commonError. Not a caricature, not the key reworded, not a junk-prefix mutation.\n` +
        `  4. Same register, length, and specificity across all three (same sentence shape, similar length; no choice more polished or more hedged than the others).\n` +
        `  GOOD (no labels, key plausible among plausibles): "They prove the inventory can stay practical because habits are already controlled." / "They show the ban extends proven habit change rather than replacing prior progress." / "They make the first month a budgeting exercise with little connection to skills."\n` +
        `  BAD (labels + valence → key obvious): "Private Self-Governance: the note trains his conduct first." (keyed) / "Status Proof: the note mattered for public image." / "Audience Craft: the note is a polished lesson to impress."\n` +
        `  SELF-CHECK before submit: strip each choice to its bare clause and ask — "could someone who never read the chapter still guess the key?" If yes, rewrite the distractors as real near-misses.\n` +
        recallLine +
        `• One name = one person across breakdown→examples→quiz — and that person's role stays fixed for the whole book. NEVER reuse a real source-figure's name for a fictional actor (persona drift).\n` +
        `• Follow agent-prompts/STEP-2-WRITE-CHAPTERS.md (the authoring law).\n` +
        `• Save to state/chapters/${chapterId}.v21-native.chapter.json\n` +
        `• PLAIN LANGUAGE (R2.7 — product direction): every abstract claim is followed within TWO sentences by something the reader can SEE (a person, a scene, a number). Say it like you'd say it to a smart friend at lunch. Define terms-of-art in everyday words the first time; never stack two undefined abstractions in one sentence. Each breakdown tier OPENS concrete, not with a thesis. Short common words win. This applies to EVERY reader-facing field (quiz, cards, examples, hook, keyTakeaway, plan), not just the breakdown — a gate (E7) flags fancy words with their plain swap (utilize→use, leverage→use, facilitate→help) and any sentence over 34 words (over 24 in a one-liner). Target grade 7–9.\n` +
        softBanLine +
        `• TWO-PASS: after drafting, self-critique against agent-prompts/FIELD-PURPOSE-CONTRACTS.md (concept-as-actor, templated loops, echo-template explanations, bare-label card fronts, proposition-not-action whatToDo) AND against R2.7 (read your fastRead aloud — if a sentence wouldn't survive being said to a friend, rewrite it) and FIX what you find before gating.\n` +
        `• THE REAL TARGET IS THE PUBLISHABLE BAR, NOT THE GATE. QC's verdict comes from a reviewer scoring your chapter on 9 weighted axes (PASS = ≥85/100, no axis <0.6). A gate-clean chapter can still be REVISE'd. BEFORE you finish, run \`npx tsx src/cli.ts publishable-rubric\` and self-score this draft on every axis; fix any axis you'd score below ~0.85 and ANY corruption-axis hit (quiz_key_correctness, example_coherence, prose_coherence, factual_accuracy). The biggest levers: derive each quiz key yourself from the source and confirm the keyed index, make distractors real misconceptions, give each example a concrete acting scene with a decision, keep prose concrete + plain.\n` +
        `• gate-chapter majors (C2/E4 → example_coherence/prose_coherence, E7/E1/A13 → prose readability, C23 → example variety) are NOT free hints — QC's finalizer BLOCKS the chapter on any unresolved major, so handing one off costs a whole QC round downstream. TRIAGE every major before you finish: fix the genuine scene/sentence defect (most are real). The gold reference books trip a few of these on genuinely good prose — leave ONLY a major you can defend as that kind of false positive; never hand off one you simply didn't look at. EXCEPTION — a DETERMINISTIC register ban (B-class: B4 banned-phrase, B5 em-dash, and the other lexical bans) is house POLICY, not a prose-quality call: it can NEVER be defended as a false positive. The phrase is forbidden no matter how good the sentence reads — rewrite it. (digital-minimalism ch1 self-attested a banned-phrase B4 as an FP twice and ate two QC rounds.)\n` +
        `• QUIZ KEYS (quiz_key_correctness, weight 17 — the heaviest axis): the blind keyA/keyB judge re-derives each answer from prompt + choices + this chapter's source testableFacts[] ONLY (claim/becauseMechanism/commonError/errorIsWhy), never your prose. Anchor each question to a testableFact (set its sourceAnchorId), key the choice that fact uniquely supports, and build the two distractors from that fact's commonError. See STEP-2 "Derive every key the way the BLIND judge will".\n` +
        `• SOURCE FIDELITY (factual_accuracy — a CORRUPTION veto; one drifted fact RED-gates the whole book): every fact, number, date, and attributed quote traces to this chapter's source sidecar; complete every named framework with the source's EXACT member names (no renames, no dropped items). If the sidecar can't ground a claim, cut it — never invent.\n` +
        `• REVIEW CARDS (card_learning_value — CORRUPTION if the back doesn't answer the front): each back ANSWERS its front in the card's OWN words and tests understanding (give the mechanism / named parts), is NOT pasted from the breakdown, and ENDS on a complete sentence (80–400 chars). Fronts retrieve an idea, not a bare label.\n` +
        `• MEMORABLE LINES (memorable_line_quality): each must be a portable APHORISM — one compact, complete claim (~12 words), not a 16–23-word teaching sentence or a list. Since memorableLines must be verbatim from the breakdown (A11), WRITE three short maxim-shaped sentences INTO the tiers on purpose, then point memorableLines at those exact lines.\n` +
        `• Then run: npx tsx src/cli.ts gate-chapter state/chapters/${chapterId}.v21-native.chapter.json\n` +
        `  Fix every blocker, then re-run until it prints "Gate verdict: PASS — 0 blockers". Stop only when it is gate-clean AND you'd self-score every bar axis ≥0.85.`,
    );
    cardMeta.push({ number: ch.number, chapterId });
  }
  // --write-dir <path>: emit one card FILE per chapter instead of one large stdout
  // blob. The blob is what pushed operators to pull cards via per-chapter `fanout
  // --from N --to N` calls — the workaround that defeated cross-chapter name/exemplar
  // disjointness. With files, the operator deals the whole book in ONE call (cursors
  // advance correctly) and hands each writer subagent its own file.
  const writeDir = typeof flags["write-dir"] === "string" ? (flags["write-dir"] as string) : undefined;
  if (writeDir) {
    const outDir = resolve(process.cwd(), writeDir);
    mkdirSync(outDir, { recursive: true });
    const written: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const meta = cardMeta[i];
      const file = resolve(outDir, `ch${String(meta.number).padStart(2, "0")}.authoring-card.md`);
      writeFileSync(file, blocks[i] + "\n", "utf8");
      written.push(file);
    }
    console.log(
      `fanout — ${bookId} (ch${from}-${to}): wrote ${written.length} authoring-card file(s) to ${outDir}` +
        (includeAll ? "" : `  [${done} already written, skipped — use --all to include]`),
    );
    for (const f of written) console.log(`  ${f}`);
    console.log(`\nEach file is a COMPLETE, ready-to-paste writer dispatch prompt. Hand one file to one fresh writer subagent VERBATIM (run them in parallel, ≤6 at a time). When the batch finishes, check it:\n  npx tsx src/cli.ts book-gate ${bookId}`);
    return 0;
  }
  console.log(
    `fanout — ${bookId} (ch${from}-${to}): ${pending} prompt(s) to paste` +
      (includeAll ? "" : `  [${done} already written, skipped — use --all to include]`) +
      `\n`,
  );
  console.log(blocks.join("\n\n"));
  console.log(`\nEach "─── Chapter N ───" block above is a COMPLETE, ready-to-paste writer dispatch prompt — paste one block VERBATIM as a fresh writer subagent's entire instruction (run them in parallel). Do not wrap, summarize, or add your own framing; the block already carries the persona, scope, dealt variety, and the gate/rubric loop. When the batch finishes, check it:\n  npx tsx src/cli.ts book-gate ${bookId}`);

  // --barrier: run book-gate as a deterministic pre-QC barrier and print
  // targeted re-dispatch hints for the offending chapters. The CLI stays
  // deterministic over files (it never spawns); the WRITE-ORCHESTRATE session
  // loops: re-author offenders → re-run --barrier until PASS. So by the time QC
  // runs, the actionable shadow-major families (BP28/BP29/BP30/BP31) — each
  // zero-on-clean and a known bar REVISE driver — are already cleared, even
  // though they don't fail bookGate.passed (only blockers do). Single source of
  // truth for the offender set: isWriteBarrierActionable in critics/bookGate.ts.
  if (flags["barrier"] === true) {
    console.log(`\n──────────── barrier ────────────`);
    console.log(`[barrier] Running book-gate as a pre-QC barrier for ${bookId}...\n`);
    const gateCode = await runBookGate([bookId]); // full report (derive-artifacts + shadow checks)
    const { loadBookChapters } = await import("./qc/manualKeyJudge.js");
    const { runBookGate: runBookGateCritic, isWriteBarrierActionable, isUnsurfacedBarrierMajor } = await import("./critics/bookGate.js");
    const report = runBookGateCritic(bookId, loadBookChapters(bookId));
    const offenders = new Set<number>();
    // Book-wide majors that pass book-gate (no blocker) yet QC finalize REVISEs on
    // (checks.majors !== "PASS"): without surfacing them, a bare-"PASS" barrier
    // hands QC a guaranteed repair round (the BP27 venue / F4 leak observed on
    // eat-that-frog). Shift-left: name them so they're fixed while writers are warm.
    const residualMajors: typeof report.findings = [];
    for (const f of report.findings) {
      if (isWriteBarrierActionable(f)) for (const c of f.chapters ?? []) offenders.add(c);
      else if (isUnsurfacedBarrierMajor(f)) residualMajors.push(f);
    }
    if (gateCode === 0 && offenders.size === 0 && residualMajors.length === 0) {
      console.log(`\n[barrier] PASS — book-gate clean and no structural-sameness offenders. Hand off to QC.`);
      return 0;
    }
    if (offenders.size > 0) {
      console.log(`\n[barrier] Re-dispatch ONLY these offending chapters (their deals are idempotent — a redo gets the same varied assignment), fix the findings above, then re-run --barrier:`);
      for (const n of [...offenders].sort((a, b) => a - b)) {
        console.log(`  npx tsx src/cli.ts fanout ${bookId} --from ${n} --to ${n} --all`);
      }
    }
    if (residualMajors.length > 0) {
      console.log(`\n[barrier] ${residualMajors.length} book-wide MAJOR(s) pass book-gate but QC will REVISE on them (checks.majors must be PASS) — DO NOT qc-stamp-author yet, or you buy a full QC round to rediscover these. Resolve each, then re-run --barrier:`);
      for (const f of residualMajors) {
        if (f.chapters?.length) {
          console.log(`  [${f.catalogId}] ch${f.chapters.join(", ch")} — ${f.message}`);
          console.log(`     fix: re-dispatch those chapters so they stop sharing the pattern: npx tsx src/cli.ts fanout ${bookId} --from <n> --to <n> --all`);
        } else {
          console.log(`  [${f.catalogId}] book-wide (no single chapter) — ${f.message}`);
          console.log(`     fix: rebalance the pattern across the book (e.g. answer-position spread, phrase budget) — not a single-chapter re-dispatch.`);
        }
      }
    }
    if (offenders.size === 0 && residualMajors.length === 0) {
      console.log(`\n[barrier] Remaining findings are book-wide (no single offending chapter) — address per the messages above, then re-run --barrier.`);
    }
    console.log(`\n[barrier] Loop until PASS; cap at 3 re-dispatch rounds — a finding that survives 3 rounds is a source/plan problem, so STOP and surface it to the operator.`);
    return 1;
  }
  return 0;
}

/** `shape-plan <bookId> --from N --to M` — pre-authoring scene-shape allocator
 *  (name-plan's pattern applied to example STRUCTURE). Deals each chapter a
 *  slot-pinned palette of structurally distinct scene shapes so parallel
 *  authoring agents can't converge on one frame — the skeleton class that has
 *  no viable deterministic gate. fanout runs this automatically; the command
 *  exists to preview/regenerate. */
async function runShapePlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: shape-plan <bookId> --from N --to M");
    return 2;
  }
  const { planShapes, writeShapePlan, formatShapePlan } = await import("./librarian/shapePlan.js");
  const plan = planShapes(bookId, from, to);
  const path = writeShapePlan(plan);
  console.log(formatShapePlan(plan));
  console.log(`\nWritten: ${path}`);
  return 0;
}

/** `pedagogy-plan <bookId> --from N --to M` — pre-authoring allocator for
 *  catalog-level slot variety. Deals a hook-shape, try-this-now grammar, and
 *  alternating quiz-opener pair per chapter so parallel STEP-2 agents don't all
 *  reuse the same pedagogical surface. fanout runs this automatically; the
 *  command exists to preview/regenerate. */
async function runPedagogyPlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: pedagogy-plan <bookId> --from N --to M");
    return 2;
  }
  const { planPedagogy, writePedagogyPlan, formatPedagogyPlan } = await import("./librarian/pedagogyPlan.js");
  const plan = planPedagogy(bookId, from, to);
  const path = writePedagogyPlan(plan);
  console.log(formatPedagogyPlan(plan));
  console.log(`\nWritten: ${path}`);
  return 0;
}

/** `exemplar-plan <bookId> [--from N --to M]` — pre-authoring ownership ledger
 *  for repeated marquee source figures/cases. Deals each repeated exemplar to
 *  exactly one chapter and forbids teaching-unit reuse elsewhere. Exemplar ownership
 *  is inherently CROSS-CHAPTER and this command persists the single canonical artifact
 *  the SP5 gate reads, so it derives over the WHOLE book — a partial range would
 *  compute forbidden=∅ and clobber the full plan (the deal↔gate inconsistency WS-2
 *  closes on the fanout path). --from/--to are ignored for the ownership computation. */
async function runExemplarPlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: exemplar-plan <bookId> [--from N --to M]");
    return 2;
  }
  const { planExemplars, writeExemplarPlan, formatExemplarPlan } = await import("./librarian/exemplarPlan.js");
  const { expectedSourceChapters } = await import("./qc/sourceV2Gate.js");
  const nums = expectedSourceChapters(bookId);
  let from: number;
  let to: number;
  if (nums.length > 0) {
    from = Math.min(...nums);
    to = Math.max(...nums);
    if (flags["from"] || flags["to"]) console.log("note: exemplar ownership is cross-chapter — deriving over the whole book and ignoring --from/--to.");
  } else {
    // No chapter index (pre-research): fall back to the operator-supplied range.
    from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
    to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
    if (Number.isNaN(from) || Number.isNaN(to)) {
      console.error("No chapter index for this book yet — run research first, or pass --from N --to M.");
      return 2;
    }
  }
  const plan = planExemplars(bookId, from, to);
  const path = writeExemplarPlan(plan);
  console.log(formatExemplarPlan(plan));
  console.log(`\nWritten: ${path}`);
  return 0;
}

/** `venue-plan <bookId> --from N --to M` — pre-authoring allocator for example
 *  venues. Deals six distinct places per chapter, with no overlap between
 *  consecutive chapters and a book-wide cap of two chapters per venue. */
async function runVenuePlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: venue-plan <bookId> --from N --to M");
    return 2;
  }
  const { planVenues, writeVenuePlan, formatVenuePlan } = await import("./librarian/venuePlan.js");
  const plan = planVenues(bookId, from, to);
  const path = writeVenuePlan(plan);
  console.log(formatVenuePlan(plan));
  console.log(`\nWritten: ${path}`);
  return 0;
}

/** `answer-key-plan <bookId> --from N --to M [--questions Q]` — pre-authoring
 *  allocator for quiz correctIndex. Deals each chapter a balanced target
 *  distribution so the book aggregates under the F3 ceiling by construction.
 *  Author scores for truth first, then arranges the choices to the target. */
async function runAnswerKeyPlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: answer-key-plan <bookId> --from N --to M [--questions Q]");
    return 2;
  }
  const questions = typeof flags["questions"] === "string" ? parseInt(flags["questions"] as string, 10) : undefined;
  const { planAnswerKeys, writeAnswerKeyPlan } = await import("./librarian/answerKeyPlan.js");
  const plan = planAnswerKeys(bookId, from, to, questions);
  const path = writeAnswerKeyPlan(plan);
  for (let n = from; n <= to; n++) console.log(`  ch${String(n).padStart(2, "0")}: [${(plan.allocation[n] ?? []).join(",")}]`);
  console.log(`\naggregate counts=[${plan.aggregate.counts.join(",")}] maxFraction=${plan.aggregate.maxFraction.toFixed(3)} (ceiling ${0.4})`);
  console.log(`Written: ${path}`);
  return 0;
}

/** `rhetoric-plan <bookId> --from N --to M` — pre-authoring allocator for the
 *  counterintuition paradox shape (B11/B14) and the hook opener class (B13).
 *  Deals varied shapes so no opener clusters across the book by construction. */
async function runRhetoricPlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: rhetoric-plan <bookId> --from N --to M");
    return 2;
  }
  const { planRhetoric, writeRhetoricPlan, formatRhetoricPlan } = await import("./librarian/rhetoricPlan.js");
  const plan = planRhetoric(bookId, from, to);
  const path = writeRhetoricPlan(plan);
  console.log(formatRhetoricPlan(plan));
  console.log(`\nWritten: ${path}`);
  return 0;
}

/** `name-plan <bookId> --from N --to M [--per-chapter K]` — pre-authoring name
 *  allocator. Deals each upcoming chapter a disjoint protagonist-name slice
 *  (excluding current-book planned names and catalog cooldown names) and emits
 *  the banned-connective guidance, so parallel STEP-2 agents can't collide on F1/BP13.
 *  Writes state/name-plans/<bookId>.name-plan.json and prints the allocation. */
async function runNamePlan(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const from = typeof flags["from"] === "string" ? parseInt(flags["from"] as string, 10) : NaN;
  const to = typeof flags["to"] === "string" ? parseInt(flags["to"] as string, 10) : NaN;
  if (!bookId || Number.isNaN(from) || Number.isNaN(to)) {
    console.error("Usage: name-plan <bookId> --from N --to M [--per-chapter K]   (default per-chapter 7)");
    return 2;
  }
  const perChapter = typeof flags["per-chapter"] === "string" ? parseInt(flags["per-chapter"] as string, 10) : 7;
  if (Number.isNaN(perChapter) || perChapter < 1) {
    console.error(`--per-chapter must be a positive integer (got "${String(flags["per-chapter"])}")`);
    return 2;
  }
  const { planNames, writeNamePlan, formatNamePlan } = await import("./librarian/namePlan.js");
  // --force-fresh: deal fresh catalog-exclusive names even for authored
  // chapters — the refresh path uses this to build old→new RENAME maps
  // (carried allocations only echo the on-disk names, collisions included).
  const plan = planNames(bookId, from, to, perChapter, { forceFresh: flags["force-fresh"] === true });
  const path = writeNamePlan(plan);
  console.log(formatNamePlan(plan));
  console.log("");
  console.log(`Written: ${path}`);
  // Non-zero so a batch driver notices an exhausted/over-broad request.
  if (plan.diagnostics.shortChapters.length > 0) {
    console.error(`\n⚠ name bank ran dry for ${plan.diagnostics.shortChapters.length} chapter(s) — add names to config/name-bank.json or lower --per-chapter.`);
    return 1;
  }
  return 0;
}

async function runQcOpenRound(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: qc-open-round <bookId>");
    return 2;
  }
  const { openQcRound, QC_ROUND_ROLES } = await import("./qc/qcRound.js");
  try {
    const { record, tokens, path } = openQcRound(bookId);
    console.log(`QC round opened: ${record.roundId}`);
    console.log(`Stored: ${path}`);
    console.log("Plaintext role tokens (shown once):");
    for (const role of QC_ROUND_ROLES) console.log(`  ${role}: ${tokens[role]}`);
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
}

async function runQcOrchestrate(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: qc-orchestrate <bookId> --create [--chapters 1,2] | --collect|--confirm-candidates|--finalize|--render-repair|--verify-repair --round <roundId>");
    return 2;
  }
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  const orch = await import("./qc/orchestrator/index.js");
  if (flags["create"] === true) {
    const result = orch.createQcOrchestrationRound(bookId, {
      roundId: roundId || undefined,
      chapters: orch.parseChapterList(flags["chapters"]),
      allowDirtyPreflight: flags["allow-dirty-preflight"] === true,
      incremental: flags["incremental"] === true,
      tiebreak: flags["tiebreak"] === true,
      noSweepCarry: flags["no-sweep-carry"] === true,
    });
    for (const m of result.messages) console.log(m);
    if (result.errors.length) for (const e of result.errors) console.error(e);
    console.log(`qc-orchestrate: ${result.ok ? "created" : "created-with-errors"} ${result.roundId}`);
    console.log(`  ${result.roundDir}`);
    return result.ok ? 0 : 1;
  }
  if (!roundId) {
    console.error("qc-orchestrate requires --round <roundId> for --collect, --confirm-candidates, --finalize, --render-repair, and --verify-repair.");
    return 2;
  }
  if (flags["collect"] === true) {
    const result = orch.collectQcRound(bookId, roundId);
    console.log(JSON.stringify(result.summary, null, 2));
    if (result.errors.length) for (const e of result.errors) console.error(e);
    return result.ok ? 0 : 1;
  }
  if (flags["confirm-candidates"] === true) {
    const result = orch.generateConfirmCandidates(bookId, roundId, {
      chapters: orch.parseChapterList(flags["chapters"]),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length) for (const e of result.errors) console.error(e);
    return result.ok ? 0 : 1;
  }
  if (flags["finalize"] === true) {
    const collected = orch.collectQcRound(bookId, roundId);
    if (!collected.ok) {
      console.log(JSON.stringify({
        ok: false,
        incomplete: true,
        errors: collected.errors,
        collected: collected.summary,
      }, null, 2));
      for (const e of collected.errors) console.error(e);
      return 3;
    }
    // Freshness gate (parity with qc-auto): never write attestations against a
    // round that predates freshness tracking or whose chapters changed since
    // the round was opened. --no-attest stays allowed for diagnostics.
    const finalizeChapters = orch.parseChapterList(flags["chapters"]);
    // --dry-run previews the verdict and writes NOTHING durable (no attestations, evidence
    // matrix, qc-summary, repair brief, or ledger). finalizeQcRound already supports this; the
    // CLI just has to pass it. A dry-run never attests, so it is neither gated nor blocked by the
    // stale-round refusal (which only guards attestation writes).
    const isDryRun = flags["dry-run"] === true;
    const wantAttest = flags["no-attest"] !== true && !isDryRun;
    if (wantAttest) {
      const freshness = orch.checkRoundFreshness(bookId, roundId, finalizeChapters);
      if (!freshness.fresh) {
        const stale = freshness.staleChapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ");
        console.error(`STALE_ROUND: ${freshness.missingHashes ? "round predates freshness tracking" : `stale chapters: ${stale}`}.`);
        console.error("Refusing to attest a stale round. Start a fresh QC round, or pass --no-attest for diagnostics only.");
        return 3;
      }
    }
    const result = orch.finalizeQcRound(bookId, roundId, {
      chapters: finalizeChapters,
      attest: wantAttest,
      dryRun: isDryRun,
    });
    console.log(JSON.stringify({
      ...result,
      dryRun: isDryRun,
      collected: collected.summary,
    }, null, 2));
    if (isDryRun) {
      const wouldAttest = result.chapters.filter((c) => c.finalVerdict === "PUBLISHABLE").length;
      console.error(`DRY RUN — nothing written. Would attest ${wouldAttest} PUBLISHABLE chapter(s) and write the evidence matrix on a real run.`);
    }
    for (const e of [...collected.errors, ...result.errors]) console.error(e);
    if (result.incomplete) return 3;
    if (result.repairRequired) return 1;
    return result.allPublishable ? 0 : 1;
  }
  if (flags["render-repair"] === true) {
    const path = orch.renderRepair(bookId, roundId);
    console.log(`repair brief: ${path}`);
    return 0;
  }
  if (flags["verify-repair"] === true) {
    const result = orch.verifyRepair(bookId, roundId);
    console.log(JSON.stringify(result.summary, null, 2));
    return result.ok ? 0 : 1;
  }
  console.error("Usage: qc-orchestrate <bookId> --create [--chapters 1,2] | --collect|--confirm-candidates|--finalize|--render-repair|--verify-repair --round <roundId>");
  return 2;
}

async function runQcSubmit(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  const role = typeof flags["role"] === "string" ? flags["role"] : "";
  const token = typeof flags["token"] === "string" ? flags["token"] : "";
  const file = typeof flags["file"] === "string" ? flags["file"] : "";
  if (!bookId || !roundId || !role || !token || !file) {
    console.error("Usage: qc-submit <bookId> --round <roundId> --role sweep|keyA|keyB|bar|confirm|major --token <token> --file <submission.json>");
    return 2;
  }
  const { SUBMISSION_ROLES } = await import("./qc/orchestrator/schemas.js");
  if (!(SUBMISSION_ROLES as readonly string[]).includes(role)) {
    console.error(`Unknown role "${role}". Use one of: ${SUBMISSION_ROLES.join(", ")}`);
    return 2;
  }
  const variant = typeof flags["variant"] === "string" ? flags["variant"] : "";
  if (variant && variant !== "t2" && variant !== "t3") {
    console.error(`Invalid --variant "${variant}". Use t2 or t3 (the bar self-consistency tiebreak reads).`);
    return 2;
  }
  const { submitQcArtifact } = await import("./qc/orchestrator/index.js");
  const result = submitQcArtifact(bookId, roundId, role as any, file, token, (variant || undefined) as "t2" | "t3" | undefined);
  for (const m of result.messages) console.log(m);
  if (result.errors.length) {
    for (const e of result.errors) console.error(e);
    return 1;
  }
  return 0;
}

async function runQcSchema(args: string[]): Promise<number> {
  const which = args[0];
  const { submissionJsonSchemaForRole, allSubmissionJsonSchemas } = await import("./qc/orchestrator/submissionSchemas.js");
  const all = allSubmissionJsonSchemas() as Record<string, object>;
  if (!which) {
    console.error("Usage: qc-schema <role|schemaVersion>");
    console.error("  roles: sweep, keyA, keyB, bar, confirm, major");
    console.error(`  schemas: ${Object.keys(all).join(", ")}`);
    console.error("Use the printed JSON Schema as a GPT structured-output `response_format` so a reviewer");
    console.error("subagent emits a shape-valid submission. The CLI still re-checks cross-field rules at qc-submit.");
    return 2;
  }
  const byRole = submissionJsonSchemaForRole(which);
  if (byRole) { console.log(JSON.stringify(byRole.schema, null, 2)); return 0; }
  if (all[which]) { console.log(JSON.stringify(all[which], null, 2)); return 0; }
  console.error(`Unknown role/schema "${which}". Roles: sweep, keyA, keyB, bar, confirm, major. Schemas: ${Object.keys(all).join(", ")}`);
  return 2;
}

async function runRoles(args: string[]): Promise<number> {
  const { loadRoleDefinitions, formatRoleProfile, getRole } = await import("./roles.js");
  const which = args[0];
  if (!which) {
    console.log("Pipeline roles (roles/ROLE-DEFINITIONS.json) — recommended GPT reasoning/verbosity per role:");
    for (const r of loadRoleDefinitions()) {
      console.log(`  ${r.roleId.padEnd(17)} reasoning:${r.reasoningEffort.padEnd(8)} verbosity:${r.verbosity.padEnd(7)} ${r.title}`);
    }
    console.log("\n`roles <roleId>` prints a role's full profile. The operator sets each session's GPT reasoning-effort to match.");
    return 0;
  }
  console.log(formatRoleProfile(which));
  return getRole(which) ? 0 : 2;
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSyncFs(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...listMarkdownFiles(path));
    else if (name.endsWith(".md")) out.push(path);
  }
  return out.sort();
}

function countSubmissionFiles(dir: string): number {
  if (!existsSyncFs(dir)) return 0;
  let count = 0;
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) count += countSubmissionFiles(path);
    else if (name.endsWith(".json") && !name.endsWith(".meta.json") && !/^ch\d+\.(bar-read|confirm-read)\.json$/.test(name)) count++;
  }
  return count;
}

async function runQcAuto(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const input = args.join(" ").trim();
  if (!input || flags["pass"] !== true) {
    console.error('Usage: qc-auto "<book name or id>" --pass [--round <id>] [--chapters 1,2] [--incremental] [--tiebreak] [--max-agents N] [--dry-run] [--no-attest] [--allow-stale-round]');
    return 2;
  }
  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") {
    console.error("qc-auto requires no-api Codex QC mode.");
    console.error("Run:");
    console.error(`  export CHAPTERFLOW_NO_API_CODEX_QC=1`);
    console.error(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(input)} --pass`);
    return 2;
  }

  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  if (resolved.ok === false) {
    console.error(resolved.message);
    if (resolved.reason === "ambiguous" && resolved.candidates?.length) {
      console.error("Candidates:");
      for (const c of resolved.candidates) console.error(`  ${c.bookId}${c.title ? ` — ${c.title}` : ""} (${c.source})`);
    }
    return 2;
  }

  const bookId = resolved.bookId;
  // Convergence guarantee: QC's book-level major scan (currentMajorFindings →
  // runBookGate → runBookPatternAudit) must run against the SAME derived brief +
  // per-chapter plans the final book-gate uses. Otherwise QC under-reports
  // book-level findings (pattern audit, BP*) that then surface late at book-gate —
  // after the repair prompt is already written — so the loop can't converge in one
  // pass. book-gate force-derives for exactly this reason; mirror it at the QC
  // entry. Deterministic + side-effect-free over on-disk content; non-fatal (a book
  // without research data still QCs) and skipped on --dry-run to keep previews read-only.
  if (flags["dry-run"] !== true) {
    const deriveCode = await runDeriveArtifacts([bookId]).catch(() => 1);
    if (deriveCode !== 0) {
      console.error(`note: derive-artifacts incomplete for ${bookId}; QC's book-level audit may be partial until plans exist.`);
    }
  }
  const orch = await import("./qc/orchestrator/index.js");
  const artifacts = await import("./qc/orchestrator/artifacts.js");
  const { generateQcAutoWorkflow } = await import("./qc/auto/generateWorkflow.js");
  const chapters = orch.parseChapterList(flags["chapters"]);
  const maxAgents = typeof flags["max-agents"] === "string" ? parseInt(flags["max-agents"], 10) : undefined;
  if (maxAgents !== undefined && (!Number.isInteger(maxAgents) || maxAgents < 1)) {
    console.error(`--max-agents must be a positive integer (got "${String(flags["max-agents"])}")`);
    return 2;
  }
  let roundId = typeof flags["round"] === "string" ? flags["round"] : "";

  if (!roundId || !existsSyncFs(artifacts.roundRecordPath(bookId, roundId))) {
    const created = orch.createQcOrchestrationRound(bookId, { roundId: roundId || undefined, chapters, allowDirtyPreflight: flags["allow-dirty-preflight"] === true, incremental: flags["incremental"] === true, tiebreak: flags["tiebreak"] === true });
    for (const m of created.messages) console.log(m);
    if (created.errors.length) for (const e of created.errors) console.error(e);
    roundId = created.roundId;
    if (!roundId) return 3;
  }

  // Treadmill guard (soft, advisory): a formal round that opens while deterministic
  // gates are dirty will rediscover those nits INSIDE the round and waste reviewer
  // submissions (15-36/round). createQcOrchestrationRound's preflight already blocks
  // on source-v2/book-gate, so this mostly surfaces ship-gate/author-check/intra-book/
  // plan-enforcement. Never blocks — the operator may have a reason; just warn + point
  // at qc-converge. Skipped on --dry-run (derive-artifacts is skipped there too).
  if (flags["dry-run"] !== true) {
    try {
      const { evaluateDeterministic } = await import("./qc/orchestrator/deterministicGate.js");
      const { loadBookChapters } = await import("./qc/manualKeyJudge.js");
      const allCh = loadBookChapters(bookId);
      const selCh = chapters && chapters.length ? allCh.filter((c) => chapters.includes(c.number)) : allCh;
      const det = evaluateDeterministic(bookId, selCh, allCh);
      if (!det.clean) {
        const n = [...det.perChapter.values()].reduce((a, c) => a + c.findings.length, 0) + det.bookFindings.length;
        console.log(`⚠ WARN: opening a formal QC round while ${n} deterministic finding(s) remain — they will resurface INSIDE the round and waste reviewer submissions (15-36/round).`);
        console.log(`    Converge first:  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-converge ${bookId}   # fix to DETERMINISTIC-CLEAN, then re-run qc-auto`);
      }
    } catch { /* advisory only — never let the warn break qc-auto */ }
  }

  const freshness = orch.checkRoundFreshness(bookId, roundId, chapters);
  const staleDiagnosticsOnly = !freshness.fresh && flags["allow-stale-round"] === true;
  if (!freshness.fresh && !staleDiagnosticsOnly) {
    console.log(`QC AUTO INCOMPLETE — ${bookId}`);
    console.log(`round: ${roundId}`);
    console.log(`status: STALE_ROUND`);
    console.log(`stale chapters: ${freshness.staleChapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}`);
    console.log("This round is stale after repair. Do not resume this round for publishability.");
    console.log("Start a fresh QC round:");
    console.log(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass`);
    return 3;
  }

  const workflowPath = generateQcAutoWorkflow(bookId, roundId, { maxAgents });
  const taskCards = listMarkdownFiles(artifacts.taskCardsDir(bookId, roundId));
  const submissions = countSubmissionFiles(artifacts.submissionsDir(bookId, roundId));

  if (flags["dry-run"] === true || submissions === 0) {
    console.log(`QC AUTO INCOMPLETE — ${bookId}`);
    console.log(`round: ${roundId}`);
    console.log("review packet (read this — content + rubric + per-role submit commands + skeletons):");
    console.log(`  ${orch.reviewPacketPath(bookId, roundId)}`);
    console.log(`workflow:`);
    console.log(`  ${workflowPath}`);
    console.log(`task cards:`);
    for (const p of taskCards) console.log(`  ${p}`);
    console.log("missing:");
    console.log("  subagent submissions are not present yet");
    console.log("how to proceed (fresh QC session): read the review packet, fill each skeleton with");
    console.log("  your honest scores/decisions, run its qc-submit command, then resume:");
    console.log("no fake pass was written.");
    console.log("rerun or resume:");
    console.log(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass --round ${roundId}`);
    return flags["dry-run"] === true ? 0 : 3;
  }

  // The shared QC round-driver runs the SAME sequence as the autopilot conductor;
  // qc-auto injects IN-PROCESS orchestrator calls (its long-standing behavior, so the
  // output + exit codes below stay byte-for-byte identical) and a NO-OP reviewer
  // spawner (submissions are already on disk, filled by the human between runs).
  const isSubset = !!chapters?.length;
  const attest = flags["no-attest"] !== true && !staleDiagnosticsOnly;
  const { loadBarReadArtifact } = await import("./qc/orchestrator/artifacts.js");
  const { buildQcFinalizationMetric, appendQcFinalizationMetric } = await import("./qc/metrics.js");
  const { driveQcRoundCore } = await import("./qc/auto/driver.js");
  const result = await driveQcRoundCore(
    {
      spawnReviewers: async () => ({}), // human/agent fills submissions between runs — no auto-spawn (matches the prior qc-auto)
      firstWaveCards: () => taskCards,
      // The review work generateConfirmCandidates writes mid-round: confirm cards +
      // bar-tiebreak t2/t3 cards. Inert for qc-auto's no-op spawner (submissionPresent
      // below returns true ⇒ the driver's dynamic-wave loop never spawns), but kept honest
      // to the driver contract — qc-auto instead relies on the human re-running between
      // invocations to fill these, preserving its exact single-pass behavior.
      pendingReviewCards: () => [
        ...listMarkdownFiles(resolve(artifacts.taskCardsDir(bookId, roundId), "confirm")),
        ...listMarkdownFiles(resolve(artifacts.taskCardsDir(bookId, roundId), "bar-tiebreak")),
      ],
      countSubmissions: () => countSubmissionFiles(artifacts.submissionsDir(bookId, roundId)),
      submissionPresent: () => true, // moot: qc-auto runs with narrowRetryOnIncomplete=false + no-op spawner

      collect: () => { const r = orch.collectQcRound(bookId, roundId); return { ok: r.ok, errors: r.errors }; },
      generateConfirmCandidates: () => { const r = orch.generateConfirmCandidates(bookId, roundId, { chapters }); return { ok: r.ok, errors: r.errors }; },
      finalize: () => orch.finalizeQcRound(bookId, roundId, { chapters, attest }),
      ledgerOpenCount: () => orch.ledgerStatus(bookId, roundId).summary.open ?? 0,
      recordMetrics: (finalized) => {
        // Best-effort telemetry — one append-only row per finalization (see `qc-metrics`).
        // A failure here NEVER breaks the QC run.
        try {
          const failingBarAxes: string[] = [];
          for (const d of finalized.chapters) {
            if (d.finalVerdict === "PUBLISHABLE" || (d.checks.barRead !== "YELLOW" && d.checks.barRead !== "RED")) continue;
            const bar = loadBarReadArtifact(bookId, roundId, d.chapterNumber);
            for (const a of bar?.axes ?? []) if (a.tier !== "PUBLISHABLE") failingBarAxes.push(a.axis);
          }
          appendQcFinalizationMetric(buildQcFinalizationMetric({
            bookId, roundId, timestamp: new Date().toISOString(),
            mode: chapters?.length ? "subset" : "full",
            incremental: flags["incremental"] === true,
            tiebreak: flags["tiebreak"] === true,
            decisions: finalized.chapters, failingBarAxes,
          }));
        } catch { /* telemetry is best-effort — never break QC */ }
      },
      // Full-book qc-status verification on a clean pass — skipped on a subset (never a
      // book-level pass) and in stale-diagnostics mode (the stale override fires below).
      verifyFullBook: (isSubset || staleDiagnosticsOnly) ? undefined : async () => (await runQcStatus([bookId])) === 0,
    },
    { isSubset, narrowRetryOnIncomplete: false },
  );

  if (result.outcome === "INCOMPLETE" && result.reason === "collect-failed") {
    for (const e of result.collectErrors) console.error(e);
    console.log(`QC AUTO INCOMPLETE — ${bookId}`);
    console.log(`round: ${roundId}`);
    console.log("missing:");
    console.log("  one or more stored subagent submissions failed validation during collect");
    console.log("no fake pass was written.");
    console.log("rerun or resume:");
    console.log(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass --round ${roundId}`);
    return 3;
  }
  if (result.outcome === "INCOMPLETE" && result.reason === "confirm-failed") {
    for (const e of result.collectErrors) console.error(e);
    console.log(`QC AUTO INCOMPLETE — ${bookId}`);
    console.log(`round: ${roundId}`);
    console.log("missing:");
    console.log("  confirm candidate generation failed");
    console.log("no fake pass was written.");
    return 3;
  }

  // From here a finalize ran (driver guarantees result.finalized is set).
  const finalized = result.finalized!;
  if (result.collectErrors.length) for (const e of result.collectErrors) console.error(e);
  if (finalized.errors.length) for (const e of finalized.errors) console.error(e);

  if (result.outcome === "PASS" || result.outcome === "PASS_SUBSET") {
    if (staleDiagnosticsOnly) {
      console.log(`QC AUTO INCOMPLETE — ${bookId}`);
      console.log(`round: ${roundId}`);
      console.log(`status: STALE_ROUND`);
      console.log("This round is stale after repair. Do not resume this round for publishability.");
      console.log("Start a fresh QC round:");
      console.log(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass`);
      return 3;
    }
    // A subset run verifies only the named chapters; it is NOT a book-level pass.
    // (Keep the literal "QC AUTO PASS" intact — qc-auto-output.test.ts source-scans for it.)
    const passLabel = isSubset ? "QC AUTO PASS (SUBSET)" : "QC AUTO PASS";
    const qcStatusLabel = isSubset ? "selected chapters PASS (subset — book not fully verified)" : "PASS (all chapters fresh + PUBLISHABLE)";
    console.log(`${passLabel} — ${bookId}`);
    console.log(`round: ${roundId}`);
    console.log(`chapters selected: ${finalized.chapters.length}${isSubset ? " (subset)" : " (full book)"}`);
    console.log(`attestations written: ${finalized.attestationsWritten} PUBLISHABLE`);
    console.log(`repair findings: 0 open`);
    console.log(`qc-status: ${qcStatusLabel}`);
    console.log("next:");
    if (isSubset) {
      console.log("  # subset only — run a full-book pass before publishing:");
      console.log(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass`);
    } else {
      console.log(`  npx tsx src/cli.ts qc-status ${bookId}`);
      const titleArg = resolved.title ?? "...";
      console.log(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish-after-qc ${JSON.stringify(bookId)} --round ${roundId} --title ${JSON.stringify(titleArg)} --author "..." --dry-run`);
      console.log("  add --commit --push after checking the dry-run");
    }
    return 0;
  }

  if (result.outcome === "QC_STATUS_FAIL") {
    console.log(`QC AUTO INCOMPLETE — ${bookId}`);
    console.log(`round: ${roundId}`);
    console.log("missing:");
    console.log("  qc-status did not report all chapters as PASS after finalization");
    console.log("no fake pass was written.");
    return 3;
  }

  if (result.outcome === "INCOMPLETE") {
    console.log(`QC AUTO INCOMPLETE — ${bookId}`);
    console.log(`round: ${roundId}`);
    console.log("missing:");
    for (const d of finalized.chapters.filter((ch) => ch.finalVerdict === "NEEDS_MORE_QC")) {
      console.log(`  ch${String(d.chapterNumber).padStart(2, "0")}: ${d.reason}`);
    }
    console.log("no fake pass was written.");
    console.log("rerun or resume:");
    console.log(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass --round ${roundId}`);
    return 3;
  }

  // INTEGRITY / INFRA: NOT content problems — never fall through to REPAIR (which would
  // tell a writer to edit chapters). INTEGRITY can't arise under qc-auto's no-op spawner;
  // INFRA covers a missing role token or a finalize that returned no actionable verdict.
  if (result.outcome === "INTEGRITY" || result.outcome === "INFRA") {
    console.log(`QC AUTO INCOMPLETE — ${bookId}`);
    console.log(`round: ${roundId}`);
    console.log(`status: ${result.outcome}`);
    console.log(`  ${result.reason ?? (result.outcome === "INTEGRITY" ? "a reviewer mutated chapter content (round void)" : "a tool/config error during the round")}`);
    console.log("no fake pass was written; this is NOT a content-repair instruction.");
    return 3;
  }

  // REPAIR
  console.log(`QC AUTO REPAIR REQUIRED — ${bookId}`);
  console.log(`round: ${roundId}`);
  console.log(`PUBLISHABLE attested: ${result.counts.publishable}`);
  console.log(`REVISE attested: ${result.counts.revise}`);
  console.log(`CORRUPTION attested: ${result.counts.corruption}`);
  console.log(`open repair findings: ${result.openRepairFindings}`);
  console.log("repair prompt:");
  console.log(`  ${finalized.repairPromptPath}`);
  console.log("");
  console.log("Paste the repair prompt into a fresh Writer Codex session.");
  console.log("After repair, run:");
  console.log(`  CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass`);
  console.log("If a chapter stays REVISE across rounds on a MAJOR a content edit can't fix, a");
  console.log("reviewer can check whether it's a false positive (it prints the disposition command):");
  console.log(`  npx tsx src/cli.ts qc-diagnose ${JSON.stringify(bookId)} --round ${roundId}`);
  return 1;
}

async function runPublishAfterQc(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const input = args.join(" ").trim();
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!input || !roundId) {
    console.error('Usage: publish-after-qc "<book name or id>" --round <roundId> [--title "..."] [--author "..."] [--commit] [--push] [--cleanup transient|none|audit-unsafe] [--keep-state] [--include-state] [--dry-run]');
    return 2;
  }
  const cleanup = typeof flags["cleanup"] === "string" ? flags["cleanup"] : "transient";
  if (!["transient", "none", "audit-unsafe"].includes(cleanup)) {
    console.error(`--cleanup must be transient, none, or audit-unsafe (got ${JSON.stringify(cleanup)})`);
    return 2;
  }
  const { publishAfterQc, formatPublishAfterQcResult, shouldPrunePostPublish } = await import("./qc/publishAfterQc.js");
  const result = publishAfterQc({
    input,
    roundId,
    title: typeof flags["title"] === "string" ? flags["title"] : undefined,
    author: typeof flags["author"] === "string" ? flags["author"] : undefined,
    commit: flags["commit"] === true,
    push: flags["push"] === true,
    cleanup: cleanup as "transient" | "none" | "audit-unsafe",
    includeState: flags["include-state"] === true,
    dryRun: flags["dry-run"] === true,
  });
  console.log(formatPublishAfterQcResult(result));
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  // End-to-end hygiene parity with the autopilot (autopilot.ts post-publish prune): once the package is
  // COMMITTED + PUSHED, the web app serves ONLY the committed package, so sweep this book's untracked
  // working state (package-only) instead of leaving ~MBs of debris. The autopilot already does this on a
  // hands-off run; this gives the verify-first `publish-after-qc --commit --push` path the same cleanup.
  // Best-effort — a prune failure must NEVER undo a successful publish (the book is already on main); the
  // prune is safe-by-construction (untracked-only, only on a COMMITTED package, book-scoped). Opt out with
  // --keep-state to preserve chapters / QC attestations / plans for a re-publish or inspection.
  if (shouldPrunePostPublish(result, { dryRun: flags["dry-run"] === true, keepState: flags["keep-state"] === true })) {
    try {
      const { pruneBookStatePlan, applyPruneBookState } = await import("./qc/pruneBookState.js");
      const plan = pruneBookStatePlan(result.bookId!, "all");
      if (plan.status === "ok" && plan.remove.length) {
        const r = applyPruneBookState(plan);
        console.log(`post-publish prune (package-only): removed ${r.removed} untracked file(s), freed ~${(r.bytes / (1024 * 1024)).toFixed(1)} MB — only the committed package remains (re-publish needs a regen; pass --keep-state to preserve).`);
      }
    } catch (e) {
      console.warn(`post-publish prune skipped (best-effort): ${(e as Error).message}`);
    }
  }
  if (!result.ok) {
    for (const error of result.errors.slice(1)) console.error(error);
    for (const next of result.next ?? []) if (!next.startsWith("repair prompt:")) console.error(next);
  }
  return result.ok ? 0 : 1;
}

async function runQcLedgerStatus(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!bookId || !roundId) {
    console.error("Usage: qc-ledger-status <bookId> --round <roundId>");
    return 2;
  }
  const { ledgerStatus } = await import("./qc/orchestrator/index.js");
  const result = ledgerStatus(bookId, roundId);
  console.log(`qc-ledger-status: ${bookId} ${roundId}`);
  for (const [status, count] of Object.entries(result.summary).sort()) console.log(`  ${status}: ${count}`);
  console.log(`  total: ${result.findings.length}`);
  return result.findings.some((f) => f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun") ? 1 : 0;
}

async function runQcLedgerRepair(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!bookId || !roundId) {
    console.error("Usage: qc-ledger-repair <bookId> --round <roundId> [--confirm]");
    return 2;
  }
  const { quarantineMalformedLedger } = await import("./qc/orchestrator/ledger.js");
  const result = quarantineMalformedLedger(bookId, roundId, { confirm: flags["confirm"] === true });
  if (result.ok) {
    console.log(`qc-ledger-repair: ${result.issues.length} malformed line(s), ${result.eventsPreserved} valid event(s) preserved`);
    if (result.quarantinePath) console.log(`quarantine: ${result.quarantinePath}`);
    return 0;
  }
  console.error(result.error ?? "repair ledger contains malformed lines");
  for (const issue of result.issues) console.error(`${issue.path}:${issue.lineNumber}: ${issue.message}`);
  console.error("Re-run with --confirm to quarantine corrupt raw lines and rewrite the valid-event ledger.");
  return 1;
}

async function runQcRepairBrief(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!bookId || !roundId) {
    console.error("Usage: qc-repair-brief <bookId> --round <roundId>");
    return 2;
  }
  const { renderRepair } = await import("./qc/orchestrator/index.js");
  const { repairPromptPath } = await import("./qc/orchestrator/artifacts.js");
  console.log(`repair brief: ${renderRepair(bookId, roundId)}`);
  console.log(`repair prompt: ${repairPromptPath(bookId, roundId)}`);
  return 0;
}

async function runQcRepairPrompt(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!bookId || !roundId) {
    console.error("Usage: qc-repair-prompt <bookId> --round <roundId>");
    return 2;
  }
  const { writeRepairPrompt } = await import("./qc/orchestrator/repairBrief.js");
  console.log(`repair prompt: ${writeRepairPrompt(bookId, roundId)}`);
  return 0;
}

/** `qc-metrics [--last N] [--json]` — aggregate the quality telemetry (state/metrics/
 *  qc-finalizations.jsonl, one row per qc-auto finalization): first-pass publishable rate,
 *  average rounds to a clean pass, top failing bar axis, top deterministic blocker. Read-only. */
async function runQcMetrics(flags: Record<string, string | boolean>): Promise<number> {
  const lastN = typeof flags["last"] === "string" ? Math.max(1, parseInt(flags["last"] as string, 10) || 10) : 10;
  const { loadQcFinalizationMetrics, aggregateQcMetrics, formatQcMetrics } = await import("./qc/metrics.js");
  const records = loadQcFinalizationMetrics();
  const summary = aggregateQcMetrics(records, lastN);
  if (flags["json"] === true) console.log(JSON.stringify(summary, null, 2));
  else console.log(formatQcMetrics(summary, lastN));
  return 0;
}

async function runQcDiagnose(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const input = args.join(" ").trim();
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!input || !roundId) {
    console.error("Usage: qc-diagnose <bookId|title> --round <roundId>");
    return 2;
  }
  // Resolve a title to its bookId; otherwise renderQcDiagnose throws "Missing
  // evidence matrix" on the un-normalized path.
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  if (resolved.ok === false) console.log(`note: could not resolve "${input}" to a known book — using raw id "${bookId}".`);
  const { renderQcDiagnose } = await import("./qc/orchestrator/diagnose.js");
  try {
    console.log(renderQcDiagnose(bookId, roundId));
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
}

async function runSourceV2Gate(args: string[], flags: Record<string, string | boolean> = {}): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: source-v2-gate <bookId> [--prewrite]");
    return 2;
  }
  const { checkSourceV2Gate, checkSourceV2PrewriteGate, formatSourceV2GateReport } = await import("./qc/sourceV2Gate.js");
  const prewrite = flags["prewrite"] === true || flags["strict-realness"] === true || flags["authoring-readiness"] === true;
  const report = prewrite ? checkSourceV2PrewriteGate(bookId) : checkSourceV2Gate(bookId);
  console.log(formatSourceV2GateReport(report));
  if (prewrite && !report.passed) {
    console.error("source-v2-gate --prewrite blocks writer fanout until thin/unsupported real-world examples are repaired in research sidecars.");
  }
  return report.passed ? 0 : 1;
}

/** `qc-converge <bookId>` — the deterministic-convergence preflight. Runs the full
 *  deterministic battery (the SAME six gates finalize uses, via the shared
 *  evaluator) over the book WITHOUT opening a formal QC round, and reports
 *  DETERMINISTIC-CLEAN / DIRTY. The operator loops it after each repair until CLEAN,
 *  then spends ONE formal round on the irreducibly-semantic layer — ending the
 *  stale-round treadmill where each mechanical nit cost a full 15-36 submission
 *  round. Read-only: writes no round/ledger/attestation state. */
async function runQcConverge(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: qc-converge <bookId> [--chapters 1,2] [--json] [--out <path>]");
    return 2;
  }
  const { loadBookChapters } = await import("./qc/manualKeyJudge.js");
  const { parseChapterList } = await import("./qc/orchestrator/index.js");
  const { evaluateDeterministic, renderConvergeReport, convergeReportJson } = await import("./qc/orchestrator/deterministicGate.js");
  const all = loadBookChapters(bookId);
  if (all.length === 0) {
    console.error(`qc-converge: no chapters on disk for ${bookId} (looked in state/chapters/).`);
    return 2;
  }
  const sel = parseChapterList(flags["chapters"]);
  const chapters = sel && sel.length ? all.filter((ch) => sel.includes(ch.number)) : all;
  if (chapters.length === 0) {
    console.error(`qc-converge: --chapters selected none of ${bookId}'s ${all.length} chapters.`);
    return 2;
  }
  const report = evaluateDeterministic(bookId, chapters, all);
  if (flags["json"] === true) {
    console.log(JSON.stringify(convergeReportJson(report), null, 2));
    return report.clean ? 0 : 1;
  }
  const text = renderConvergeReport(report);
  console.log(text);
  if (typeof flags["out"] === "string" && flags["out"]) {
    writeFileSync(flags["out"], text, "utf8");
    console.log(`(written to ${flags["out"]})`);
  }
  return report.clean ? 0 : 1;
}

/** `book-autopilot <bookId>` — the end-to-end conductor. Runs research → write →
 *  gate → QC(+≤3 repair) → ready-to-publish by spawning `codex exec` agentic
 *  sub-sessions for the WORK while deterministic code owns every DECISION. On QC
 *  convergence it AUTO-PUBLISHES by default (the full promote gate, then commit +
 *  push the package to main — NOT a live deploy); pass --no-publish to halt at
 *  ready-to-publish for review. Runs entirely on the Codex subscription — no API
 *  metering. `--plan` previews the spawn plan. */
async function runBookAutopilot(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: book-autopilot <bookId> [--plan] [--no-publish] [--max-repair N] [--max-parallel N]");
    return 2;
  }
  const { runAutopilot, formatOutcome, architectureFromFlags } = await import("./orchestrator/autopilot.js");
  const maxRepair = typeof flags["max-repair"] === "string" ? parseInt(flags["max-repair"], 10) : undefined;
  const maxParallel = typeof flags["max-parallel"] === "string" ? parseInt(flags["max-parallel"], 10) : undefined;
  const outcome = await runAutopilot({
    bookId,
    plan: flags["plan"] === true,
    // Auto-publish ON by default; --no-publish (in any form) halts for review. Presence-
    // check, not `!== true`, so a parser that binds a following token as the flag's value
    // can't make the opt-out fail OPEN.
    autoPublish: !("no-publish" in flags),
    regen: "regen" in flags,
    // --author = v24 author arch; --legacy keeps meaning legacy; default stays compiler.
    architecture: architectureFromFlags(flags),
    maxRepairRounds: Number.isInteger(maxRepair) ? maxRepair : undefined,
    maxParallel: Number.isInteger(maxParallel) ? maxParallel : undefined,
  });
  console.log(formatOutcome(outcome));
  return outcome.status === "halt" ? 1 : 0;
}

async function runCompileSourcePackets(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: compile-source-packets <bookId>"); return 2; }
  const { compileSourcePackets } = await import("./compiler/sourcePacket.js");
  const result = compileSourcePackets(bookId);
  for (const p of result.written) console.log(`wrote ${p}`);
  if (result.findings.length) {
    console.error(result.findings.join("\n"));
    return 1;
  }
  console.log(`compile-source-packets: PASS (${result.written.length} packet(s))`);
  return 0;
}

async function runSourcePacketGate(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: source-packet-gate <bookId>"); return 2; }
  const { checkSourcePacketGate, formatSourcePacketGateReport } = await import("./compiler/sourcePacketGate.js");
  const report = checkSourcePacketGate(bookId);
  console.log(formatSourcePacketGateReport(report));
  return report.passed ? 0 : 1;
}

async function runCompileBlueprints(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: compile-blueprints <bookId>"); return 2; }
  const { compileBlueprints } = await import("./compiler/chapterBlueprint.js");
  const result = compileBlueprints(bookId);
  for (const p of result.written) console.log(`wrote ${p}`);
  if (result.findings.length) {
    console.error(result.findings.join("\n"));
    return 1;
  }
  console.log(`compile-blueprints: PASS (${result.written.length} blueprint(s))`);
  return 0;
}

async function runBlueprintGate(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: blueprint-gate <bookId>"); return 2; }
  const { checkBlueprintGate, formatBlueprintGateReport } = await import("./compiler/blueprintGate.js");
  const report = checkBlueprintGate(bookId);
  console.log(formatBlueprintGateReport(report));
  return report.passed ? 0 : 1;
}

async function runCompileBookDesign(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: compile-book-design <bookId>"); return 2; }
  const { compileBookDesign } = await import("./compiler/bookDesign.js");
  const result = compileBookDesign(bookId);
  if (result.written) console.log(`wrote ${result.written}`);
  if (result.findings.length) {
    console.error(result.findings.join("\n"));
    return 1;
  }
  console.log(`compile-book-design: PASS`);
  return 0;
}

async function runBookDesignGate(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: book-design-gate <bookId>"); return 2; }
  const { checkBookDesignGate, formatBookDesignGateReport } = await import("./compiler/bookDesign.js");
  const report = checkBookDesignGate(bookId);
  console.log(formatBookDesignGateReport(report));
  return report.passed ? 0 : 1;
}

async function runCompileChapterBriefs(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: compile-chapter-briefs <bookId>"); return 2; }
  const { writeChapterBriefs } = await import("./compiler/chapterBrief.js");
  const result = writeChapterBriefs(bookId);
  for (const p of result.written) console.log(`wrote ${p}`);
  if (result.findings.length) {
    console.error(result.findings.join("\n"));
    return 1;
  }
  console.log(`compile-chapter-briefs: PASS (${result.written.length} file(s))`);
  return 0;
}

async function runChapterBriefGate(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: chapter-brief-gate <bookId>"); return 2; }
  const { validateChapterBriefs, formatChapterBriefGateReport } = await import("./compiler/chapterBrief.js");
  const report = validateChapterBriefs(bookId);
  console.log(formatChapterBriefGateReport(report));
  return report.passed ? 0 : 1;
}

async function runDealSectionTasks(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: deal-section-tasks <bookId>"); return 2; }
  const { dealSectionTasks } = await import("./sections/sectionTasks.js");
  const tasks = dealSectionTasks(bookId);
  for (const t of tasks) console.log(`${t.exists ? "output-ready" : "needs-output"} ${t.kind} ch${String(t.chapterNumber).padStart(2, "0")}: task=${t.taskPath}`);
  console.log(`deal-section-tasks: PASS (${tasks.length} task card(s))`);
  return 0;
}

function parseNumberListFlag(value: string | boolean | undefined): number[] | undefined {
  if (value === undefined || value === true) return undefined;
  const nums = String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!m) return [Number.parseInt(part, 10)];
      const a = Number.parseInt(m[1], 10);
      const b = Number.parseInt(m[2], 10);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return [NaN];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    });
  return nums.length ? [...new Set(nums)] : undefined;
}

async function runValidateSections(args: string[], flags: Record<string, string | boolean> = {}): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: validate-sections <bookId> [--chapters N[,M|N-M]] [--section summary-pack|example-pack|learning-pack|action-pack]"); return 2; }
  const chapters = parseNumberListFlag(flags.chapters ?? flags.chapter);
  if (chapters?.some((n) => !Number.isInteger(n) || n <= 0)) {
    console.error("validate-sections: --chapters must be a positive chapter number, comma list, or range");
    return 2;
  }
  const sections = typeof flags.section === "string" ? [flags.section as any] : typeof flags.sections === "string" ? String(flags.sections).split(",").map((s) => s.trim()).filter(Boolean) as any[] : undefined;
  const { checkSectionGate, formatSectionGateReport } = await import("./sections/sectionGate.js");
  const report = checkSectionGate(bookId, {}, { chapters, sections });
  console.log(formatSectionGateReport(report));
  return report.passed ? 0 : 1;
}

async function runAssembleSections(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: assemble-sections <bookId>"); return 2; }
  const { assembleSections } = await import("./sections/assembleSections.js");
  const result = assembleSections(bookId);
  for (const p of result.written) console.log(`wrote ${p}`);
  if (result.findings.length) {
    console.error(result.findings.join("\n"));
    return 1;
  }
  console.log(`assemble-sections: PASS (${result.written.length} chapter(s))`);
  return 0;
}

async function runBuildEvidenceMaps(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: build-evidence-maps <bookId>"); return 2; }
  const { buildEvidenceMaps } = await import("./evidence/evidenceMap.js");
  const result = buildEvidenceMaps(bookId);
  for (const p of result.written) console.log(`wrote ${p}`);
  if (result.findings.length) {
    console.error(result.findings.join("\n"));
    return 1;
  }
  console.log(`build-evidence-maps: PASS (${result.written.length} map(s))`);
  return 0;
}

async function runEvidenceGate(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: evidence-gate <bookId>"); return 2; }
  const { checkEvidenceGate, formatEvidenceGateReport } = await import("./evidence/evidenceGate.js");
  const report = checkEvidenceGate(bookId);
  console.log(formatEvidenceGateReport(report));
  return report.passed ? 0 : 1;
}

async function runRiskScore(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: risk-score <bookId>"); return 2; }
  const { computeBookRisk, formatBookRisk } = await import("./risk/chapterRisk.js");
  const result = computeBookRisk(bookId);
  console.log(formatBookRisk(result.report));
  if (result.findings.length) {
    console.error(result.findings.join("\n"));
    return 1;
  }
  return 0;
}

/** `rubric-metrics <bookId> [--json] [--gate]` — deterministic rubric pre-flight
 *  over the ASSEMBLED chapters (P04). Prints a per-chapter table + book summary
 *  (or JSON with --json), and always writes state/books/<bookId>.rubric-metrics.json.
 *  --gate exits 1 when any chapter is `fail` (used by the enforce-mode wiring);
 *  without --gate it is a report (exit 0) — the DEFAULT everywhere. */
async function runRubricMetrics(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  if (!bookId) { console.error("Usage: rubric-metrics <bookId> [--json] [--gate]"); return 2; }
  const { computeBookRubricMetrics, formatRubricMetrics } = await import("./metrics/bookRubricMetrics.js");
  const { rubricMetricsPath, writeJsonFile } = await import("./artifacts/artifactStore.js");
  let report;
  try {
    report = computeBookRubricMetrics(bookId);
  } catch (err) {
    console.error(`rubric-metrics: ${(err as Error).message}`);
    return 2;
  }
  writeJsonFile(rubricMetricsPath(bookId), report);
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatRubricMetrics(report));
  if (flags.gate && report.chapters.some((c) => c.verdict === "fail")) return 1;
  return 0;
}

/** `reader-budget-check <bookId> [--rep-cap N] [--length N] [--tolerance F] [--package <path>] [--json]`
 *  — v24 B3: run the five deterministic reader-correlated checks (CHB1–CHB5,
 *  src/critics/readerBudgets.ts) over a book's chapters. Chapters come from
 *  state/chapters/ when present, else book-packages/<id>.v21.json, else an
 *  explicit --package path. Compiled source packets are loaded READ-ONLY when
 *  the book has a compiler run (no ensureCompilerRun — a reporting verb must
 *  not create state). Exits 1 on any blocker finding; standalone by design —
 *  nothing in the existing gate chain calls this. */
async function runReaderBudgetCheck(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0] ?? "";
  const packagePath = typeof flags["package"] === "string" ? String(flags["package"]) : "";
  if (!bookId && !packagePath) {
    console.error("Usage: reader-budget-check <bookId> [--rep-cap N] [--length N] [--tolerance F] [--package <path>] [--json]");
    return 2;
  }
  const { checkReaderBudgets, formatBudgetFindings, DEFAULT_LENGTH_BUDGET } = await import("./critics/readerBudgets.js");
  const { compilerRunRoot } = await import("./artifacts/artifactStore.js");
  const { loadBookChapters } = await import("./qc/manualKeyJudge.js");
  type PacketMap = NonNullable<Parameters<typeof checkReaderBudgets>[1]>["packets"];

  // ── chapters: state/chapters first, then package fallback ──
  let chapters: ChapterV21[] = [];
  let chapterSource = "";
  if (packagePath) {
    try {
      chapters = (JSON.parse(readFileSync(packagePath, "utf8")) as BookPackageV21).chapters ?? [];
      chapterSource = packagePath;
    } catch (err) {
      console.error(`reader-budget-check: unreadable package at ${packagePath}: ${(err as Error).message}`);
      return 2;
    }
  } else {
    try {
      chapters = loadBookChapters(bookId);
      chapterSource = "state/chapters";
    } catch {
      chapters = [];
    }
    if (chapters.length === 0) {
      const fallback = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
      if (existsSyncFs(fallback)) {
        try {
          chapters = (JSON.parse(readFileSync(fallback, "utf8")) as BookPackageV21).chapters ?? [];
          chapterSource = fallback;
        } catch (err) {
          console.error(`reader-budget-check: unreadable package at ${fallback}: ${(err as Error).message}`);
          return 2;
        }
      }
    }
  }
  if (chapters.length === 0) {
    console.error(`reader-budget-check: no chapters found for "${bookId}" (state/chapters empty, no book-packages/${bookId}.v21.json; pass --package <path>)`);
    return 2;
  }

  // ── packets, when the book has a compiler run (read-only probe) ──
  let packets: PacketMap;
  if (bookId) {
    try {
      const packetsDir = resolve(compilerRunRoot(bookId), "source-packets");
      if (existsSyncFs(packetsDir)) {
        const map = new Map<number, SourcePacketV1>();
        for (const file of readdirSync(packetsDir).filter((f) => f.endsWith(".source-packet.json"))) {
          try {
            const packet = JSON.parse(readFileSync(resolve(packetsDir, file), "utf8")) as SourcePacketV1;
            if (typeof packet?.chapterNumber === "number") map.set(packet.chapterNumber, packet);
          } catch {
            console.warn(`reader-budget-check: skipping unreadable packet ${file}`);
          }
        }
        if (map.size > 0) packets = map;
      }
    } catch {
      packets = undefined; // no compiler run — title-fallback path (CHB1 advisory)
    }
  }

  const repCap = typeof flags["rep-cap"] === "string" ? parseInt(String(flags["rep-cap"]), 10) : undefined;
  const renderedChars = typeof flags["length"] === "string" ? parseInt(String(flags["length"]), 10) : undefined;
  const tolerance = typeof flags["tolerance"] === "string" ? parseFloat(String(flags["tolerance"])) : undefined;
  if (repCap !== undefined && !(Number.isFinite(repCap) && repCap > 0)) { console.error("reader-budget-check: --rep-cap must be a positive integer"); return 2; }
  if (renderedChars !== undefined && !(Number.isFinite(renderedChars) && renderedChars > 0)) { console.error("reader-budget-check: --length must be a positive integer"); return 2; }
  if (tolerance !== undefined && !(Number.isFinite(tolerance) && tolerance > 0 && tolerance < 1)) { console.error("reader-budget-check: --tolerance must be in (0,1)"); return 2; }

  const findings = checkReaderBudgets(chapters, {
    ...(packets ? { packets } : {}),
    ...(repCap !== undefined ? { repCap } : {}),
    ...(renderedChars !== undefined || tolerance !== undefined
      ? { lengthBudget: { renderedChars: renderedChars ?? DEFAULT_LENGTH_BUDGET.renderedChars, tolerance: tolerance ?? DEFAULT_LENGTH_BUDGET.tolerance } }
      : {}),
  });
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  if (flags.json) {
    console.log(JSON.stringify({ bookId: bookId || null, chapterSource, chapters: chapters.length, packets: packets ? packets.size : 0, blockers, findings }, null, 2));
  } else {
    console.log(`reader-budget-check: ${chapters.length} chapter(s) from ${chapterSource}${packets ? `, ${packets.size} source packet(s)` : ", no source packets (CHB1 advisory-only)"}`);
    console.log(formatBudgetFindings(findings));
  }
  return blockers > 0 ? 1 : 0;
}

/** `codex-agent-run <task-file>` — debug verb: spawn ONE headless codex agent with
 *  a task file as its instruction and print the result. Proves `codex exec` works
 *  in-environment before relying on the autopilot. Needs a real codex binary. */
async function runCodexAgentRun(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const taskFile = args[0] ?? (typeof flags["task-file"] === "string" ? flags["task-file"] : "");
  if (!taskFile) {
    console.error("Usage: codex-agent-run <task-file> [--session <id>] [--sandbox read-only|workspace-write] [--timeout-ms N]");
    return 2;
  }
  const { spawnCodexAgent, codexAvailable } = await import("./orchestrator/codexAgent.js");
  if (!codexAvailable()) {
    console.error("codex binary not found. Install codex or set CHAPTERFLOW_CODEX_BIN (this debug verb needs a real codex).");
    return 2;
  }
  const task = readFileSync(taskFile, "utf8");
  const sessionId = typeof flags["session"] === "string" ? flags["session"] : `debug-${Date.now().toString(36)}`;
  const sandbox = (typeof flags["sandbox"] === "string" ? flags["sandbox"] : "workspace-write") as "read-only" | "workspace-write" | "danger-full-access";
  const timeoutMs = typeof flags["timeout-ms"] === "string" ? parseInt(flags["timeout-ms"], 10) : undefined;
  const r = await spawnCodexAgent({ task, sessionId, cwd: process.cwd(), sandbox, timeoutMs });
  console.log(`codex-agent-run: exit ${r.exitCode} (${r.durationMs}ms), session ${r.sessionId}`);
  console.log(`--- final message ---\n${r.finalMessage}`);
  if (!r.ok && r.stderr) console.error(r.stderr.slice(0, 1000));
  return r.ok ? 0 : 1;
}

async function runKeyPack(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!bookId || !roundId) {
    console.error("Usage: key-pack <bookId> --round <roundId>");
    return 2;
  }
  try {
    const { writeKeyPacks } = await import("./qc/manualKeyJudge.js");
    const paths = writeKeyPacks(bookId, roundId);
    console.log(`key-pack: wrote ${paths.length} pack(s)`);
    for (const p of paths) console.log(`  ${p}`);
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
}

async function runKeyDerive(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  const role = typeof flags["role"] === "string" ? flags["role"] : "";
  const token = typeof flags["token"] === "string" ? flags["token"] : "";
  const answersFile = typeof flags["answers-file"] === "string" ? flags["answers-file"] : "";
  if (!bookId || !roundId || !["keyA", "keyB"].includes(role) || !token || !answersFile) {
    console.error("Usage: key-derive <bookId> --round <roundId> --role keyA|keyB --token <token> --answers-file <path>");
    return 2;
  }
  const { validateAndWriteKeyDerivation } = await import("./qc/manualKeyJudge.js");
  const result = validateAndWriteKeyDerivation(bookId, roundId, role as "keyA" | "keyB", token, answersFile);
  if (result.errors.length > 0) {
    console.error(`key-derive: BLOCK (${result.errors.length} error(s))`);
    for (const e of result.errors) console.error(`  ${e}`);
    return 1;
  }
  console.log(`key-derive: wrote ${result.path}`);
  return 0;
}

async function runKeyResolve(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!bookId || !roundId) {
    console.error("Usage: key-resolve <bookId> --round <roundId>");
    return 2;
  }
  const { resolveManualKeyJudges } = await import("./qc/manualKeyJudge.js");
  const result = resolveManualKeyJudges(bookId, roundId);
  console.log(`key-resolve: wrote ${result.records.length} manual-keyjudge record(s)`);
  for (const rec of result.records) console.log(`  ch${String(rec.chapterNumber).padStart(2, "0")}: ${rec.status} — ${rec.reason}`);
  return result.errors.length === 0 ? 0 : 1;
}

async function runBarPack(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!bookId || !roundId) {
    console.error("Usage: bar-pack <bookId> --round <roundId>");
    return 2;
  }
  const { writeBarPack } = await import("./qc/barReview.js");
  const result = writeBarPack(bookId, roundId);
  if (result.errors.length > 0) {
    console.error(`bar-pack: BLOCK (${result.errors.length} error(s))`);
    for (const e of result.errors) console.error(`  ${e}`);
    return 1;
  }
  console.log(`bar-pack: wrote ${result.packPath}`);
  console.log(`bar-pack: wrote scores template ${result.templatePath}`);
  return 0;
}

async function runBarAttest(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  const token = typeof flags["token"] === "string" ? flags["token"] : "";
  const scoresFile = typeof flags["scores-file"] === "string" ? flags["scores-file"] : "";
  const reviewer = typeof flags["reviewer"] === "string" ? flags["reviewer"] : "";
  const dryRun = flags["dry-run"] === true;
  if (!bookId || !roundId || !token || !scoresFile || !reviewer) {
    console.error("Usage: bar-attest <bookId> --round <roundId> --token <bar|attest|confirm token> --scores-file <path> --reviewer <id> [--dry-run]");
    return 2;
  }
  const { validateAndWriteBarAttestations } = await import("./qc/barReview.js");
  const result = validateAndWriteBarAttestations(bookId, roundId, token, reviewer, scoresFile, { dryRun });
  for (const rec of result.results) {
    console.log(`  ch${String(rec.chapterNumber).padStart(2, "0")}: ${rec.gate} ${rec.overall}/100 -> ${rec.verdict}${rec.path ? ` (${rec.path})` : ""}`);
  }
  if (result.errors.length > 0) {
    console.error(`bar-attest: BLOCK (${result.errors.length} error(s))`);
    for (const e of result.errors) console.error(`  ${e}`);
    return 1;
  }
  console.log(dryRun ? "bar-attest: dry-run PASS (no attestations written)" : `bar-attest: wrote ${result.wrote} qc attestation(s) with role=${result.role}`);
  return 0;
}

async function runSweepPack(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  if (!bookId || !roundId) {
    console.error("Usage: sweep-pack <bookId> --round <roundId>");
    return 2;
  }
  const { writeSweepPack } = await import("./qc/sweep.js");
  const path = writeSweepPack(bookId, roundId);
  console.log(`sweep-pack: wrote ${path}`);
  return 0;
}

async function runSweepAttest(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  const token = typeof flags["token"] === "string" ? flags["token"] : "";
  const reviewer = typeof flags["reviewer"] === "string" ? flags["reviewer"] : "";
  const verdict = typeof flags["verdict"] === "string" ? flags["verdict"].toUpperCase() : "";
  const findingsFile = typeof flags["findings-file"] === "string" ? flags["findings-file"] : "";
  const notes = typeof flags["notes"] === "string" ? flags["notes"] : undefined;
  if (!bookId || !roundId || !token || !reviewer || !findingsFile || !["PASS", "REVISE", "CORRUPTION"].includes(verdict)) {
    console.error("Usage: sweep-attest <bookId> --round <roundId> --token <token> --verdict PASS|REVISE|CORRUPTION --reviewer <id> --findings-file <path> [--notes X]");
    return 2;
  }
  const { writeSweepAttestation } = await import("./qc/sweep.js");
  const result = writeSweepAttestation(bookId, roundId, token, verdict as any, reviewer, findingsFile, notes);
  if (result.error) {
    console.error(result.error);
    return 1;
  }
  console.log(`sweep-attest: wrote ${result.path}`);
  return 0;
}

async function runSweepStatus(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: sweep-status <bookId>");
    return 2;
  }
  const { formatSweepStatus, checkSweep } = await import("./qc/sweep.js");
  const { loadBookChapters } = await import("./qc/manualKeyJudge.js");
  console.log(formatSweepStatus(bookId));
  const findings = checkSweep(loadBookChapters(bookId), true);
  for (const f of findings) console.log(`  [${f.checkId}] ${f.message}`);
  return findings.length === 0 ? 0 : 1;
}

async function runMajorStatus(args: string[]): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: major-status <bookId>");
    return 2;
  }
  const { formatMajorStatus, unresolvedMajors } = await import("./qc/majorDisposition.js");
  console.log(formatMajorStatus(bookId));
  return unresolvedMajors(bookId).length === 0 ? 0 : 1;
}

async function runMajorDisposition(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookId = args[0];
  const findingId = typeof flags["finding"] === "string" ? flags["finding"] : "";
  const status = typeof flags["status"] === "string" ? flags["status"] : "";
  const reason = typeof flags["reason"] === "string" ? flags["reason"] : "";
  const reviewer = typeof flags["reviewer"] === "string" ? flags["reviewer"] : "";
  const roundId = typeof flags["round"] === "string" ? flags["round"] : "";
  const token = typeof flags["token"] === "string" ? flags["token"] : "";
  const validStatuses = ["open", "waived_false_positive", "waived_accepted_debt"] as const;
  if (!bookId || !findingId || !(validStatuses as readonly string[]).includes(status) || !reason || !reviewer || !roundId) {
    console.error("Usage: major-disposition <bookId> --finding <id> --status open|waived_false_positive|waived_accepted_debt --reason <text> --reviewer <id> --round <roundId> [--token <major-token>]");
    return 2;
  }
  // A waiver must be signed by an approved QC role (not the writer). This stops
  // a major from being silently waived to PUBLISHABLE under an arbitrary
  // reviewer string. Override the allowed roles with CHAPTERFLOW_QC_REVIEWERS.
  const { isApprovedReviewer, approvedReviewerRoles } = await import("./critics/qcAttestation.js");
  if (!isApprovedReviewer(reviewer)) {
    console.error(`--reviewer "${reviewer}" is not an approved QC role (${approvedReviewerRoles().join(", ")}). Use e.g. "codex-qc:<id>" or "human:<id>".`);
    return 2;
  }
  let roundRole: "major" | "confirm" | undefined;
  const { isNoApiCodexQcMode } = await import("./qc/noApiMode.js");
  if (isNoApiCodexQcMode() || token) {
    const { identifyQcRoundRole } = await import("./qc/qcRound.js");
    const identified = identifyQcRoundRole(bookId, roundId, token, ["major", "confirm"]);
    if (identified !== "major" && identified !== "confirm") {
      console.error(`Invalid major token for ${bookId} round ${roundId}.`);
      return 1;
    }
    roundRole = identified;
  }
  const { currentMajorFindings, writeDisposition } = await import("./qc/majorDisposition.js");
  if (!currentMajorFindings(bookId).some((f) => f.id === findingId)) {
    console.error(`Finding id ${findingId} is not a current major for ${bookId}. Run major-status ${bookId} and use one of the listed ids.`);
    return 1;
  }
  const path = writeDisposition(bookId, {
    findingId,
    status: status as typeof validStatuses[number],
    reason,
    reviewer,
    roundId,
    roundRole,
    timestamp: new Date().toISOString(),
  });
  console.log(`major-disposition: wrote ${path}`);
  return 0;
}

/** `qc-attest <chapter.json> --verdict PUBLISHABLE|REVISE|CORRUPTION --reviewer <id>
 *  [--notes "..."] [--dimensions key=true,key=false]` — record a Claude reviewer's
 *  semantic verdict for a chapter, stamped with the chapter's current content hash.
 *  promote requires a fresh PUBLISHABLE attestation per chapter (the no-API
 *  semantic gate); editing the chapter afterward makes it stale. */
async function runQcAttest(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const file = args[0];
  const verdict = typeof flags["verdict"] === "string" ? (flags["verdict"] as string).toUpperCase() : "";
  const reviewer = typeof flags["reviewer"] === "string" ? (flags["reviewer"] as string) : "";
  const roundId = typeof flags["round"] === "string" ? (flags["round"] as string) : "";
  const token = typeof flags["token"] === "string" ? (flags["token"] as string) : "";
  if (!file || !["PUBLISHABLE", "REVISE", "CORRUPTION"].includes(verdict) || !reviewer) {
    console.error(`Usage: qc-attest <chapter.json> --verdict PUBLISHABLE|REVISE|CORRUPTION --reviewer <id> [--round <roundId> --token <token>] [--notes "..."] [--dimensions k=true,k2=false] [--supersede "<reason>"]`);
    return 2;
  }
  const chapter = JSON.parse(readFileSync(resolve(file), "utf8")) as ChapterV21;
  const parsed = chapter.chapterId ? parseChapterId(chapter.chapterId) : null;
  if (!parsed) {
    console.error(`Could not parse chapterId "${chapter.chapterId}" — cannot attest.`);
    return 2;
  }
  const { isNoApiCodexQcMode } = await import("./qc/noApiMode.js");
  let roundRole: "bar" | "confirm" | "attest" | undefined;
  if (isNoApiCodexQcMode() || roundId || token) {
    if (!roundId || !token) {
      console.error("CHAPTERFLOW_NO_API_CODEX_QC=1 requires qc-attest --round <roundId> --token <bar|confirm|attest token>.");
      return 2;
    }
    const { identifyQcRoundRole } = await import("./qc/qcRound.js");
    const role = identifyQcRoundRole(parsed.bookId, roundId, token, ["bar", "confirm", "attest"]);
    if (!role) {
      console.error(`Invalid qc-attest token for ${parsed.bookId} round ${roundId}; expected a bar, confirm, or attest token.`);
      return 1;
    }
    roundRole = role as "bar" | "confirm" | "attest";
  }
  const { chapterContentHash, writeAttestation, loadAttestation, isAttestationFresh } =
    await import("./critics/qcAttestation.js");
  const dimensions: Record<string, boolean> = {};
  for (const kv of parseCsvFlag(flags["dimensions"]) ?? []) {
    const [k, v] = kv.split("=");
    if (k) dimensions[k.trim()] = (v ?? "").trim().toLowerCase() === "true";
  }
  const notes = typeof flags["notes"] === "string" ? (flags["notes"] as string) : undefined;
  const findings = parseCsvFlag(flags["findings"]) ?? undefined;
  const supersede = typeof flags["supersede"] === "string" ? (flags["supersede"] as string) : null;

  // Self-attest replay guard. The verified failure mode (rich-dad redo loop):
  // a reviewer records REVISE, the AUTHORING agent re-runs qc-attest with
  // verdict PUBLISHABLE on the UNCHANGED chapter, silently overwriting the
  // human verdict. A PUBLISHABLE flip over a non-PUBLISHABLE attestation is
  // only legitimate when the content actually changed since that review
  // (hash differs → the redo loop worked). Same content → refuse, unless
  // --supersede "<reason>" records an explicit, auditable override.
  const existing = loadAttestation(parsed.bookId, chapter.number);
  if (
    existing &&
    existing.verdict !== "PUBLISHABLE" &&
    verdict === "PUBLISHABLE" &&
    isAttestationFresh(existing, chapter) &&
    !supersede
  ) {
    console.error(
      `REFUSED: ${parsed.bookId}-ch${chapter.number} carries a ${existing.verdict} verdict ` +
        `(reviewer=${existing.reviewer}, ${existing.reviewedAt.slice(0, 10)}) and the chapter is UNCHANGED ` +
        `since that review. Flipping to PUBLISHABLE without changing the content is the self-attest ` +
        `replay this gate exists to stop. Fix the chapter (the hash will change), or — if the ` +
        `${existing.verdict} was itself wrong — re-run with --supersede "<why the prior verdict was wrong>".`,
    );
    return 1;
  }
  if (existing) {
    console.log(
      `Overwriting prior attestation (verdict=${existing.verdict}, reviewer=${existing.reviewer}, ` +
        `${existing.reviewedAt.slice(0, 10)}) — it is preserved in the attestation's history.`,
    );
  }
  const { history: _prevHistory, ...existingSansHistory } = existing ?? {};
  const path = writeAttestation({
    schemaVersion: "qc-attest-v1",
    bookId: parsed.bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId!,
    verdict: verdict as "PUBLISHABLE" | "REVISE" | "CORRUPTION",
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer,
    reviewedAt: new Date().toISOString(),
    roundId: roundId || undefined,
    roundRole,
    dimensions: Object.keys(dimensions).length ? dimensions : undefined,
    findings,
    notes,
    history: existing
      ? [...(existing.history ?? []), existingSansHistory as any].slice(-10)
      : undefined,
    supersededReason: supersede ?? undefined,
  });
  console.log(`QC attestation written: ${path}\n  ${parsed.bookId}-ch${chapter.number}  verdict=${verdict}  hash=${chapterContentHash(chapter)} (v2)  reviewer=${reviewer}${roundId ? `  round=${roundId} role=${roundRole}` : ""}`);
  return 0;
}

/** `qc-rehash [--all | <bookId>]` — one-time migration: upgrade v1-hash
 *  attestations to v2 WHERE THE CONTENT IS UNCHANGED since review (v1 hash
 *  still matches the chapter on disk). A v1 attestation that no longer
 *  matches is already stale and is left alone — it needs re-review, not a
 *  re-pin. The prior record is preserved in the attestation's history. */
/** `qc-verdict <chapterId> --scores '<json>' | --scores-file <path>` — reduce
 *  per-axis scores to a verdict through the REAL computeVerdict, so ANY QC
 *  reader (Claude session, Codex session) gets the same mechanical reduction:
 *  the corruption veto and the 85/0.6 floors cannot be fudged by the reader.
 *  scores JSON: [{ axis, score, tier?, hits? }] — tier defaults to
 *  PUBLISHABLE, hits to []. Exit 0=GREEN, 1=YELLOW, 2=RED, 3=input error. */
async function runQcVerdict(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const chapterId = args[0];
  if (!chapterId) {
    console.error("Usage: qc-verdict <chapterId> --scores '<json>' | --scores-file <path>");
    return 3;
  }
  let raw = typeof flags["scores"] === "string" ? (flags["scores"] as string) : "";
  const fromFile = typeof flags["scores-file"] === "string" ? (flags["scores-file"] as string) : "";
  if (!raw && fromFile) {
    try {
      raw = readFileSync(resolve(fromFile), "utf8");
    } catch (err) {
      console.error(`scores file unreadable: ${(err as Error).message}`);
      return 3;
    }
  }
  if (!raw) {
    console.error("Provide --scores '<json>' or --scores-file <path>.");
    return 3;
  }
  const { computeVerdict, AXIS_WEIGHTS, formatVerdict } = await import("./critics/semantic/publishableBar.js");
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`scores JSON invalid: ${(err as Error).message}`);
    return 3;
  }
  if (!Array.isArray(parsed)) {
    console.error("scores must be a JSON array of { axis, score, tier?, hits? }.");
    return 3;
  }
  const known = new Set(Object.keys(AXIS_WEIGHTS));
  const axes: AxisScore[] = [];
  for (const a of parsed) {
    if (!a || typeof a.axis !== "string" || typeof a.score !== "number") {
      console.error(`bad axis entry: ${JSON.stringify(a).slice(0, 120)} — need { axis: string, score: number }`);
      return 3;
    }
    if (!known.has(a.axis)) {
      console.error(`unknown axis "${a.axis}" — valid: ${[...known].join(", ")}`);
      return 3;
    }
    const tier: FailureTier = ["CORRUPTION", "GENERATED_DRAFT", "PUBLISHABLE"].includes(a.tier) ? a.tier : "PUBLISHABLE";
    axes.push({ axis: a.axis as AxisId, score: a.score, tier, hits: Array.isArray(a.hits) ? a.hits : [] });
  }
  // Missing axes are NOT defaulted — an unread axis is a partial read, and a
  // partial read is never a pass (the DID-NOT-RUN rule).
  const missing = [...known].filter((k) => !axes.some((a) => a.axis === k));
  if (missing.length > 0) {
    console.error(`INCOMPLETE READ — missing axes: ${missing.join(", ")}. Score every axis (mark unverifiable facts 'could not verify' per the rubric, but SCORE the axis).`);
    return 3;
  }
  const v = computeVerdict(chapterId, axes as any, true);
  console.log(formatVerdict(v));
  return v.gate === "GREEN" ? 0 : v.gate === "YELLOW" ? 1 : 2;
}

async function runQcRehash(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookFilter = args[0];
  if (!bookFilter && flags["all"] !== true) {
    console.error("Usage: qc-rehash <bookId> | qc-rehash --all");
    return 2;
  }
  const { QC_DIR, chapterContentHash, chapterContentHashV1, chapterContentHashV0, writeAttestation } =
    await import("./critics/qcAttestation.js");
  const chaptersDir = resolve(__dirname, "../state/chapters");
  let upgraded = 0, alreadyV2 = 0, stale = 0, missing = 0;
  const files = readdirSync(QC_DIR).filter((f) => f.endsWith(".qc.json")).sort();
  for (const f of files) {
    const att = JSON.parse(readFileSync(resolve(QC_DIR, f), "utf8"));
    if (bookFilter && att.bookId !== bookFilter) continue;
    if (att.hashVersion === "v2") { alreadyV2++; continue; }
    const chapterFile = resolve(
      chaptersDir,
      `${att.bookId}-ch${String(att.chapterNumber).padStart(2, "0")}.v21-native.chapter.json`,
    );
    if (!existsSyncFs(chapterFile)) {
      console.log(`  SKIP (no chapter on disk): ${f}`);
      missing++;
      continue;
    }
    const chapter = JSON.parse(readFileSync(chapterFile, "utf8")) as ChapterV21;
    // Legacy attestations may carry either pre-v2 algorithm: v1 (2026-06-05+)
    // or v0 (the original 2026-06-04 projection, no title/tryThisNow).
    if (chapterContentHashV1(chapter) !== att.contentHash && chapterContentHashV0(chapter) !== att.contentHash) {
      console.log(`  STALE under v1/v0 — left for re-review: ${f}`);
      stale++;
      continue;
    }
    const { history: _h, ...prior } = att;
    writeAttestation({
      ...att,
      contentHash: chapterContentHash(chapter),
      hashVersion: "v2",
      history: [...(att.history ?? []), prior].slice(-10),
    });
    upgraded++;
  }
  console.log(
    `qc-rehash: ${upgraded} upgraded to v2, ${alreadyV2} already v2, ${stale} stale (need re-review), ${missing} missing chapters.`,
  );
  return 0;
}

/** `catalog-audit [bookId] [--save]` — measure the cross-book fingerprints no
 *  per-book gate sees (hook-shape monoculture, tryThisNow grammar, quiz-opener
 *  family, house tics, the scenario deadline tic, cross-book name collisions,
 *  the distractor length tell). --save writes state/catalog-audit/latest.json
 *  so the remediation campaign has a committed before/after. */
async function runCatalogAudit(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const { loadCatalog, auditCatalog, formatCatalogAudit } = await import("./critics/catalogAudit.js");
  const byBook = loadCatalog(args[0]);
  if (byBook.size === 0) {
    console.error(args[0] ? `No chapters found for "${args[0]}".` : "No chapters in state/chapters/.");
    return 2;
  }
  const report = auditCatalog(byBook);
  console.log(formatCatalogAudit(report));
  // A single-book run structurally cannot see CROSS-book collisions, and its
  // "collisions: 0" was quoted as an acceptance number by the first refresh
  // pilot (reviewer-caught). When filtered, compute the real thing: this
  // book's bank names vs the rest of the catalog.
  if (args[0]) {
    const targetId = report.books[0]?.bookId ?? args[0];
    const full = auditCatalog(loadCatalog());
    const mine = full.catalog.nameCollisions.filter((c) => c.books.includes(targetId));
    console.log(`\n  CROSS-BOOK collisions involving "${targetId}" (vs the full catalog): ${mine.length}`);
    for (const col of mine.slice(0, 12)) {
      console.log(`    ${col.name}: also in ${col.books.filter((b) => b !== targetId).slice(0, 5).join(", ")}${col.books.length > 6 ? ", …" : ""}`);
    }
  }
  if (flags["save"] === true) {
    const outDir = resolve(__dirname, "../state/catalog-audit");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "latest.json");
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nSaved: ${outPath}`);
  }
  return 0;
}

/** `quiz-blind <chapter.json>` — print the chapter's quiz with the answer key
 *  STRIPPED (no correctIndex / explanation / sourceAnchorId). The tooled half
 *  of the hidden-key protocol: a reviewer derives answers from THIS output
 *  only, then `quiz-verify` diffs the derivation against the real key — the
 *  honor-system "cover correctIndex with your hand" becomes mechanical. */
async function runQuizBlind(args: string[]): Promise<number> {
  const file = args[0];
  if (!file) {
    console.error("Usage: quiz-blind <chapter.json>");
    return 2;
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(file), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${file}: ${(err as Error).message}`);
    return 2;
  }
  const questions = (chapter.quiz?.questions ?? []).map((q, i) => ({
    questionIndex: i,
    prompt: q.prompt,
    choices: q.choices,
  }));
  console.log(JSON.stringify({ chapterId: chapter.chapterId, questionCount: questions.length, questions }, null, 2));
  return 0;
}

/** `evidence-audit <chapter.json>` — the write-time evidence-integrity self-check
 *  lever (the shift-left of the QC factual_accuracy axis's dominant residual: the
 *  "Piper move"). Surfaces every named person who CARRIES a finding — an invented
 *  witness cast as a research subject / staged inside a real study (EW1 detector
 *  A+B), or a first-name/initial-only testimonial worn as proof (EI1/EI2) — as a
 *  numbered DISPOSITION checklist. The writer traces each against the research
 *  brief: a real cited source is fine; an invented one must be re-grounded or
 *  stripped of its evidentiary framing. Concrete extraction + bounded disposition,
 *  the pattern that drove quiz-key failures to zero. Advisory: returns 0. */
async function runEvidenceAudit(args: string[]): Promise<number> {
  const file = args[0];
  if (!file) {
    console.error("Usage: evidence-audit <chapter.json>");
    return 2;
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(file), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${file}: ${(err as Error).message}`);
    return 2;
  }
  const { auditChapterWitnesses } = await import("./critics/evidenceWitness.js");
  const { checkTestimonialEvidence, checkQuizKeyTestimonial } = await import("./critics/evidenceIntegrity.js");
  const { auditChapterAttributions } = await import("./critics/misattribution.js");
  const witnesses = auditChapterWitnesses(chapter);
  const testimonials = [...checkTestimonialEvidence(chapter), ...checkQuizKeyTestimonial(chapter)];
  const attributions = auditChapterAttributions(chapter);

  console.log(`EVIDENCE AUDIT — ${chapter.chapterId ?? file}`);
  console.log("Trace every named person who carries a finding to your research brief, then resolve each item below.");
  console.log("  • INVENTED WITNESS (the \"Piper move\"): a person you invented, cast as a research participant/subject or");
  console.log("    staged inside a real study, voicing or acting out the result. The documented study IS the evidence;");
  console.log("    an invented witness inside it is not. FIX: report the real finding (cite the researcher), then move your");
  console.log("    invented actor into a plain everyday setting where they APPLY the lesson — never as a study subject.");
  console.log("  • TESTIMONIAL-AS-PROOF (EI1/EI2): a first-name/initial-only personal account given a finding's grammar.");
  console.log("    FIX: resolve it to a real named source with specifics, or drop the evidentiary verb.");
  console.log("  • MISATTRIBUTION (the \"Hardy move\"): a named authority CREDITED with a claim. Confirm your brief credits");
  console.log("    THEM with THAT claim — a name merely MENTIONED or COMPARED (\"like Hardy's Compound Effect\") is NOT a");
  console.log("    license to attribute a finding to them (\"Hardy found…\"). FIX: credit the real owner the brief names.");
  console.log("DISPOSITION: for each item, confirm the named actor is a REAL source from your brief. If invented → fix per above.");
  console.log("");

  let n = 0;
  for (const t of testimonials) {
    n++;
    console.log(`[${n}] TESTIMONIAL — ${t.message}`);
    if (t.evidence) console.log(`      quote: "${String(t.evidence).slice(0, 160)}"`);
  }
  for (const w of witnesses) {
    n++;
    const label = w.pattern === "participant_cast" ? "INVENTED WITNESS (cast)" : "INVENTED WITNESS? (actor in named study — verify vs brief)";
    console.log(`[${n}] ${label} — ${w.unit}: "${w.subject}"`);
    console.log(`      quote: "${w.sentence.slice(0, 160)}"`);
  }
  for (const a of attributions) {
    n++;
    console.log(`[${n}] ATTRIBUTION? (credited with a claim — confirm the brief credits THEM, not just mentions/compares) — ${a.unit}: "${a.subject}"`);
    console.log(`      quote: "${a.sentence.slice(0, 160)}"`);
  }
  if (n === 0) {
    console.log("No evidence-integrity candidates — no invented witnesses, testimonials, or attributions to disposition. Good.");
  } else {
    const cast = witnesses.filter((w) => w.pattern === "participant_cast").length;
    const castNote = cast === 0 ? "" : cast === 1
      ? " (1 is a hard 'participant/subject <name>' cast — a gate-grade defect, fix it)"
      : ` (${cast} are hard 'participant/subject <name>' casts — gate-grade defects, fix them)`;
    console.log("");
    console.log(`${n} item(s) to disposition${castNote}.`);
  }
  return 0;
}

/** `quiz-verify <chapter.json> --answers "0:1,1:2,..."` — diff blind-derived
 *  answers (qIndex:choiceIndex pairs) against the chapter's real key. Requires
 *  FULL coverage (every question answered) so a reviewer can't pass by only
 *  answering the easy ones. Exit 0 = all match; 1 = mismatch/missing; 2 usage.
 *  Mismatch output includes the keyed explanation so an adjudicator can judge
 *  whether the KEY or the DERIVATION is wrong. */
async function runQuizVerify(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const file = args[0];
  const answersRaw = typeof flags["answers"] === "string" ? (flags["answers"] as string) : "";
  if (!file || !answersRaw) {
    console.error('Usage: quiz-verify <chapter.json> --answers "<qIndex>:<choiceIndex>,..."');
    return 2;
  }
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(file), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${file}: ${(err as Error).message}`);
    return 2;
  }
  const questions = chapter.quiz?.questions ?? [];
  const derived = new Map<number, number>();
  for (const pair of answersRaw.split(",")) {
    const m = pair.trim().match(/^(\d+)\s*[:=]\s*(\d+)$/);
    if (!m) {
      console.error(`Bad --answers entry "${pair.trim()}" — expected <qIndex>:<choiceIndex>.`);
      return 2;
    }
    const qi = Number(m[1]);
    // Out-of-range and duplicate entries are usage errors, not noise to skip:
    // silently ignoring them let "0:0,...,8:0,99:5" read as full clean coverage.
    if (qi >= questions.length) {
      console.error(`--answers entry "${pair.trim()}": question index ${qi} does not exist (quiz has ${questions.length} questions, 0-${questions.length - 1}).`);
      return 2;
    }
    if (derived.has(qi)) {
      console.error(`--answers entry "${pair.trim()}": duplicate answer for question ${qi}.`);
      return 2;
    }
    derived.set(qi, Number(m[2]));
  }
  let mismatches = 0;
  let missing = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // Legacy quizzes key the answer as correctAnswerIndex; everything else in
    // the pipeline (schema, quizQuality, the v1 hash) honors the alias.
    const keyed = (q.correctIndex ?? (q as any).correctAnswerIndex) as number;
    const d = derived.get(i);
    if (d === undefined) {
      missing++;
      console.log(`q${i}: MISSING — no derived answer supplied (full coverage is required)`);
      continue;
    }
    if (d === keyed) {
      console.log(`q${i}: MATCH (choice ${d})`);
    } else {
      mismatches++;
      console.log(`q${i}: MISMATCH — derived ${d} ("${(q.choices[d] ?? "<no such choice>").slice(0, 70)}") vs keyed ${keyed} ("${(q.choices[keyed] ?? "").slice(0, 70)}")`);
      console.log(`    keyed explanation: ${(typeof q.explanation === "string" ? q.explanation : JSON.stringify(q.explanation) ?? "<none>").slice(0, 160)}`);
    }
  }
  console.log(
    `quiz-verify: ${questions.length - mismatches - missing}/${questions.length} match, ${mismatches} mismatch(es), ${missing} missing.` +
      (mismatches > 0 ? " A mismatch is a CLAIM (key OR derivation may be wrong) — adjudicate before calling it corruption." : ""),
  );
  return mismatches === 0 && missing === 0 ? 0 : 1;
}

/** `qc-run <bookId> [--chapters 1,2,3]` — generate the harness QC workflow for
 *  a book: tooled blind-key verification, dual-lens publishable-bar reads, a
 *  cross-chapter sweep, adversarial adjudication of every corruption claim,
 *  and qc-attest with reviewer=harness:<id>. The generated script embeds the
 *  LIVE rubric/weights/floors from publishableBar.ts (no prompt drift) and is
 *  launched from a Claude Code session via the Workflow tool. */
async function runQcRun(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: qc-run <bookId> [--chapters 1,2,3]");
    return 2;
  }
  const chaptersDir = resolve(__dirname, "../state/chapters");
  const files = readdirSync(chaptersDir).filter((f) => isSiblingFile(f, bookId)).sort();
  if (files.length === 0) {
    console.error(`No chapters found for "${bookId}" in state/chapters/.`);
    return 2;
  }
  const only = (parseCsvFlag(flags["chapters"]) ?? []).map((s) => Number(s)).filter((n) => Number.isFinite(n));
  const { findRunArtifact } = await import("./lib/runDirs.js");
  const { AXIS_RUBRIC, AXIS_WEIGHTS, CORRUPTION_AXES, PUBLISHABLE_FLOOR, AXIS_FLOOR } =
    await import("./critics/semantic/publishableBar.js");
  const RUNS = resolve(__dirname, "../.chapterflow/runs");

  const quizCounts: Record<number, number> = {};
  const chapters = files
    .map((f) => {
      const ch = JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21;
      quizCounts[ch.number] = ch.quiz?.questions?.length ?? 0;
      return {
        n: ch.number,
        file: resolve(chaptersDir, f),
        sidecar: findRunArtifact(RUNS, bookId, `sidecars/source/ch${String(ch.number).padStart(2, "0")}.source.json`),
      };
    })
    .filter((c) => only.length === 0 || only.includes(c.n))
    .sort((a, b) => a.n - b.n);

  // Gold anchor: judges skim one reference-quality chapter so "85+" is
  // calibrated against the corpus every blocker is calibrated against.
  const goldCandidate = resolve(chaptersDir, "daring-greatly-ch01.v21-native.chapter.json");
  const config = {
    bookId,
    pipelineDir: resolve(__dirname, ".."),
    reviewer: `harness:qc-run-${bookId}-${new Date().toISOString().slice(0, 10)}`,
    chapters,
    quizCounts,
    goldFile: existsSyncFs(goldCandidate) && !bookId.startsWith("daring-greatly") ? goldCandidate : null,
    rubric: AXIS_RUBRIC,
    weights: AXIS_WEIGHTS,
    corruptionAxes: [...CORRUPTION_AXES],
    publishableFloor: PUBLISHABLE_FLOOR,
    axisFloor: AXIS_FLOOR,
  };

  const template = readFileSync(resolve(__dirname, "../templates/qc-run.workflow.template.js"), "utf8");
  const script = template.replace("__CONFIG__", JSON.stringify(config, null, 2));
  const outDir = resolve(__dirname, "../state/qc-runs");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${bookId}.workflow.js`);
  writeFileSync(outPath, script, "utf8");

  console.log(`QC workflow generated: ${outPath}`);
  console.log(`  book: ${bookId} — ${chapters.length} chapter(s); sidecars resolved for ${chapters.filter((c) => c.sidecar).length}/${chapters.length}`);
  console.log(`  reviewer id: ${config.reviewer}`);
  console.log(`  agents: ~${chapters.length * 3 + 2}+ (blind-keys + 2 lenses per chapter, sweep, adjudication, attest)`);
  console.log("");
  console.log("Launch from a Claude Code session (the harness is the no-API semantic judge):");
  console.log(`  Workflow({ scriptPath: "${outPath}" })`);
  console.log("Then review the returned verdicts; REVISE/CORRUPTION chapters go back to authoring.");
  if (chapters.length > 10) {
    console.log(
      `NOTE: ${chapters.length} chapters ≈ ${chapters.length * 3 + 2}+ agents in one run — a session rate limit mid-fleet ` +
        `leaves chapters incomplete (they fail safe to REVISE, but must be re-run). Consider batches: --chapters 1,2,...,8 then the rest.`,
    );
  }
  return 0;
}

/** `quiz-judge <bookId> [--chapters 1,2] [--provider openai-api]` — the
 *  model-backed answer-key audit. For each chapter it hides correctIndex and
 *  asks the model to derive the answer independently (the hidden-key protocol,
 *  tooled — not left to an agent's self-restraint); a confident disagreement is
 *  a wrong-key flag. Writes a per-chapter result to
 *  state/qc/<bookId>-chNN.keyjudge.json that the promote gate ENFORCES
 *  (QC1.wrong_quiz_key), so the catch is independent of the writer's honesty.
 *  Exit 0 clean / 1 wrong key(s) / 2 infra (fail-OPEN: an infra error must never
 *  look like a clean semantic pass). */
async function runQuizJudge(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  // #14: quiz-judge defaults to the BILLED openai-api provider and makes ~1 call per quiz
  // question. In no-API mode the wrong-key catch is the MANUAL keyA/keyB judge (run via
  // qc-orchestrate), not this billed verb — so refuse here rather than silently spend money the
  // mode promises it won't. (The provider-router choke point would also block it; this is the
  // clear early error.)
  const { isNoApiCodexQcMode } = await import("./qc/noApiMode.js");
  if (isNoApiCodexQcMode()) {
    console.error("quiz-judge makes BILLED model calls and is disabled in no-API mode (CHAPTERFLOW_NO_API_CODEX_QC=1). The no-API wrong-key catch is the manual keyA/keyB judge via qc-orchestrate (see QC-SESSION-PROMPT). Unset CHAPTERFLOW_NO_API_CODEX_QC to run the billed judge intentionally.");
    return 2;
  }
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: quiz-judge <bookId> [--chapters 1,2,3] [--provider openai-api]");
    return 2;
  }
  const chaptersDir = resolve(__dirname, "../state/chapters");
  const files = readdirSync(chaptersDir).filter((f) => isSiblingFile(f, bookId)).sort();
  if (files.length === 0) {
    console.error(`No chapters found for "${bookId}" in state/chapters/.`);
    return 2;
  }
  const only = (parseCsvFlag(flags["chapters"]) ?? []).map((s) => Number(s)).filter((n) => Number.isFinite(n));
  const providerFlag = typeof flags["provider"] === "string" ? (flags["provider"] as string) : process.env.CHAPTERFLOW_PROVIDER;
  const provider = providerFlag as ProviderName | undefined;

  const { judgeQuizKeys, makeLiveAskModel, formatQuizKeyReport } = await import("./critics/semantic/quizKeyJudge.js");
  const { recordFromReport, writeKeyJudge } = await import("./critics/quizKeyGate.js");
  const { findRunArtifact } = await import("./lib/runDirs.js");
  const RUNS = resolve(__dirname, "../.chapterflow/runs");

  const ask = makeLiveAskModel(provider ? { provider } : undefined);
  const reviewer = `keyjudge:${provider ?? "openai-api"}`;
  const chapters = files
    .map((f) => JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21)
    .filter((ch) => only.length === 0 || only.includes(ch.number))
    .sort((a, b) => a.number - b.number);

  console.log(`Judging quiz answer keys for ${bookId} — ${chapters.length} chapter(s) via provider=${provider ?? "openai-api"}...\n`);

  let totalFlagged = 0;
  let totalReview = 0;
  let judged = 0;
  try {
    for (const ch of chapters) {
      const numStr = String(ch.number).padStart(2, "0");
      let sourceContext: string | undefined;
      const scPath = findRunArtifact(RUNS, bookId, `sidecars/source/ch${numStr}.source.json`);
      if (scPath) {
        try { sourceContext = readFileSync(scPath, "utf8").slice(0, 8000); } catch { /* sidecar ground truth is optional */ }
      }
      const report = await judgeQuizKeys(ch, { ask, sourceContext });
      const recPath = writeKeyJudge(recordFromReport(report, ch, { bookId, reviewer, now: new Date().toISOString() }));
      console.log(formatQuizKeyReport(report));
      console.log(`  → ${recPath}\n`);
      totalFlagged += report.flagged.length;
      totalReview += report.review.length;
      judged++;
    }
  } catch (err) {
    // Fail OPEN: a provider/infra error must never be recorded or read as a
    // clean semantic pass. Loud, distinct marker; only chapters that actually
    // completed were written, so a half-run can't masquerade as full coverage.
    console.error("\n⚠️  SEMANTIC JUDGE DID NOT RUN — provider/infra error (NOT a clean pass):");
    console.error("   " + (err as Error).message);
    console.error("   Set a funded OPENAI_API_KEY / ANTHROPIC_API_KEY (or CHAPTERFLOW_PROVIDER) and retry.");
    console.error(`   (${judged}/${chapters.length} chapter(s) judged before the error.)`);
    return 2;
  }

  console.log(`Quiz answer-key judge: ${totalFlagged === 0 ? "PASS" : "BLOCK"} for ${bookId}`);
  console.log(`  chapters judged: ${judged}  |  wrong keys flagged: ${totalFlagged}  |  medium-confidence review: ${totalReview}`);
  if (totalFlagged > 0) {
    console.log("  These BLOCK at promote (QC1.wrong_quiz_key) while the result is fresh. Fix the keys, then re-run quiz-judge.");
  }
  return totalFlagged === 0 ? 0 : 1;
}

/** `qc-stats [bookId]` — revision-rate instrumentation from the attestation
 *  record. The plan's throughput ceiling is the ~18% reviewer-revision rate;
 *  this measures it instead of assuming it: first-pass PUBLISHABLE rate
 *  (initial verdict in each attestation's history), attempts per chapter,
 *  final verdict mix, and human-vs-harness reviewer split. History only
 *  accumulates from Phase 1b onward, so early numbers under-count redos. */
async function runQcStats(args: string[]): Promise<number> {
  const bookFilter = args[0] ?? null;
  const { QC_DIR } = await import("./critics/qcAttestation.js");
  let files: string[] = [];
  try {
    files = readdirSync(QC_DIR).filter((f) => f.endsWith(".qc.json")).sort();
  } catch {
    console.error(`No attestation dir at ${QC_DIR}.`);
    return 2;
  }
  type Row = { chapters: number; firstPass: number; attempts: number; finals: Record<string, number>; reviewers: Record<string, number> };
  const byBook = new Map<string, Row>();
  for (const f of files) {
    let att: any;
    try {
      att = JSON.parse(readFileSync(resolve(QC_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (bookFilter && att.bookId !== bookFilter) continue;
    if (!byBook.has(att.bookId)) byBook.set(att.bookId, { chapters: 0, firstPass: 0, attempts: 0, finals: {}, reviewers: {} });
    const row = byBook.get(att.bookId)!;
    // A qc-rehash hash migration appends a history entry with the SAME
    // reviewedAt (only contentHash/hashVersion changed) — that's bookkeeping,
    // not a review attempt; counting it would fake a 2.0 attempts floor.
    const history: any[] = (Array.isArray(att.history) ? att.history : []).filter(
      (h: any) => h?.reviewedAt !== att.reviewedAt,
    );
    const firstVerdict = history.length > 0 ? history[0]?.verdict : att.verdict;
    row.chapters++;
    if (firstVerdict === "PUBLISHABLE") row.firstPass++;
    row.attempts += 1 + history.length;
    row.finals[att.verdict] = (row.finals[att.verdict] ?? 0) + 1;
    const kind = typeof att.reviewer === "string" && att.reviewer.includes(":") ? att.reviewer.split(":")[0] : "other";
    row.reviewers[kind] = (row.reviewers[kind] ?? 0) + 1;
  }
  if (byBook.size === 0) {
    console.error(bookFilter ? `No attestations for "${bookFilter}".` : "No attestations on disk.");
    return 2;
  }
  const fmtFinals = (r: Row) =>
    Object.entries(r.finals).sort().map(([v, c]) => `${v[0]}${v === "PUBLISHABLE" ? "" : ""}:${c}`).join(" ");
  let chapters = 0, firstPass = 0, attempts = 0;
  console.log(`QC stats${bookFilter ? ` — ${bookFilter}` : ""} (first-pass = initial verdict was PUBLISHABLE; attempts = 1 + history length)`);
  const w = Math.max(...[...byBook.keys()].map((b) => b.length), 8);
  for (const [book, r] of [...byBook.entries()].sort()) {
    chapters += r.chapters; firstPass += r.firstPass; attempts += r.attempts;
    console.log(
      `  ${book.padEnd(w)}  ch:${String(r.chapters).padStart(3)}  first-pass:${String(Math.round((r.firstPass / r.chapters) * 100)).padStart(3)}%` +
        `  avg-attempts:${(r.attempts / r.chapters).toFixed(2)}  finals[${fmtFinals(r)}]  reviewers[${Object.entries(r.reviewers).map(([k, c]) => `${k}:${c}`).join(" ")}]`,
    );
  }
  console.log(
    `\n  OVERALL: ${chapters} attested chapter(s), first-pass PUBLISHABLE ${Math.round((firstPass / chapters) * 100)}% ` +
      `(revision rate ${Math.round(((chapters - firstPass) / chapters) * 100)}%), avg attempts ${(attempts / chapters).toFixed(2)}.`,
  );
  console.log("  Phase 3's prevention layer (shape plan, grounding anchors, two-pass) should push first-pass UP over time — re-run after each book ships.");
  return 0;
}

/** `qc-status <bookId>` — show per-chapter QC-attestation coverage (the semantic
 *  gate's readiness for promote): PASS (fresh PUBLISHABLE), STALE, REVISE/
 *  CORRUPTION, or MISSING. */
async function runQcStatus(args: string[]): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const input = args.join(" ").trim();
  if (!input) {
    console.error("Usage: qc-status <bookId|title>");
    return 2;
  }
  // Resolve a title to its bookId (the finalize prompt's preflight may be handed
  // a title); without this a pasted title reports every chapter MISSING + exit 1
  // and stalls a fully-QC'd book.
  const { resolveBookIdentifier } = await import("./qc/auto/resolveBook.js");
  const resolved = resolveBookIdentifier(input);
  const bookId = resolved.ok === false ? input : resolved.bookId;
  if (resolved.ok === false) console.log(`note: could not resolve "${input}" to a known book — using raw id "${bookId}".`);
  const chaptersDir = resolve(__dirname, "../state/chapters");
  const files = readdirSync(chaptersDir).filter((f) => isSiblingFile(f, bookId)).sort();
  if (files.length === 0) {
    console.error(`No chapters found for "${bookId}".`);
    return 2;
  }
  const { isAttestationFresh, loadAttestation } = await import("./critics/qcAttestation.js");
  let ready = 0;
  const lines: string[] = [];
  for (const f of files) {
    const ch = JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21;
    const att = loadAttestation(bookId, ch.number);
    let status: string;
    if (!att) status = "MISSING";
    else if (att.verdict !== "PUBLISHABLE") status = att.verdict;
    else if (!isAttestationFresh(att, ch)) status = "STALE";
    else { status = "PASS"; ready++; }
    lines.push(`  ch${String(ch.number).padStart(2, "0")}: ${status}${att ? `  (reviewer=${att.reviewer}, ${att.reviewedAt.slice(0, 10)}${att.roundId ? `, round=${att.roundId}/${att.roundRole ?? "?"}` : ""})` : ""}`);
  }
  console.log(`QC attestation status — ${bookId}: ${ready}/${files.length} chapters ship-ready (PASS)`);
  console.log(lines.join("\n"));
  return ready === files.length ? 0 : 1;
}

async function runBookGate(args: string[]): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const bookId = args[0];
  if (!bookId) {
    console.error("Usage: book-gate <bookId>");
    return 2;
  }
  const STATE_DIR = resolve(__dirname, "../state");
  const chaptersDir = resolve(STATE_DIR, "chapters");
  if (!existsSyncFs(chaptersDir)) {
    console.error(`Chapters directory not found: ${chaptersDir}`);
    return 2;
  }
  // Case-insensitive sibling match via the shared resolver (Phase 0 casing fix).
  const chapterFiles = readdirSync(chaptersDir)
    .filter((f) => isSiblingFile(f, bookId))
    .sort();
  if (chapterFiles.length === 0) {
    console.error(`No chapters found for book "${bookId}" under ${chaptersDir}`);
    return 2;
  }

  const hasBriefArtifact =
    existsSyncFs(resolve(STATE_DIR, "briefs", `${bookId}.manual-brief.json`)) ||
    existsSyncFs(resolve(STATE_DIR, "briefs", `${bookId}.brief.json`));
  const missingPlanArtifacts = chapterFiles
    .map((f) => chapterIdFromFileName(f))
    .filter((chapterId) =>
      !existsSyncFs(resolve(STATE_DIR, "plans", `${chapterId}.manual-plan.json`)) &&
      !existsSyncFs(resolve(STATE_DIR, "plans", `${chapterId}.plan.json`)),
    );
  if (!hasBriefArtifact || missingPlanArtifacts.length > 0) {
    // Auto-derive brief + plan artifacts. BP7 (book gate) fails closed
    // without these, but derive-artifacts is a deterministic pass over what's
    // already on disk. If the artifacts already exist, keep the command
    // hermetic and avoid requiring a private research run just to re-check.
    console.log(`Auto-deriving brief + plan artifacts for ${bookId} (so BP7 doesn't false-fire)...`);
    const deriveCode = await runDeriveArtifacts([bookId]);
    if (deriveCode !== 0) {
      console.error(`derive-artifacts failed for ${bookId}; aborting book-gate.`);
      return deriveCode;
    }
    console.log("");
  }

  const chapters: ChapterV21[] = [];
  for (const f of chapterFiles) {
    try {
      chapters.push(JSON.parse(readFileSync(resolve(chaptersDir, f), "utf8")) as ChapterV21);
    } catch (err) {
      console.error(`Could not parse ${f}: ${(err as Error).message}`);
      return 2;
    }
  }

  const { runBookGate: runBookGateCritic, formatBookGateReport } = await import("./critics/bookGate.js");
  const report = runBookGateCritic(bookId, chapters);
  console.log(formatBookGateReport(report));

  // Phase 2 (shadow/advisory): cross-chapter keyed-choice duplication — the
  // let-them-theory defect BP21 structurally cannot see (it skips the correct
  // index). Calibrated to 0 false-positives across the corpus.
  try {
    const { checkKeyedChoiceDuplication } = await import("./critics/quizCorrectness.js");
    const dup = checkKeyedChoiceDuplication(chapters);
    if (dup.length > 0) {
      console.log("");
      console.log(`Quiz-correctness findings (advisory/shadow — ${dup.length}):`);
      for (const f of dup) console.log(`  [${f.checkId}] ${f.message.slice(0, 180)}`);
    }
  } catch {
    /* non-fatal advisory layer */
  }

  // ── Forced content-read reminder ────────────────────────────────────────
  // Every gate in this pipeline is deterministic structure/templating/register
  // analysis. NONE of them verify semantic correctness: a quiz can mark the
  // wrong answer correct, a card can teach a false point, an example can be
  // incoherent word-salad — and still pass every gate (hooked shipped 21/72
  // wrong answer keys past a GREEN book-gate; the-5-am-club shipped word-salad).
  // A PASS here is necessary but NOT sufficient. Surface that on every PASS so
  // no operator or writer agent reads GREEN as "shippable" without reading the
  // actual content a reader would see.
  if (report.passed) {
    console.log("");
    console.log("⚠️  GATE PASS ≠ SEMANTICALLY VERIFIED ⚠️");
    console.log("These gates check structure, templating, and register — NOT correctness.");
    console.log("Before promote-book, a human (or the QC reviewer agent) MUST read raw");
    console.log("content from at least 2-3 chapters and confirm:");
    console.log("  • every quiz's correctIndex actually points to the right answer");
    console.log("  • review cards and examples are coherent and true to the source");
    console.log("  • prose reads as written-by-a-person, not template-filled");
    console.log("Wrong answer keys and word-salad have shipped past a GREEN gate before.");
  }

  return report.passed ? 0 : 1;
}

/** `publishable-rubric` — print the SAME 9-axis publishable-bar rubric the QC bar
 *  reviewer scores against, so a writer self-scores its draft BEFORE submitting.
 *  Read-only, no book/round needed. Closes the writer↔QC gap: gate-chapter is
 *  deterministic and does NOT predict the model bar verdict; this is the standard
 *  that actually decides PUBLISHABLE vs REVISE. */
async function runPublishableRubric(): Promise<number> {
  const { formatWriterRubric } = await import("./critics/semantic/publishableBar.js");
  console.log(formatWriterRubric());
  return 0;
}

async function runGateChapter(args: string[]): Promise<number> {
  const g = shadowGuard();
  if (g) return g;
  const chapterFile = args[0];
  if (!chapterFile) {
    console.error("Usage: gate-chapter <path/to/chapter.json>");
    return 2;
  }
  const { runShipGate, formatGateReport } = await import("./critics/finalGate.js");
  let chapter: ChapterV21;
  try {
    chapter = JSON.parse(readFileSync(resolve(chapterFile), "utf8")) as ChapterV21;
  } catch (err) {
    console.error(`Could not read/parse ${chapterFile}: ${(err as Error).message}`);
    return 2;
  }
  // H5 defense: a malformed authored chapter could make a critic throw. The repair agent runs
  // gate-chapter to converge — it needs an actionable BLOCK report, not a raw stack trace (which
  // gives it nothing to fix and drives the conductor's no-progress HALT). Surface a crash as a
  // gate failure with the message instead.
  let report;
  try {
    report = runShipGate(chapter);
  } catch (err) {
    console.error(`gate-chapter: ship gate CRASHED on a malformed chapter (${(err as Error)?.message ?? String(err)}). Fix the malformed field (likely a quiz question: missing/null choices, out-of-range correctIndex, or non-string bloomsLevel) and re-run.`);
    return 1;
  }
  console.log(formatGateReport(report));

  // Intra-book quiz similarity check — runs AFTER the chapter-only ship gate.
  // Loads sibling chapters of the same book from state/chapters/ and checks
  // for templated quiz content (AS5 prompt similarity + AS6 distractor reuse).
  // This is the early-detection version of AS4 / BP20 which only fire at
  // book-gate time. Catches the May 2026 "7 Habits Step 2" defect class:
  // writer agents producing one quiz and reusing it across chapters with
  // name substitution. Without this, the writer wastes 10+ chapters of work
  // before book-gate surfaces the structural issue.
  const { runIntraBookChecks, loadSiblingChapters } = await import("./critics/intraBook.js");
  const siblingLoad = loadSiblingChapters(chapter, chapterFile);
  if (siblingLoad.warning) console.log(`  WARN: ${siblingLoad.warning}`);
  const intraFindings = runIntraBookChecks(chapter, siblingLoad.siblings);
  let extraBlockers = 0;
  let extraMajors = 0;
  if (intraFindings.length > 0) {
    console.log("");
    console.log("Intra-book quiz similarity findings (compared against prior chapters of same book):");
    for (const f of intraFindings) {
      console.log(`  [${f.checkId} ${f.severity}] ${f.message}`);
      if (f.severity === "blocker") extraBlockers++;
    }
  }

  // ── Identity guard (IDN, Phase 0) — chapterId must equal its filename stem ──
  // The intra-book critics above match siblings on chapterId; a mismatch can
  // silently skip them (the verified casing bug). Surface it here. Ships as
  // `major` (shadow) so the casing fix doesn't simultaneously hard-block the
  // already-mismatched chapters; promotes to blocker after `fix-chapter-ids`.
  const identityFindings = checkChapterIdentity(chapter, chapterFile);
  if (identityFindings.length > 0) {
    console.log("");
    console.log("Identity findings (chapterId vs filename):");
    for (const f of identityFindings) {
      console.log(`  [${f.checkId} ${f.severity}] ${f.message}`);
      if (f.severity === "blocker") extraBlockers++;
      else if (f.severity === "major") extraMajors++;
    }
  }

  // ── Authoring-contract findings (Phase 1, advisory/shadow) ──────────────
  // The field-JOB layer the structural gate lacks (concept-as-actor, templated
  // loops, echo-template explanations, bare-label card fronts, scaffold leaks,
  // proposition-whatToDo). Calibrated to ZERO fires on the clean corpus. SHADOW:
  // surfaced for the writer to fix in-session via `author-check`, but does NOT
  // affect the ship-gate blocker count until promoted out of shadow.
  try {
    const { checkAuthoringContract } = await import("./critics/authoringContract.js");
    const { loadChapterSidecar } = await import("./critics/sourceGrounding.js");
    const acFindings = checkAuthoringContract(chapter, { sidecar: loadChapterSidecar(chapter.chapterId), filePath: resolve(chapterFile) });
    if (acFindings.length > 0) {
      console.log("");
      console.log(`Authoring-contract findings (advisory/shadow — ${acFindings.length}; run \`author-check\` for the full JOB report):`);
      for (const f of acFindings) console.log(`  [${f.checkId}] ${f.unit}: ${f.message.slice(0, 140)}`);
    }
  } catch {
    /* non-fatal — advisory layer */
  }

  // ── Quiz answer-key judge (advisory) ────────────────────────────────────
  // Surface any wrong-key result the model judge recorded for this chapter
  // (run out-of-band via `quiz-judge`). ADVISORY here so authoring iteration is
  // never blocked by it; it BLOCKS at promote (QC1.wrong_quiz_key). A missing
  // result is silent — gate-chapter never requires the judge to have run.
  try {
    const { checkKeyJudge } = await import("./critics/quizKeyGate.js");
    const kjFindings = checkKeyJudge(chapter, false);
    if (kjFindings.length > 0) {
      console.log("");
      console.log("Quiz answer-key judge findings (advisory — blocks at promote):");
      for (const f of kjFindings) console.log(`  [${f.checkId} ${f.severity}] ${f.message}`);
    }
  } catch {
    /* non-fatal — advisory layer */
  }

  // ── Authoritative combined verdict ──────────────────────────────────────
  // formatGateReport prints "Ship gate: PASS/BLOCK" for the CHAPTER-ONLY ship
  // gate. The intra-book blockers above are computed separately and are NOT in
  // that count, so a chapter with 0 chapter-blockers but an AS5/AS6 intra-book
  // blocker used to print "Ship gate: PASS" up top while exiting non-zero —
  // the headline disagreed with the exit code (a trust hazard: a human or a
  // writer agent reads "PASS" and ships a templated chapter). Print a single
  // final line that combines both sources and matches the exit code exactly.
  const combinedBlockers = report.blockers.length + extraBlockers;
  console.log("");
  if (combinedBlockers > 0) {
    console.log(
      `Gate verdict: BLOCK — ${report.blockers.length} chapter blocker(s) + ${extraBlockers} intra-book blocker(s) = ${combinedBlockers} total. (exit 1)`,
    );
  } else {
    console.log(
      `Gate verdict: PASS — 0 blockers (${report.majors.length + extraMajors} major(s), ${report.minors.length} minor(s) above are non-blocking). (exit 0)`,
    );
  }

  // Gate-attempt tracking — added after the May 2026 Covey incident. We persist

  // Gate-attempt tracking — added after the May 2026 Covey incident. We persist
  // a per-chapter counter of (attempt, blocker_signature) so an agent that
  // re-runs the gate against the same chapter many times with the same blocker
  // pattern gets a SCREAMING warning that it's probably trying to game the
  // critic. Most legitimate fixes converge in 1-3 attempts; 4+ on the same
  // blocker is a structural issue requiring upstream resolution, not retry.
  // Record the COMBINED failure (chapter + intra-book blockers) so the breakers
  // engage for intra-book-only failures too (the common case — a chapter can pass
  // the chapter-only gate while failing AS5–AS12 against its siblings).
  const intraBlockerSig = intraFindings.filter((f) => f.severity === "blocker").map((f) => ({ catalogId: f.checkId }));
  const combinedReport = {
    blockers: [...report.blockers, ...intraBlockerSig],
    passed: report.blockers.length === 0 && extraBlockers === 0,
  };
  const attempts = recordGateAttempt(chapterFile, combinedReport);
  // Two circuit-breakers: STUCK (same blocker repeats) and FORM-SHIFTING (the
  // blocker relocates each attempt — the writer editing surface to dodge the
  // critic, the let-them-theory failure mode). Either trips a halt (exit 3).
  let breakerTripped = false;
  if (attempts.sameBlockerStreak >= 3) {
    breakerTripped = true;
    console.log("");
    console.log("⚠️  STUCK-BLOCKER — CIRCUIT BREAKER TRIPPED ⚠️");
    console.log(`This chapter has been gate-checked ${attempts.total} times; the SAME blocker signature fired ${attempts.sameBlockerStreak} times in a row:`);
    console.log(`  ${attempts.lastSignature}`);
    console.log("");
    console.log("STOP. A blocker that survives 3+ attempts is structural, not a surface edit.");
    console.log("Re-author the field from the source notes, or surface a one-paragraph status to");
    console.log("the user (the source notes may not differentiate this chapter — a Step-1 issue).");
  } else if (attempts.distinctSigStreak >= 3 && attempts.nonPassTotal >= 3) {
    breakerTripped = true;
    console.log("");
    console.log("⚠️  FORM-SHIFTING REPAIR — CIRCUIT BREAKER TRIPPED ⚠️");
    console.log(`This chapter has failed ${attempts.nonPassTotal} times and the blocker MOVED each attempt:`);
    console.log(`  ${attempts.recentSigs.join("  →  ")}`);
    console.log("");
    console.log("A defect that relocates instead of resolving means you are editing SURFACE FORM");
    console.log("to evade the critic, not fixing the field — the underlying template just hides in");
    console.log("whichever field isn't yet covered. STOP patching surfaces. Re-author the failing");
    console.log("field from the source notes (the Bind Block), or escalate to the user / a different");
    console.log("author. Do NOT run gate-chapter again on another surface edit — it will just relocate.");
  }
  if (breakerTripped) console.log("\n(gate-chapter exit code 3 — halt the repair loop.)");

  // Combined block: ship-gate blockers OR intra-book similarity blockers. Exit 3
  // when a circuit-breaker tripped (so an orchestrating loop halts, not spins).
  if (breakerTripped) return 3;
  return report.blockers.length === 0 && extraBlockers === 0 ? 0 : 1;
}


function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Persists gate-attempt history per chapter file to track stuck-blocker
 *  patterns. Returns the running totals so the caller can warn the operator. */
type GateAttemptEntry = {
  total: number;
  lastSignature: string;
  sameBlockerStreak: number;
  /** ++ each attempt where the non-PASS signature CHANGED from the prior one. */
  distinctSigStreak: number;
  /** count of consecutive non-PASS attempts (resets on PASS). */
  nonPassTotal: number;
  /** last few non-PASS signatures, for the form-shift message. */
  recentSigs: string[];
};

function recordGateAttempt(
  chapterFile: string,
  report: { blockers: Array<{ catalogId: string }>; passed: boolean },
): { total: number; sameBlockerStreak: number; lastSignature: string; distinctSigStreak: number; nonPassTotal: number; recentSigs: string[] } {
  const STATE_FILE = resolve(__dirname, "../state/gate-attempts.json");
  let state: Record<string, GateAttemptEntry> = {};
  try {
    if (existsSyncFs(STATE_FILE)) state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  // Signature: sorted unique blocker catalogIds (e.g., "AS4,BP20"). Used to
  // detect "same blocker repeating" (stuck) vs "blocker changing each attempt"
  // (form-shifting — the writer relocating the defect to dodge the critic).
  const sig = report.passed
    ? "PASS"
    : [...new Set(report.blockers.map((b) => b.catalogId))].sort().join(",");
  const prev: GateAttemptEntry = state[chapterFile] ?? { total: 0, lastSignature: "", sameBlockerStreak: 0, distinctSigStreak: 0, nonPassTotal: 0, recentSigs: [] };
  const isPass = sig === "PASS";
  const sameBlockerStreak = !isPass && sig === prev.lastSignature ? prev.sameBlockerStreak + 1 : isPass ? 0 : 1;
  const shifted = !isPass && prev.lastSignature && prev.lastSignature !== "PASS" && sig !== prev.lastSignature;
  const distinctSigStreak = isPass ? 0 : shifted ? prev.distinctSigStreak + 1 : prev.distinctSigStreak;
  const nonPassTotal = isPass ? 0 : prev.nonPassTotal + 1;
  const recentSigs = isPass ? [] : [...(prev.recentSigs ?? []), sig].slice(-4);
  state[chapterFile] = { total: prev.total + 1, lastSignature: sig, sameBlockerStreak, distinctSigStreak, nonPassTotal, recentSigs };
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Non-fatal — tracking is informational.
  }
  return { total: state[chapterFile].total, sameBlockerStreak, lastSignature: sig, distinctSigStreak, nonPassTotal, recentSigs };
}

async function main() {
  const { cmd, args, flags } = parseArgs(process.argv.slice(2));
  // CANONICAL-WORKSPACE TRIPWIRE (2026-06-12). The legacy checkout at
  // ~/ChapterFlow (app campaigns, other branches) carries stale pipeline
  // state; commands run there embed wrong paths into generated prompts/
  // workflows and judge/edit stale copies — this burned a full QC run and a
  // fanout round. Path-specific on purpose (no effect in CI or future
  // machines); remove when the legacy checkout retires.
  if (__dirname.startsWith("/Users/radinsoltani/ChapterFlow/") && flags["allow-noncanonical"] !== true) {
    console.error(
      "REFUSED — you are running the pipeline from the legacy checkout (~/ChapterFlow).\n" +
        "All pipeline work runs in ~/ChapterFlow-books (worktree pinned to main).\n" +
        `  cd /Users/radinsoltani/ChapterFlow-books\n` +
        "Override only if you truly mean it: --allow-noncanonical",
    );
    return 3;
  }
  const configFindings = validateAllConfigFiles();
  if (configFindings.length > 0) {
    console.error(`Config schema validation failed:\n${formatRuntimeFindings(configFindings)}`);
    return 2;
  }
  switch (cmd) {
    case "critic":
      return runCritic(args, flags);
    case "ping": {
      const r = await pingClaude();
      console.log(JSON.stringify(r, null, 2));
      return r.ok ? 0 : 1;
    }
    case "ledger":
      return runLedger(args, flags);
    case "verify-library-state":
      return runVerifyLibraryState(flags);
    case "rebuild-library-state":
      return runRebuildLibraryState(flags);
    case "pipeline":
    case "flow":
      return (await import("./orchestrator/optimizedPipeline.js")).runOptimizedPipeline(args, flags);
    case "policy": {
      const { parseRunPolicyName, runPolicy, formatRunPolicy } = await import("./policy/runPolicy.js");
      console.log(formatRunPolicy(runPolicy(parseRunPolicyName(args[0] ?? flags.policy))));
      return 0;
    }
    case "generate-book":
      return runGenerateBook(args, flags);
    case "next-task":
      return runNextTask(args);
    case "runbook":
      return runRunbook(args, flags);
    case "diagnose":
      return runDiagnose(args, flags);
    case "check-source":
      return runCheckSource(args);
    case "source-verify":
      return runSourceVerify(args, flags);
    case "source-verify-check":
      return runSourceVerifyCheck(args, flags);
    case "source-verify-schema":
      return runSourceVerifySchema();
    case "source-verify-workbench":
      return runSourceVerifyWorkbench(args, flags);
    case "source-verify-import":
      return runSourceVerifyImport(args, flags);
    case "source-fit":
      return runSourceFit(args, flags);
    case "prune-book-state":
      return runPruneBookState(args, flags);
    case "derive-artifacts":
      return runDeriveArtifacts(args);
    case "research":
      return runResearch(args, flags);
    case "generate":
      return runGenerate(args, flags);
    case "publish":
      return runPublish(args, flags);
    case "publish-to-live":
      return runPublishToLive(args, flags);
    case "qc-stamp-author":
      return runStampAuthor(args, flags);
    case "book-status":
      return runBookStatus(args, flags);
    case "doctor":
      return runDoctor(args, flags);
    case "authoring-guardrails":
      return runAuthoringGuardrails(args, flags);
    case "promote-book":
      return runPromoteBook(args, flags);
    case "verify-production-package":
      return runVerifyProductionPackage(args, flags);
    case "gate-chapter":
      return runGateChapter(args);
    case "book-gate":
      return runBookGate(args);
    case "publishable-rubric":
      return runPublishableRubric();
    case "name-plan":
      return runNamePlan(args, flags);
    case "shape-plan":
      return runShapePlan(args, flags);
    case "exemplar-plan":
      return runExemplarPlan(args, flags);
    case "venue-plan":
      return runVenuePlan(args, flags);
    case "answer-key-plan":
      return runAnswerKeyPlan(args, flags);
    case "rhetoric-plan":
      return runRhetoricPlan(args, flags);
    case "pedagogy-plan":
      return runPedagogyPlan(args, flags);
    case "qc-open-round":
      return runQcOpenRound(args);
    case "qc-orchestrate":
      return runQcOrchestrate(args, flags);
    case "qc-submit":
      return runQcSubmit(args, flags);
    case "qc-schema":
      return runQcSchema(args);
    case "roles":
      return runRoles(args);
    case "qc-auto":
      return runQcAuto(args, flags);
    case "publish-after-qc":
      return runPublishAfterQc(args, flags);
    case "qc-ledger-status":
      return runQcLedgerStatus(args, flags);
    case "qc-ledger-repair":
      return runQcLedgerRepair(args, flags);
    case "qc-repair-brief":
      return runQcRepairBrief(args, flags);
    case "qc-repair-prompt":
      return runQcRepairPrompt(args, flags);
    case "qc-diagnose":
      return runQcDiagnose(args, flags);
    case "qc-metrics":
      return runQcMetrics(flags);
    case "source-v2-gate":
      return runSourceV2Gate(args, flags);
    case "qc-converge":
      return runQcConverge(args, flags);
    case "book-autopilot":
      return runBookAutopilot(args, flags);
    case "book-run":
      return (await import("./orchestrator/liveRun.js")).runLive(args, flags);
    case "compile-source-packets":
      return runCompileSourcePackets(args);
    case "source-packet-gate":
      return runSourcePacketGate(args);
    case "compile-book-design":
      return runCompileBookDesign(args);
    case "book-design-gate":
      return runBookDesignGate(args);
    case "compile-chapter-briefs":
      return runCompileChapterBriefs(args);
    case "chapter-brief-gate":
      return runChapterBriefGate(args);
    case "compile-blueprints":
      return runCompileBlueprints(args);
    case "blueprint-gate":
      return runBlueprintGate(args);
    case "deal-section-tasks":
      return runDealSectionTasks(args);
    case "validate-sections":
      return runValidateSections(args, flags);
    case "assemble-sections":
      return runAssembleSections(args);
    case "build-evidence-maps":
      return runBuildEvidenceMaps(args);
    case "evidence-gate":
      return runEvidenceGate(args);
    case "risk-score":
      return runRiskScore(args);
    case "rubric-metrics":
      return runRubricMetrics(args, flags);
    case "reader-budget-check":
      return runReaderBudgetCheck(args, flags);
    case "codex-agent-run":
      return runCodexAgentRun(args, flags);
    case "key-pack":
      return runKeyPack(args, flags);
    case "key-derive":
      return runKeyDerive(args, flags);
    case "key-resolve":
      return runKeyResolve(args, flags);
    case "bar-pack":
      return runBarPack(args, flags);
    case "bar-attest":
      return runBarAttest(args, flags);
    case "sweep-pack":
      return runSweepPack(args, flags);
    case "sweep-attest":
      return runSweepAttest(args, flags);
    case "sweep-status":
      return runSweepStatus(args);
    case "major-status":
      return runMajorStatus(args);
    case "major-disposition":
      return runMajorDisposition(args, flags);
    case "qc-attest":
      return runQcAttest(args, flags);
    case "qc-verdict":
      return runQcVerdict(args, flags);
    case "qc-status":
      return runQcStatus(args);
    case "qc-stats":
      return runQcStats(args);
    case "qc-rehash":
      return runQcRehash(args, flags);
    case "qc-run":
      return runQcRun(args, flags);
    case "quiz-judge":
      return runQuizJudge(args, flags);
    case "quiz-blind":
      return runQuizBlind(args);
    case "evidence-audit":
      return runEvidenceAudit(args);
    case "catalog-audit":
      return runCatalogAudit(args, flags);
    case "quiz-verify":
      return runQuizVerify(args, flags);
    case "fanout":
      return runFanout(args, flags);
    case "categorize":
      return runCategorize(args);
    case "register-web":
      return runRegisterWeb(args, flags);
    case "batch":
      return runBatch(args, flags);
    case "author-check":
      return runAuthorCheck(args);
    case "fix-chapter-ids":
      return runFixChapterIds(args, flags);
    case "migrate-chapter-identity":
      return runMigrateChapterIdentity(args, flags);
    case "toc-migrate":
      return runTocMigrate(args, flags);
    case "migrate-state":
      return runMigrateState(args, flags);
    case "state-status":
      return runStateStatus(args, flags);
    case "quarantine-book":
      return runQuarantineBook(args, flags);
    case "unquarantine-book":
      return runUnquarantineBook(args);
    case "eval-reader-proxy":
      return (await import("./review/evalReaderProxy.js")).runEvalReaderProxy(args, flags);
    case "eval-book-proxy":
      return (await import("./review/evalBookProxy.js")).runEvalBookProxy(args, flags);
    case "help":
    case undefined:
    case "--help":
    case "-h":
      printHelp();
      return 0;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      return 2;
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
