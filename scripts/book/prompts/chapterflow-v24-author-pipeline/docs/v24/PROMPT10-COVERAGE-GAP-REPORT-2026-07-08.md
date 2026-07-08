# Prompt 10 — Close the coverage gap (practice-shell device + manual-brief rotation)

**Scope:** F-07 (catalog misses the most-saturated device) + F-08 (manual-brief books
skip every per-chapter VARIETY lever except the content deal).
**Branch:** `feat/anti-sameness-live-fix`. **Not pushed / not published.**
**Prerequisite:** Prompt 2 (detector hardening + revert-gating) — present on disk
(`tests/content-device-detectors.test.ts`, the narrowed regexes, `content-device-verify`).

---

## 1. Files changed

| File | Change |
|---|---|
| `src/compiler/contentDeviceDeal.ts` | +7th device `practice-shell` (union, `CONTENT_DEVICE_IDS`, catalog entry); new `PRACTICE_SHELL_RX`; new `practiceText` context surface (harvested from tryThisNow + implementationPlan weeklyPractice/24h-challenge/if-then plans); rotation math `{i,i+1,i+3} mod 6` → **mod 7 planar difference set**; snippet case for evidence logging. Declined-devices rationale documented in the `CONTENT_DEVICE_IDS` comment. |
| `src/compiler/briefRotation.ts` | Lean pure helpers `dealArchitectureFamilies` / `dealPracticeShapes` (same namespace + two-thirds cap as `dealBriefRotations`); `PRACTICE_SHAPE_EMBODIES` map + `practiceShapesForChapter` consistency filter; `dealManualBriefRotation` (resolves the filter); `manualBriefRotationLines` (the always-on card lines). Imports `dealContentDeviceBans` (no cycle). |
| `src/orchestrator/authorRun.ts` | In `buildAuthorCard`, next to the content-device deal: renders the two always-on shape lines **only when `!args.brief`** (manual-brief) and `totalChapters >= 4`. Machine-brief books are untouched. |
| `tests/content-device-detectors.test.ts` | practice-shell FP/FN matrix row (4 positives from the live corpus, 3 near-miss negatives); `practice` slot added to `chOf`. |
| `tests/content-machinery.test.ts` | `MARKER`/`chWithDevices` route practice-shell to the practice surface; `CM.practice-shell` saturated-vs-rotated test; 7-device rotation coverage test. |
| `tests/author-arch.test.ts` | Manual-brief always-on lines present; machine-brief does NOT double-deal; below-book-scale silence; determinism; **card-size worst-case < 25000** + bounded-additions assertion. |
| `tests/manual-brief-rotation.test.ts` (new) | Helpers == compiled deal (SoT); always-on line rendering; determinism; consistency filter (real pool holds by construction + synthetic-overlap mechanism proof). |

---

## 2. New catalog entry

| id | label | detector keys on | banShort | ≥3 altHints |
|---|---|---|---|---|
| `practice-shell` | recurring scheduled-ritual practice shell | `practiceText` (tryThisNow + weeklyPractice + 24h-challenge + if-then plans) matches a **fixed calendar cadence**: `each/every <weekday\|week\|day\|month\|morning\|shutdown>`, `on <weekday>s / weekends`, `weekly/daily/nightly/monthly`, `at the end of every week/day` | frame the practice as a fixed "Each Friday / every week" calendar ritual | (1) trigger moment ("the next time you catch yourself…"), (2) event anchor ("before your next handoff…"), (3) threshold ("when the count crosses…"), (4) a one-time setup |

**Declined (documented in code):** `if-then-shell` — the pipeline *deals `if-then-trigger` IN*
as a desirable practice shape up to a **two-thirds (~66%) budget that exceeds this module's
60% ubiquity cap**, so banning it as a device would contradict the shape deal and a single
if-then is legitimate; the actual on-book saturator is the *calendar* shell, which
`practice-shell` covers. `limit-paragraph` — already rotated for machine-brief books via
`LIMITS_PLACEMENTS`; no regex separates the device from a chapter legitimately noting a
limitation. `quiz-distractor-logic` — needs semantic key-vs-distractor analysis, not a regex.
Adding an 8th device would also break the clean coverage math (8 devices × 3 bans → 62.5%
present > 60%; 7 is prime so the difference set stays exact).

---

## 3. Rotation coverage (device × 14 chapters) — `{0,1,3} mod 7` planar difference set

`X` = present/allowed, `.` = banned. Exactly **3 bans/chapter**, every device present in
**exactly 8/14 = 57.1% ≤ 60%**, all seven ban-triples distinct.

```
device                  1  2  3  4  5  6  7  8  9 10 11 12 13 14  present
named-anchor-lead       .  X  X  X  .  X  .  .  X  X  X  .  X  .   8/14 (57%)
proxy-cast              .  .  X  X  X  .  X  .  .  X  X  X  .  X   8/14 (57%)
second-setting          X  .  .  X  X  X  .  X  .  .  X  X  X  .   8/14 (57%)
return-proof            .  X  .  .  X  X  X  .  X  .  .  X  X  X   8/14 (57%)
hard-detail-boundary    X  .  X  .  .  X  X  X  .  X  .  .  X  X   8/14 (57%)
three-part-split        X  X  .  X  .  .  X  X  X  .  X  .  .  X   8/14 (57%)
practice-shell          X  X  X  .  X  .  .  X  X  X  .  X  .  .   8/14 (57%)
```

