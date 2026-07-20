import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  compareLegacyLibrarianState,
  loadLegacyLibrarianStateView,
} from "../../src/books/legacyLibrarianStateAdapter.js";
import {
  createEmptyLibraryState,
  saveLibraryStateV4,
} from "../../src/librarian/libraryState.js";
import {
  applyChapterIdentityMigrationV4,
  planChapterIdentityMigration,
} from "../../src/librarian/identityMigration.js";
import { writeAuthoringGuardrailsV4 } from "../../src/librarian/authoringGuardrails.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function writeJson(path: string, value: unknown): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

requiredTest("adapter normalizes matching legacy state in disposable roots", async ({ roots }) => {
  const legacyStateDir = resolve(roots.stateRoot, "legacy");
  const shadowStateDir = resolve(roots.tempRoot, "librarian-shadow");
  const state = createEmptyLibraryState({ now: () => 0 });
  writeJson(resolve(legacyStateDir, "library-state.json"), state);
  writeJson(resolve(shadowStateDir, "library-state.json"), { ...state, revision: 9, lastUpdatedAt: "later" });
  const result = await compareLegacyLibrarianState({ legacyStateDir, shadowStateDir, disposableRoot: roots.tempRoot });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.matched, true);
    assert.equal(result.value.selected, "LEGACY");
  }
});

requiredTest("adapter alone reports missing corrupt and stale state without mutation", async ({ roots }) => {
  const missingDir = resolve(roots.stateRoot, "missing");
  const missing = await loadLegacyLibrarianStateView({ stateDir: missingDir });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "LIBRARIAN_STATE_MISSING");
  assert.equal(existsSync(missingDir), false);

  const corruptDir = resolve(roots.stateRoot, "corrupt");
  const corruptPath = resolve(corruptDir, "library-state.json");
  mkdirSync(corruptDir, { recursive: true });
  writeFileSync(corruptPath, "{broken", "utf8");
  const corrupt = await loadLegacyLibrarianStateView({ stateDir: corruptDir });
  assert.equal(corrupt.ok, false);
  if (!corrupt.ok) assert.equal(corrupt.error.code, "LIBRARIAN_STATE_CORRUPT");
  assert.equal(readFileSync(corruptPath, "utf8"), "{broken");

  const staleDir = resolve(roots.stateRoot, "stale");
  const stale = createEmptyLibraryState({ now: () => 0 });
  stale.books.phantom = {
    bookId: "phantom", title: "Phantom", author: "", generatedAt: new Date(0).toISOString(), chapterCount: 1,
    chaptersIngested: [1], namesUsed: ["Ada"], phrasesFlagged: {}, answerPositionCounts: [0, 0, 0], chapterContributions: {},
  };
  writeJson(resolve(staleDir, "library-state.json"), stale);
  const staleResult = await loadLegacyLibrarianStateView({ stateDir: staleDir, requireFresh: true, now: () => 0 });
  assert.equal(staleResult.ok, false);
  if (!staleResult.ok) assert.equal(staleResult.error.code, "LIBRARIAN_STATE_STALE");
});

requiredTest("same-revision librarian writers serialize and commit one complete replacement", async ({ roots }) => {
  const stateDir = resolve(roots.stateRoot, "serialized");
  const left = createEmptyLibraryState({ stateDir, now: () => 0 });
  const right = createEmptyLibraryState({ stateDir, now: () => 0 });
  const settled = await Promise.allSettled([
    saveLibraryStateV4(left, { stateDir, now: () => 1 }),
    saveLibraryStateV4(right, { stateDir, now: () => 2 }),
  ]);
  const outcome = settled.map((result) => result.status === "fulfilled"
    ? "fulfilled"
    : `rejected:${String(result.reason)}`);
  assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1, outcome.join(" | "));
  assert.equal(settled.filter((result) => result.status === "rejected").length, 1);
  const stored = JSON.parse(readFileSync(resolve(stateDir, "library-state.json"), "utf8"));
  assert.equal(stored.revision, 1);
  assert.equal(stored.version, "2.0.0");
});

requiredTest("identity migration V4 route is atomic and replay-idempotent", async ({ roots }) => {
  const stateDir = resolve(roots.stateRoot, "identity");
  const chaptersDir = resolve(stateDir, "chapters");
  writeJson(resolve(chaptersDir, "Mixed-Book-ch01.v21-native.chapter.json"), {
    chapterId: "Mixed-Book-ch01", number: 1, title: "One",
  });
  writeJson(resolve(stateDir, "indexes", "mixed-book.json"), [
    { chapterId: "Mixed-Book-ch01", chapterNumber: 1, chapterTitle: "One" },
  ]);
  const plan = planChapterIdentityMigration("mixed-book", { stateDir, now: () => 0 });
  assert.equal(plan.ok, true);
  assert.equal(plan.changeCount, 1);
  const first = await applyChapterIdentityMigrationV4(plan, { stateDir, now: () => 0 });
  const second = await applyChapterIdentityMigrationV4(plan, { stateDir, now: () => 0 });
  assert.equal(first.applied.length, 1);
  assert.deepEqual(second.applied, []);
  const migrated = JSON.parse(readFileSync(resolve(chaptersDir, "mixed-book-ch01.v21-native.chapter.json"), "utf8"));
  assert.equal(migrated.chapterId, "mixed-book-ch01");
});

requiredTest("mixed-writer preflight blocks both V4 routes before any byte mutation", async ({ roots }) => {
  const migrationRoot = resolve(roots.stateRoot, "blocked-migration");
  const plan = { bookId: "blocked-book", ok: true, steps: [], ambiguities: [], indexPath: "", indexPresent: false, changeCount: 0 };
  await assert.rejects(
    applyChapterIdentityMigrationV4(plan, { stateDir: migrationRoot, legacyWriterEnabled: true }),
    /legacy same-book writer is enabled/,
  );
  assert.equal(existsSync(migrationRoot), false);

  const guardrailRoot = resolve(roots.stateRoot, "blocked-guardrail");
  await assert.rejects(
    writeAuthoringGuardrailsV4("blocked-book", { stateDir: guardrailRoot, chapters: 1, legacyWriterEnabled: true }),
    /legacy same-book writer is enabled/,
  );
  assert.equal(existsSync(guardrailRoot), false);

  const enabledRoot = resolve(roots.stateRoot, "enabled-guardrail");
  const guardrailPath = await writeAuthoringGuardrailsV4("enabled-book", { stateDir: enabledRoot, chapters: 1 });
  assert.equal(guardrailPath, resolve(enabledRoot, "guardrails", "enabled-book.guardrails.md"));
  assert.match(readFileSync(guardrailPath, "utf8"), /^# Authoring guardrails — enabled-book/);
});

requiredTest("CLI awaits V4 writer routes and passes command-scoped state root", () => {
  const cli = readFileSync(resolve(process.cwd(), "src/cli.ts"), "utf8");
  assert.match(cli, /await applyChapterIdentityMigrationV4\(plan, mopts\)/);
  assert.match(cli, /await writeAuthoringGuardrailsV4\(bookId,/);
  assert.match(cli, /process\.env\.CHAPTERFLOW_STATE_DIR/);
  assert.doesNotMatch(cli.slice(cli.indexOf("async function runMigrateChapterIdentity"), cli.indexOf("async function runGenerateBook")), /\bapplyChapterIdentityMigration\(/);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
