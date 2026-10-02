import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, page, renderChapter } from "../src/render";
import type { Chapter } from "../src/types";

function makeChapter(): Chapter & { number?: number; readingTimeMinutes?: number } {
  const q = (i: number, key: number) => ({
    questionId: `q${i}`,
    prompt: `Question ${i}?`,
    choices: [`a${i}`, `b${i}`, `c${i}`, `d${i}`],
    correctIndex: key,
    explanation: `Because ${i}.`,
    bloomsLevel: "apply",
  });
  return {
    number: 3,
    title: "Small Cues <Win>",
    hook: "Why do plans fail?",
    counterintuition: "Big plans make it worse.",
    keyTakeaway: "A tiny cue beats a big plan.",
    tryThisNow: "Pick one cue today.",
    breakdown: {
      fastRead: "Fast one.\n\nFast two.",
      deepRead: "Deep one.",
      fullRead: "Full one.\n\n\n  Full   two\nwraps here.  \n\n   \n\nFull three.",
    },
    examples: [
      { exampleId: "ex01", title: "First", tags: ["a", "b"], scenario: "Ana misses her bus.", whatToDo: "Leave early.", whyItMatters: "Time." },
      { exampleId: "ex02", title: "Second", tags: ["c"], scenario: "Ben skips lunch.", whatToDo: "Pack food.", whyItMatters: "Energy." },
      { exampleId: "ex03", title: "Third", tags: [], scenario: "Cy stalls.", whatToDo: "Start small.", whyItMatters: "Momentum." },
    ],
    quiz: { passingScorePercent: 70, questions: [q(1, 0), q(2, 1), q(3, 2), q(4, 3), q(5, 0), q(6, 1), q(7, 2)] },
    reviewCards: [{ cardId: "rc1", front: "What is a cue?", back: "A trigger.", difficulty: "easy" }],
    implementationPlan: {
      coreSkill: "Notice the cue.",
      ifThenPlans: [{ context: "When the timer rings", plan: "stand up." }],
      twentyFourHourChallenge: "Do it once.",
      weeklyPractice: "Do it daily.",
    },
    memorableLines: [{ text: '"Start tiny."' }, { text: "Cues beat plans." }],
  };
}

