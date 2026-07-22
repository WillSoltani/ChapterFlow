import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const phaseContentSource = readFileSync(
  new URL("./components/ReaderPhaseContent.tsx", import.meta.url),
  "utf8",
);
const chromeSource = readFileSync(
  new URL("./components/ReaderChrome.tsx", import.meta.url),
  "utf8",
);
const overlaysSource = readFileSync(
  new URL("./components/ReaderOverlays.tsx", import.meta.url),
  "utf8",
);

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertNamedDynamicBoundary({
  source,
  localName,
  importPath,
  exportName,
}: {
  source: string;
  localName: string;
  importPath: string;
  exportName: string;
}) {
  assert.match(source, /import dynamic from "next\/dynamic";/);
  assert.doesNotMatch(
    source,
    new RegExp(`import\\s+\\{\\s*${exportName}\\s*\\}\\s+from\\s+"${escapeForRegex(importPath)}"`),
    `${exportName} must not remain a static import`,
  );
  assert.match(
    source,
    new RegExp(
      `const\\s+${localName}\\s*=\\s*dynamic\\(\\s*\\(\\)\\s*=>\\s*import\\("${escapeForRegex(importPath)}"\\)\\.then\\(\\(module\\)\\s*=>\\s*module\\.${exportName}\\)`,
    ),
    `${exportName} must use a named-export next/dynamic boundary`,
  );
}

test("reader heavy panels use named-export dynamic boundaries", () => {
  for (const boundary of [
    {
      source: phaseContentSource,
      localName: "LazyQuizPanel",
      importPath: "./QuizPanel",
      exportName: "QuizPanel",
    },
    {
      source: chromeSource,
      localName: "LazyAudioPlayer",
      importPath: "./AudioPlayer",
      exportName: "AudioPlayer",
    },
    {
      source: overlaysSource,
      localName: "LazyChapterCompleteModal",
      importPath: "./ChapterCompleteModal",
      exportName: "ChapterCompleteModal",
    },
    {
      source: overlaysSource,
      localName: "LazyConfetti",
      importPath: "@/components/ui/Confetti",
      exportName: "Confetti",
    },
    {
      source: overlaysSource,
      localName: "LazyAskBookDrawer",
      importPath: "@/app/book/components/AskBookDrawer",
      exportName: "AskBookDrawer",
    },
    {
      source: overlaysSource,
      localName: "LazyNotesDrawer",
      importPath: "./NotesDrawer",
      exportName: "NotesDrawer",
    },
    {
      source: overlaysSource,
      localName: "LazyPracticePhase",
      importPath: "./PracticePhase",
      exportName: "PracticePhase",
    },
  ]) {
    assertNamedDynamicBoundary(boundary);
  }
});

test("lazy panels stay behind the state that first makes them interactive", () => {
  assert.match(
    phaseContentSource,
    /state\.activeTab === "quiz"[\s\S]*?<LazyQuizPanel\b/,
    "the quiz chunk must wait for the quiz phase",
  );
  assert.match(
    chromeSource,
    /readerInteractionsReady\s*&&\s*\([\s\S]*?<LazyAudioPlayer\b/,
    "the audio chunk must wait until reader interactions are enabled",
  );
  assert.match(
    overlaysSource,
    /notesOpen\s*&&\s*\([\s\S]*?<LazyNotesDrawer\b/,
    "the notes chunk must wait until notes are opened",
  );
  assert.match(
    overlaysSource,
    /justPassedThisSession\s*&&\s*\([\s\S]*?<LazyConfetti\b/,
    "the celebration chunk must wait for a newly passed quiz",
  );
  assert.match(
    overlaysSource,
    /showCompleteModal\s*&&\s*\([\s\S]*?<LazyChapterCompleteModal\b[\s\S]*?<LazyPracticePhase\b/,
    "completion and practice chunks must wait for the completion modal",
  );
  assert.match(
    overlaysSource,
    /readerInteractionsReady\s*&&\s*\([\s\S]*?<LazyAskBookDrawer\b/,
    "the Ask Book chunk must wait until reader interactions are enabled",
  );
});