---

## 4. Detector match audit — live start-with-why corpus (the F-07 evidence)

Running `detectChapterDevices` (7-device catalog) over the 14 on-disk chapters:

| device | chapters present | % |
|---|---|---|
| **practice-shell** | **14/14** | **100%** |
| named-anchor-lead | 8/14 | 57% |
| second-setting | 6/14 | 43% |
| proxy-cast | 5/14 | 36% |
| hard-detail-boundary | 5/14 | 36% |
| return-proof | 4/14 | 29% |
| three-part-split | 2/14 | 14% |

`practice-shell` is the single most saturated device on the book (F-07 estimated ~13/14; the
shape detector catches **14/14** — broader than the advisory ARCH1 `each|every`-only regex,
which missed ch04's "On Friday…" and mid-sentence "every Friday" in ch06/ch12). `contentMachinery`
now fires `CM.practice-shell` (100% ≫ 60% cap) on this book, and the deal bans it in 6/14 chapters.
Sample evidence snippets: ch01 "Each Friday, if the same fix showed up twice…", ch04 "On Friday,
if one choice still feels right…", ch12 "…every Friday and rewrite it as a return proof."

---

## 5. Card before/after — a manual-brief chapter

The always-on additions for a manual-brief book (measured on the golden-packet fixture,
chapter 3, N=14):
- Adds the `CONTENT DEVICES` deal (already always-on) **and** the new `CHAPTER SHAPE`
  section (architecture-family line + practice-shape line).
- Bounded delta vs the pre-book-scale card: **+~600 chars**, asserted `> 0 && < 1500`.
- Full manual-brief card stays **well under `AUTHOR_CARD_MAX_CHARS = 25000`** (pinned).
- Machine-brief cards are byte-identical to before (the always-on lines are gated on
  `!args.brief`; `dealBriefRotations` was **not edited** — the new helpers replicate its exact
  `dealRotation` calls, so the compiled VARIETY path is untouched, and a test pins helper ==
  compiled deal).

---

## 6. Deal ↔ practice-shape consistency

`PRACTICE_SHAPE_EMBODIES` maps a practice shape → the device it embodies; `practiceShapesForChapter`
excludes any shape whose embodied device is banned that chapter, and `dealManualBriefRotation`
substitutes off it (deterministically, walking the dealt rotation). The production map is **empty
by design**: the calendar `practice-shell` device is *orthogonal* to every shape descriptor (a
"Each Friday" shell can wrap a single-imperative or an if-then equally), so no current shape embodies
a device — the invariant holds by construction for all 14 chapters. The filter is wired + tested as a
forward guard (a synthetic-overlap test proves the substitution mechanism), so if a calendar-cadence
shape is ever added it will be filtered out of any practice-shell-banned chapter.

---

## 7. Tests + results

- **Typecheck:** clean (`tsc --noEmit`, exit 0).
- **All files importing/exercising the changed modules (isolated):**
  `content-device-verify + content-device-detectors + content-machinery + manual-brief-rotation +
  author-arch + qc-sweep-pack-content + architecture-monoculture` → **pass 101, fail 0.**
- **11 new tests** added (detector matrix +2, contentMachinery +2, author-arch +1,
  manual-brief-rotation 6).
- **Full suite:** none of the changed modules or new tests appear in the failure set. The
  suite's fail count is **environmentally unstable in this working tree** (observed 10 / 14 / 21
  across runs) — the varying failures are all in env-gated / child-process-spawning /
  filesystem-fault-injection families (`qc-attest`, `applyAuthored` session-id, CLI subprocess,
  `promote-gate`/`production-manifest` transaction injection, `source-v2`, `quiz-verify`), **none
  of which import `contentDeviceDeal` / `briefRotation` / `authorRun`.** A killed prior run + two
  concurrent test processes aggravated the flakiness; the cleanest full run landed pass 1797 /
  fail 10 with zero of my names in it.

---

## 8. Red-team checklist

- **Overfit:** ban text says "recurring scheduled ritual (an 'Each Friday…' / 'Every week…' /
  weekly-review drill)" — shape language, not Sinek/Friday-specific. Detector keys on any weekday,
  weekly/daily/monthly, and end-of-week/day — 4 near-miss negatives (trigger-anchored, event-anchored,
  one-time "today", single imperative) pass.
- **Balloon effect:** with practice-shell banned, altHints offer ≥3 genuinely different closers
  (trigger / event-anchor / threshold / one-time). Post-write verification (Prompt 2's revert gate)
  contains substitution since the detector now gates the content-device revert.
- **Voice-charter tone:** the always-on architecture line renders the campaign-2
  `ARCHITECTURE_INSTRUCTION` (structural + anti-mold: "do NOT staff a chorus of proxies…"), not a
  device mandate — tone-compatible with a manual voice charter.
- **Determinism:** all render helpers are pure functions of `(bookId, chapterNumber, totalChapters)`;
  pinned identical across re-runs (→ stable across `--only` retries).
- **Machine-brief byte-identity:** `dealBriefRotations` untouched; new helpers reuse its exact
  namespaces/caps; machine-brief card path unchanged (`!args.brief` gate).