test("esc escapes the five HTML characters and tolerates empty values", () => {
  assert.equal(esc(`<a href="x">Tom & 'Jerry'</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#x27;Jerry&#x27;&lt;/a&gt;");
  assert.equal(esc(undefined), "");
  assert.equal(esc(null), "");
  assert.equal(esc(0), "0");
});

test("chapter text is escaped in the output", () => {
  const html = renderChapter(makeChapter(), {});
  assert.ok(html.includes("Chapter 3: Small Cues &lt;Win&gt;"));
  assert.ok(!html.includes("<Win>"));
});

test("paragraphs split on blank lines, trimmed, empties dropped, inner whitespace collapsed", () => {
  const html = renderChapter(makeChapter(), {});
  const full = html.match(/<div class="tier[^"]*" data-depth="fullRead">(.*?)<\/div>/s)?.[1];
  assert.equal(full, "<p>Full one.</p><p>Full two wraps here.</p><p>Full three.</p>");
  const fast = html.match(/<div class="tier[^"]*" data-depth="fastRead">(.*?)<\/div>/s)?.[1];
  assert.equal(fast, "<p>Fast one.</p><p>Fast two.</p>");
});

test("the default depth is the visible tier (fullRead unless told otherwise)", () => {
  const dflt = renderChapter(makeChapter(), {});
  assert.ok(dflt.includes('<div class="tier on" data-depth="fullRead">'));
  assert.ok(dflt.includes('<div class="tier " data-depth="fastRead">'));
  assert.ok(dflt.includes('<button data-depth="fullRead" class="on">'));
  const fast = renderChapter(makeChapter(), { defaultDepth: "fastRead" });
  assert.ok(fast.includes('<div class="tier on" data-depth="fastRead">'));
  assert.ok(fast.includes('<div class="tier " data-depth="fullRead">'));
  assert.equal((fast.match(/<div class="tier on"/g) ?? []).length, 1);
  assert.equal((fast.match(/<button data-depth="[a-zA-Z]+" class="on">/g) ?? []).length, 1);
});

test("depth buttons show the tier word counts", () => {
  const html = renderChapter(makeChapter(), {});
  assert.ok(html.includes("Short · 4 words"));
  assert.ok(html.includes("Standard · 2 words"));
  assert.ok(html.includes("Full · 8 words"));
});

test("quiz questions carry data-key; only the first five are open", () => {
  const html = renderChapter(makeChapter(), {});
  assert.deepEqual([...html.matchAll(/<div class="q" data-key="(\d+)">/g)].map((m) => m[1]), ["0", "1", "2", "3", "0", "1", "2"]);
  assert.ok(html.includes("A new reader answers questions 1–5."));
  assert.ok(html.includes("<details><summary>Questions 6–7 (other reading modes)</summary>"));
  assert.ok(html.includes("6. Question 6?"));
  assert.equal((html.match(/<button class="ch" data-i="3">/g) ?? []).length, 7);
  const open = html.slice(0, html.indexOf("<details><summary>Questions 6"));
  assert.equal((open.match(/<div class="q" /g) ?? []).length, 5);
  const narrow = renderChapter(makeChapter(), { newReaderQuestions: 2 });
  assert.ok(narrow.includes("Questions 3–7 (other reading modes)"));
});

test("memorable lines render once, quote marks stripped and re-wrapped", () => {
  const html = renderChapter(makeChapter(), {});
  assert.equal((html.match(/Lines worth keeping/g) ?? []).length, 1);
  assert.ok(html.includes("<blockquote>“Start tiny.”</blockquote><blockquote>“Cues beat plans.”</blockquote>"));
  assert.equal((html.match(/Start tiny\./g) ?? []).length, 1);
});

test("examples: first open, the rest behind a details; plural follows the count", () => {
  const html = renderChapter(makeChapter(), {});
  assert.ok(html.includes("<details><summary>Show 2 more examples</summary>"));
  assert.ok(html.includes('<div class="tags">a, b</div>'));
  const one = makeChapter();
  one.examples = one.examples.slice(0, 2);
  assert.ok(renderChapter(one, {}).includes("<summary>Show 1 more example</summary>"));
});

test("header, label, book line, reading time, practice and review cards", () => {
  const withTime = renderChapter({ ...makeChapter(), readingTimeMinutes: 12 }, { label: "A", bookLine: "Franklin", uid: "vA" });
  assert.ok(withTime.startsWith('<section class="version" id="vA">'));
  assert.ok(withTime.includes('<span class="vlabel">A</span>'));
  assert.ok(withTime.includes("Franklin"));
  assert.ok(withTime.includes("12 min read"));
  assert.ok(withTime.includes("1 · Summary") && withTime.includes("4 · Practice"));
  assert.ok(withTime.includes("THE ONE TAKEAWAY"));
  assert.ok(withTime.includes("<b>Core skill:</b> Notice the cue."));
  assert.ok(withTime.includes('<details class="rc"><summary>What is a cue?</summary><div>A trigger.</div></details>'));
  assert.ok(withTime.endsWith("</section>"));
  // reading time falls back to full-read words / 230, never below 1
  assert.ok(renderChapter(makeChapter(), {}).includes("1 min read"));
  assert.ok(!renderChapter(makeChapter(), {}).includes("vlabel"));
});

test("page is self-contained: charset, viewport, inline style and script, no external URLs", () => {
  const html = page("Small <Cues>", renderChapter(makeChapter(), {}));
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes('<meta charset="utf-8">'));
  assert.ok(html.includes('<meta name="viewport" content="width=device-width,initial-scale=1">'));
  assert.ok(html.includes("<title>Small &lt;Cues&gt;</title>"));
  assert.ok(html.includes("<style>") && html.includes("<script>"));
  assert.ok(!/https?:\/\//i.test(html));
  assert.ok(!/<link\b|<script[^>]*\ssrc=|<img\b|url\(|@import/i.test(html));
});

test("a sparse chapter still renders without throwing", () => {
  const html = renderChapter({ title: "Bare" } as unknown as Chapter, {});
  assert.ok(html.includes("Chapter : Bare"));
  assert.ok(html.includes("1 min read"));
});
