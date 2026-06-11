# Redo unreasonable-hospitality — CHAPTER-SPECIFIC CARD BACKS (+ 24h challenge), all 20 chapters

You are doing TWO field-level edits in **every chapter (ch01–ch20)**. Nothing
else changes. This is a targeted patch — the rest of the book is good.

> ⚠️ **The gates are BLIND to this defect for this book.** Every `chapterId` is
> capital-U (`Unreasonable-hospitality-ch01`), so `gate-chapter`'s intra-book
> AS5–AS12 sibling checks match 0 siblings and silently never run; `book-gate`
> also reports PASS. **A GREEN gate here means nothing.** The only way to verify
> this fix is the cross-chapter scan in the Done condition. Run it.

## What you change

1. `reviewCards[0].back`, `[1].back`, `[2].back`, `[4].back`, `[5].back` — in all 20 chapters.
2. `implementationPlan.twentyFourHourChallenge` — in all 20 chapters.

## What you do NOT change

- `reviewCards[*].front` — the fronts are already chapter-specific and good. Keep them.
- `reviewCards[3].back` — already chapter-specific and correct. **It is your model** (see below). Keep it.
- Everything else: `hook`, `counterintuition`, `keyTakeaway`, `breakdown.*`,
  `examples`, `quiz` (keys are correct and chapter-specific — do not touch),
  `memorableLines`, `implementationPlan.coreSkill/ifThenPlans/weeklyPractice`,
  `chapterId`, `number`, `title`. Do not add/remove chapters, cards, or questions.

## Why this redo exists

A prior repair varied the card **fronts** per chapter but left 5 of the 6 card
**backs** as a single boilerplate string copied into all 20 chapters. Result:
the backs no longer answer their own fronts.

**Evidence — `reviewCards[0/1/2/4/5].back` are byte-identical across all 20 chapters.**
For example, `reviewCards[0].back` is the SAME sentence in ch01, ch10, and ch20:
> "It requires deciding what the person should feel and changing the work so that feeling is more likely."

…even though the fronts are completely different per chapter. In ch20 ("Back to Basics") this produces a direct mismatch:
> card[0] FRONT: "Beyond adding more, what must a leader have the nerve to **remove** for an experience to improve?"
> card[0] BACK:  "It requires deciding what the person should feel and changing the work…"  ← does not answer "what to remove"
> card[5] FRONT: "Less is more sounds easy to say. What makes a team actually **cut the flourishes** that won acclaim?"
> card[5] BACK:  "It becomes practical when the team turns the lesson into a visible behavior, assigns ownership…"  ← generic; never addresses cutting

**And `twentyFourHourChallenge` has only 3 distinct values rotated across the 20 chapters:**
> chapters 1,4,7,10,13,16,19 → "Choose one real interaction and write down the intended feeling before it begins…"
> chapters 2,5,8,11,14,17,20 → "Find one routine exchange and add a receiver-focused question before closing it."
> chapters 3,6,9,12,15,18 → "Put one receiver's desired feeling on the agenda before discussing cost, timing, or ownership."

## Your model — `reviewCards[3].back` (already done right)

Card index 3 is chapter-specific and answers its front. Its backs read, per chapter:
> ch01: "assume competent execution is enough because the product is strong. That habit leaves the team with completed tasks but…"
> ch10: "keep decisions centralized and then wonder why people act like helpers. That habit leaves…"
> ch20: "add complexity to prove seriousness. That habit leaves the team with completed tasks but…"

Make cards 0,1,2,4,5 behave like card 3: a back that is specific to **this
chapter's** idea and **this card's front**.

## Files
- Chapter JSONs: `state/chapters/unreasonable-hospitality-ch{01..20}.v21-native.chapter.json`

## Rules — composition

### reviewCards backs (0,1,2,4,5)
- Read the card's **own front** and the **chapter's** `keyTakeaway` / `breakdown`.
  Write a back that directly answers *that* front using *that* chapter's specific
  idea (subtraction in ch20, giving away ownership in ch10, the service-vs-
  hospitality gap in ch01, etc.).
- **No card back may be identical or near-identical to the same card in any other
  chapter.** Across the 20 chapters, each of card 0/1/2/4/5 must have 20 distinct
  backs. Do not reuse a single template sentence with the chapter noun swapped in.
- Each back must be true and must actually answer its front (test it: read front,
  read back — does the back respond to the question asked?).
- Keep backs concise (1–2 sentences), matching the existing card register.

### twentyFourHourChallenge
- Write a challenge tied to **this chapter's** specific lesson. 20 chapters → at
  least ~15+ distinct challenges; none of the 3 current template strings may
  appear in more than one chapter.

## Procedure
1. Work chapter by chapter, ch01 → ch20.
2. After each chapter: `npx tsx src/cli.ts gate-chapter state/chapters/unreasonable-hospitality-ch{NN}.v21-native.chapter.json` → 0 blockers. (Necessary, NOT sufficient — see warning above.)
3. After all chapters: `npx tsx src/cli.ts book-gate unreasonable-hospitality` → 0 blockers.

## Done condition (the gates CANNOT verify this — the scan below is mandatory)
- Per-chapter `gate-chapter`: 0 blockers. `book-gate`: 0 blockers.
- **AND** this cross-chapter scan shows every card back distinct across all 20 chapters:
  ```bash
  node -e '
  const fs=require("fs");const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();
  const files=fs.readdirSync("state/chapters").filter(f=>/^unreasonable-hospitality-ch\d+\./.test(f)).sort();
  const byIdx={},chal=new Set();
  files.forEach(f=>{const c=require("./state/chapters/"+f);(c.reviewCards||[]).forEach((card,i)=>{(byIdx[i]=byIdx[i]||[]).push(norm(card.back));});chal.add(norm(c.implementationPlan?.twentyFourHourChallenge));});
  Object.keys(byIdx).forEach(i=>{const d=new Set(byIdx[i]).size;console.log("card["+i+"] backs: "+d+"/20 distinct"+(d<18?"  <-- FAIL":""));});
  console.log("24hChallenge: "+chal.size+"/20 distinct"+(chal.size<15?"  <-- FAIL":""));
  '
  ```
  Every `card[*] backs` line must read **20/20 distinct** (card 3 already does);
  `24hChallenge` must be ≥15/20 distinct. Any "FAIL" line means the redo is not done.
- **AND** a content read of 3 chapters (include ch01, a middle, and ch20) confirms
  each of the 5 rewritten backs answers its own front.

Report back: the scan output (the distinct counts), per-chapter blocker count,
and quote card[0] and card[5] (front + new back) from ch20 to show the mismatch is fixed.

---

### Separate note for the user (not part of this redo)
The root cause of the gate blindness is the capital-U `chapterId`. Normalizing all
`chapterId`s to lowercase (`unreasonable-hospitality-ch01`) would let the AS5–AS12
intra-book templating checks actually fire and catch this class automatically in
future — but `chapterId` is an identifier referenced elsewhere (index, sidecars,
package), so treat that as its own scoped change with its own verification, not
part of this card-back patch.
