# ChapterFlow Achievement System — Complete Implementation Specification

**Version:** 4.0
**Date:** 2026-04-02
**Status:** Implementation-ready
**Total Core Achievements:** 50 (excluding 3 referral achievements)

---

## 1. System Architecture

### Single Unified System

After consolidation, the achievement system consists of:

| Component | File | Purpose |
|-----------|------|---------|
| **Definitions** | `app/book/badges/lib/achievement-definitions.ts` | Single source of truth for all 50 achievement definitions |
| **Types** | `app/book/badges/lib/badge-types.ts` | Unified `AchievementDefinition`, `AchievementWithProgress`, `AchievementTrack`, `AchievementTier` types |
| **Detection Engine** | `app/app/api/book/_lib/achievement-repo.ts` | Server-side detection with 5 parallel check functions |
| **Utilities** | `app/book/badges/lib/badge-utils.ts` | Level system, progress computation, icon mapping, tier colors |
| **Client Hook** | `app/book/hooks/useAchievementSystem.ts` | Replaces `useBadgeSystem.ts` — fetches earned state from server, computes progress, manages celebration |
| **API** | `app/app/api/book/me/achievements/route.ts` | GET earned achievements + showcase; PUT showcase pins |
| **UI Components** | `app/book/badges/components/*` | Rewired to consume `AchievementWithProgress` |

### Data Flow

```
User completes learning loop (passes quiz)
  → POST /api/book/me/loop-complete/[bookId]/[chapterNumber]
    → Award loop IP → Create LOOP record → Update STREAK → Update TIER
    → checkAchievementsAfterLoopComplete(ctx)
      → Promise.all([
          checkMasteryAchievements(ctx),
          checkConsistencyAchievements(ctx),
          checkExplorationAchievements(ctx),
          checkIdentityAchievements(ctx),     ← NEW
          checkHiddenAchievements(ctx),
        ])
      → For each newly earned:
          hasAchievement() → PutCommand (idempotent) → awardFlowPoints()
    → maybeAwardInsightSpark()
    → Return { achievements: AchievementAwardResult[], ... }
  → Client receives response
    → Achievement celebration renders (toast / modal / epic)
    → "Next Up" card surfaces next closest achievement
```

### Files to Delete (Phase 1)

| File | Reason |
|------|--------|
| `app/book/badges/lib/badge-data.ts` | Replaced by expanded `achievement-definitions.ts` |
| `app/book/data/mockBadges.ts` | Re-exports from deprecated `badge-data.ts` |
| `app/book/hooks/useBadgeSystem.ts` | Replaced by `useAchievementSystem.ts` |
| `app/app/api/book/me/badges/route.ts` | Replaced by `/me/achievements/route.ts` |

### localStorage Migration

On first load after deployment:

1. Read `book-accelerator:badge-earned:v1` and `cf:badge-earned-v2`
2. Map legacy badge IDs to new achievement IDs where overlap exists (e.g., `night-owl` → `night-owl`, `kindling` → `first-spark`)
3. Server records are authoritative — localStorage is used only as a client-side cache of celebration-seen state
4. Write to new key: `cf:achievements-last-seen` (timestamp for celebration gating)
5. Delete deprecated keys: `book-accelerator:badge-earned:v1`, `cf:badge-earned-v2`, `cf:badges-last-seen`
6. Migrate `cf:badge-showcase-v1` to server-persisted showcase (see Domain 10)

---

## 2. Tier Hierarchy

Five book-themed tiers replace bronze/silver/gold/platinum.

| Tier | Earn-Rate Target | Achievement Count | IP Range | Celebration Type |
|------|-----------------|-------------------|----------|-----------------|
| **Page** | ~40% of active users | 9 | 15–25 IP | Toast (5s auto-dismiss) |
| **Chapter** | ~20% of active users | 15 | 30–60 IP | Slide-up modal (6s auto-dismiss, shimmer border) |
| **Volume** | ~8% of active users | 15 | 50–100 IP | Full modal with particle burst (8s auto-dismiss) |
| **Library** | ~2% of active users | 9 | 100–250 IP | Epic modal with confetti (35 particles), typewriter narrative, manual dismiss |
| **Luminary** | <0.5% of active users | 2 | 400–500 IP | Cinematic sequence — screen dim, center-stage, extended confetti (100 particles, 5s), typewriter, share prompt, manual dismiss |

### Visual Treatment

| Tier | Glass Style | Glow | Animation | Icon Treatment |
|------|------------|------|-----------|---------------|
| **Page** | Subtle glass panel, 1px border | Soft cyan edge glow | Gentle pulse on earn | Standard emoji, soft shadow |
| **Chapter** | Layered glass, amber highlight | Warm amber bloom | Spring pop on earn | Emoji with warm glow ring |
| **Volume** | Deep glass, emerald gradient | Strong emerald bloom, floating micro-particles | Particle burst on earn | Emoji with emerald particle aura |
| **Library** | Rich glass, violet inner glow | Metallic shimmer, subtle rotation on hover | Confetti burst, slow breathe idle | Emoji with violet metallic frame |
| **Luminary** | Prismatic glass, rainbow refraction | Golden particles, breathe animation | Full cinematic sequence | Emoji with golden prismatic halo |

### Experiential Unlocks per Tier

| Tier | Unlock |
|------|--------|
| **Page** | Symbolic recognition only. No experiential unlock. |
| **Chapter** | 3 additional reading theme options (cosmetic). |
| **Volume** | Profile frame customization (3 frame styles). Reading stats export (PNG card). |
| **Library** | Early access to newly added books (48-hour preview window). Custom profile achievement badge. |
| **Luminary** | Name displayed in "Hall of Readers" section on the achievements page. Founding-reader designation on profile. |

All unlocks are cosmetic or experiential. No unlock gates reading content (HC-9).

---

## 3. Complete Achievement Catalog

### Achievement Definition Schema

```typescript
export type AchievementTrack = "mastery" | "consistency" | "exploration" | "identity" | "hidden";
export type AchievementTier = "page" | "chapter" | "volume" | "library" | "luminary";

export interface AchievementChain {
  chainId: string;
  position: number;   // 1-indexed
  nextId: string | null;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  track: AchievementTrack;
  tier: AchievementTier;
  ipValue: number;
  criteria: string;
  celebrationCopy: string;
  isHidden: boolean;
  icon: string;                              // Emoji
  chain: AchievementChain | null;
  qualityGate: { minAvgQuizAccuracy: number } | null;
  phase: 1 | 2 | 3;
}
```

---

### MASTERY TRACK (8 achievements)

Rewards comprehension depth, quiz performance, and engagement with learning features.

---

#### 1. `sharp-focus`

| Field | Value |
|-------|-------|
| **Name** | Sharp Focus |
| **Track** | mastery |
| **Tier** | page |
| **IP** | 20 |
| **Icon** | 🎯 |
| **Criteria** | Score 100% on any quiz |
| **CelebrationCopy** | "Perfect comprehension. Every concept, every nuance — you didn't miss a thing." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkMasteryAchievements()` — `ctx.latestQuizScore === 100`
**Data fields read:** `AchievementCheckContext.latestQuizScore`
**New fields required:** None

---

#### 2. `precision-reader`

| Field | Value |
|-------|-------|
| **Name** | Precision Reader |
| **Track** | mastery |
| **Tier** | volume |
| **IP** | 75 |
| **Icon** | 📐 |
| **Criteria** | Maintain an average quiz score of 85% or higher across 10 completed chapters |
| **CelebrationCopy** | "Consistent excellence across ten chapters. You don't just read — you understand." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkMasteryAchievements()` — `ctx.tier.avgQuizScoreCount >= 10 && (ctx.tier.avgQuizScoreSum / ctx.tier.avgQuizScoreCount) >= 85`
**Data fields read:** `tier.avgQuizScoreSum`, `tier.avgQuizScoreCount`
**New fields required:** None

---

#### 3. `challenge-accepted`

| Field | Value |
|-------|-------|
| **Name** | Challenge Accepted |
| **Track** | mastery |
| **Tier** | chapter |
| **IP** | 60 |
| **Icon** | ⚔️ |
| **Criteria** | Complete 10 learning loops in Challenge mode |
| **CelebrationCopy** | "Ten chapters under the hardest conditions. You chose difficulty, and you met it." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkMasteryAchievements()` — when `ctx.latestLearningMode === "challenge"`, query `countLoopsByMode(tableName, userId, "challenge") >= 10`
**Data fields read:** `ctx.latestLearningMode`, LOOP records filtered by `learningMode`
**New fields required:** None
**Bug fix:** The legacy `badge-data.ts` had a different `challenge-accepted` (exploration, "start a hard book", 20 FP). That legacy concept is dropped entirely — the new system's version is authoritative. The legacy ID collision is resolved by deleting `badge-data.ts`.

---

#### 4. `flawless-run`

| Field | Value |
|-------|-------|
| **Name** | Flawless Run |
| **Track** | mastery |
| **Tier** | volume |
| **IP** | 80 |
| **Icon** | 💎 |
| **Criteria** | Score 100% on 5 different chapter quizzes |
| **CelebrationCopy** | "Five perfect scores. This level of comprehension is genuinely rare." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkMasteryAchievements()` — when `ctx.latestQuizScore === 100`, query `countPerfectScoreLoops(tableName, userId) >= 5`
**Data fields read:** `ctx.latestQuizScore`, LOOP records filtered by `quizScore = 100`
**New fields required:** None

---

#### 5. `challenge-mastery`

| Field | Value |
|-------|-------|
| **Name** | Challenge Mastery |
| **Track** | mastery |
| **Tier** | library |
| **IP** | 150 |
| **Icon** | 👑 |
| **Criteria** | Complete every chapter of a book in Challenge mode |
| **CelebrationCopy** | "An entire book in Challenge mode. That takes more than ability — it takes resolve." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkMasteryAchievements()` — `ctx.bookCompleted && ctx.latestLearningMode === "challenge" && ctx.bookId` → query `areAllBookLoopsChallenge(tableName, userId, bookId, bookChapterCount)`
**Data fields read:** `ctx.bookCompleted`, `ctx.latestLearningMode`, `ctx.bookId`, `ctx.bookChapterCount`, LOOP records for book
**New fields required:** None

---

#### 6. `summary-scholar`

| Field | Value |
|-------|-------|
| **Name** | Summary Scholar |
| **Track** | mastery |
| **Tier** | chapter |
| **IP** | 40 |
| **Icon** | 📝 |
| **Criteria** | Complete 50 Summary steps across any books |
| **CelebrationCopy** | "Fifty chapter summaries completed. You've built a genuine foundation of knowledge across multiple domains." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 2 |

**Detection:** `checkMasteryAchievements()` — `ctx.tier.totalSummarySteps >= 50`
**Data fields read:** `tier.totalSummarySteps`
**New fields required:** `tier.totalSummarySteps: number` — increment when Summary step is marked complete in the loop-complete request. The loop-complete handler already receives the step data; add an increment to the tier update.

---

#### 7. `applied-reader`

| Field | Value |
|-------|-------|
| **Name** | Applied Reader |
| **Track** | mastery |
| **Tier** | chapter |
| **IP** | 40 |
| **Icon** | 🔬 |
| **Criteria** | View examples/scenarios in 10 different chapters |
| **CelebrationCopy** | "Ten chapters where you engaged with real-world examples. You're not just reading — you're connecting ideas to life." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkMasteryAchievements()` — `ctx.tier.chaptersWithExamplesViewed >= 10`
**Data fields read:** `tier.chaptersWithExamplesViewed`
**New fields required:** `tier.chaptersWithExamplesViewed: number` — increment on loop completion when the LOOP record indicates examples were viewed. Add `examplesViewed: boolean` to the loop-complete request body.

---

#### 8. `lens-master`

| Field | Value |
|-------|-------|
| **Name** | Lens Master |
| **Track** | mastery |
| **Tier** | chapter |
| **IP** | 35 |
| **Icon** | 🔭 |
| **Criteria** | Use all 3 lens types (Personal, School/Academic, Work/Professional) |
| **CelebrationCopy** | "All three perspectives explored. Personal, academic, professional — you understand that ideas look different from every angle." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkMasteryAchievements()` — `ctx.tier.distinctLensTypesUsed.length >= 3`
**Data fields read:** `tier.distinctLensTypesUsed`
**New fields required:** `tier.distinctLensTypesUsed: string[]` — on loop completion, if the request includes `lensType`, add to set if not already present. Add `lensType?: string` to loop-complete request body.

---

### CONSISTENCY TRACK (14 achievements)

Rewards showing up, building habits, and recovering from breaks.

---

#### 9. `first-light`

| Field | Value |
|-------|-------|
| **Name** | First Light |
| **Track** | consistency |
| **Tier** | page |
| **IP** | 15 |
| **Icon** | 🌅 |
| **Criteria** | Complete your first learning loop |
| **CelebrationCopy** | "You took the first step. The best readers started exactly where you are right now." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 2 |

**Detection:** `checkConsistencyAchievements()` — `ctx.tier.totalLoopsCompleted >= 1`
**Data fields read:** `tier.totalLoopsCompleted`
**New fields required:** None
**Design note:** Earnable within 5 minutes of first session. Implements the endowed progress effect (Kivetz et al., 2006). This is the first achievement any user earns.

---

#### 10. `first-spark`

| Field | Value |
|-------|-------|
| **Name** | First Spark |
| **Track** | consistency |
| **Tier** | page |
| **IP** | 15 |
| **Icon** | ✨ |
| **Criteria** | Reach a 3-day streak |
| **CelebrationCopy** | "Three days in a row. Every lasting habit starts exactly like this." |
| **Hidden** | false |
| **Chain** | `{ chainId: "streak", position: 1, nextId: "weekly-rhythm" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkConsistencyAchievements()` — `ctx.streak.currentStreak >= 3`
**Data fields read:** `streak.currentStreak`
**New fields required:** None

---

#### 11. `weekly-rhythm`

| Field | Value |
|-------|-------|
| **Name** | Weekly Rhythm |
| **Track** | consistency |
| **Tier** | page |
| **IP** | 30 |
| **Icon** | 🔥 |
| **Criteria** | Reach a 7-day streak |
| **CelebrationCopy** | "One full week of choosing to learn. The rhythm is real now." |
| **Hidden** | false |
| **Chain** | `{ chainId: "streak", position: 2, nextId: "fortnight-focus" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkConsistencyAchievements()` — `ctx.streak.currentStreak >= 7`
**Data fields read:** `streak.currentStreak`
**New fields required:** None

---

#### 12. `fortnight-focus`

| Field | Value |
|-------|-------|
| **Name** | Fortnight Focus |
| **Track** | consistency |
| **Tier** | chapter |
| **IP** | 45 |
| **Icon** | 🔥 |
| **Criteria** | Reach a 14-day streak |
| **CelebrationCopy** | "Two weeks of consistent reading. At this point, it's not discipline anymore — it's becoming who you are." |
| **Hidden** | false |
| **Chain** | `{ chainId: "streak", position: 3, nextId: "monthly-discipline" }` |
| **Quality Gate** | null |
| **Phase** | 2 |

**Detection:** `checkConsistencyAchievements()` — `ctx.streak.currentStreak >= 14`
**Data fields read:** `streak.currentStreak`
**New fields required:** None

---

#### 13. `monthly-discipline`

| Field | Value |
|-------|-------|
| **Name** | Monthly Discipline |
| **Track** | consistency |
| **Tier** | volume |
| **IP** | 75 |
| **Icon** | 🔥 |
| **Criteria** | Reach a 30-day streak |
| **CelebrationCopy** | "Thirty days. The research is clear — this is a habit, not a streak." |
| **Hidden** | false |
| **Chain** | `{ chainId: "streak", position: 4, nextId: "centurion" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkConsistencyAchievements()` — `ctx.streak.currentStreak >= 30`
**Data fields read:** `streak.currentStreak`
**New fields required:** None

---

#### 14. `centurion`

| Field | Value |
|-------|-------|
| **Name** | Centurion |
| **Track** | consistency |
| **Tier** | library |
| **IP** | 200 |
| **Icon** | 🔥 |
| **Criteria** | Reach a 100-day streak |
| **CelebrationCopy** | "One hundred days. Most people set goals. You built a practice." |
| **Hidden** | false |
| **Chain** | `{ chainId: "streak", position: 5, nextId: "bicentennial" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkConsistencyAchievements()` — `ctx.streak.currentStreak >= 100`
**Data fields read:** `streak.currentStreak`
**New fields required:** None

---

#### 15. `bicentennial`

| Field | Value |
|-------|-------|
| **Name** | Bicentennial |
| **Track** | consistency |
| **Tier** | library |
| **IP** | 300 |
| **Icon** | 🔥 |
| **Criteria** | Reach a 200-day streak |
| **CelebrationCopy** | "Two hundred days. What started as a decision has become a defining practice. Very few readers reach this level of sustained focus." |
| **Hidden** | false |
| **Chain** | `{ chainId: "streak", position: 6, nextId: "year-of-insight" }` |
| **Quality Gate** | null |
| **Phase** | 2 |

**Detection:** `checkConsistencyAchievements()` — `ctx.streak.currentStreak >= 200`
**Data fields read:** `streak.currentStreak`
**New fields required:** None

---

#### 16. `year-of-insight`

| Field | Value |
|-------|-------|
| **Name** | Year of Insight |
| **Track** | consistency |
| **Tier** | luminary |
| **IP** | 500 |
| **Icon** | 🌟 |
| **Criteria** | Reach a 365-day streak |
| **CelebrationCopy** | "Three hundred sixty-five days. A full year of deliberate curiosity. Extraordinary." |
| **Hidden** | false |
| **Chain** | `{ chainId: "streak", position: 7, nextId: null }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkConsistencyAchievements()` — `ctx.streak.currentStreak >= 365`
**Data fields read:** `streak.currentStreak`
**New fields required:** None

---

#### 17. `steady-state`

| Field | Value |
|-------|-------|
| **Name** | Steady State |
| **Track** | consistency |
| **Tier** | volume |
| **IP** | 50 |
| **Icon** | ⚖️ |
| **Criteria** | Maintain 80%+ consistency score for 60 consecutive days |
| **CelebrationCopy** | "Sixty days above eighty percent. You don't need a perfect streak — you just keep showing up." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkConsistencyAchievements()` — if `ctx.streak.consistencyAbove80Since`, calculate `daysSince = floor((now - Date(consistencyAbove80Since)) / 86400000)`, award if `>= 60`
**Data fields read:** `streak.consistencyAbove80Since`
**New fields required:** None

---

#### 18. `active-reader`

| Field | Value |
|-------|-------|
| **Name** | Active Reader |
| **Track** | consistency |
| **Tier** | page |
| **IP** | 20 |
| **Icon** | 📖 |
| **Criteria** | Read on 10 distinct days |
| **CelebrationCopy** | "Ten days of choosing to read. You're building something — not just a habit, but a track record." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkConsistencyAchievements()` — `ctx.tier.totalActiveDays >= 10`
**Data fields read:** `tier.totalActiveDays`
**New fields required:** `tier.totalActiveDays: number` — increment on loop completion when a new READINGDAY record is created (i.e., first loop of the day). The streak-repo already creates READINGDAY records; add a counter to the tier update.

---

#### 19. `comeback-reader`

| Field | Value |
|-------|-------|
| **Name** | Comeback Reader |
| **Track** | consistency |
| **Tier** | page |
| **IP** | 20 |
| **Icon** | 🔄 |
| **Criteria** | Return to reading within 2 days of missing a day |
| **CelebrationCopy** | "You missed a day and came right back. That's not failure — that's resilience. The best streaks have bumps." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkConsistencyAchievements()` — when streak was broken and then restarted within the same loop-complete call, check if `ctx.streak.shieldUsedDates` includes today or yesterday (meaning a shield bridged a gap), OR if the streak gap was exactly 2 days and the user completed a loop (streak reset to 1 but within recovery window). More precisely: pass `ctx.streakGapDays` from the streak update result; award if `streakGapDays === 2` (missed exactly 1 day, came back the next).
**Data fields read:** `ctx.streakGapDays` (gap between last active date and today)
**New fields required:** Add `streakGapDays?: number` to `AchievementCheckContext` — populated from the streak update result.

---

#### 20. `weekend-warrior`

| Field | Value |
|-------|-------|
| **Name** | Weekend Warrior |
| **Track** | consistency |
| **Tier** | chapter |
| **IP** | 30 |
| **Icon** | 🏖️ |
| **Criteria** | Complete learning loops on both Saturday and Sunday of the same weekend |
| **CelebrationCopy** | "Both days of the weekend, spent learning. When you read on your own time, it means something different." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 2 |

**Detection:** `checkConsistencyAchievements()` — determine today's day-of-week in `ctx.userTimezone`. If Saturday, check if a READINGDAY record exists for tomorrow (Sunday) — skip (can't know future). If Sunday, check if a READINGDAY record exists for yesterday (Saturday). If today is Sunday and yesterday's READINGDAY exists, award.
**Data fields read:** `ctx.loopCompletedAt`, `ctx.userTimezone`, READINGDAY records
**New fields required:** None (uses existing READINGDAY records)

---

#### 21. `active-month-i`

| Field | Value |
|-------|-------|
| **Name** | Active Month |
| **Track** | consistency |
| **Tier** | page |
| **IP** | 20 |
| **Icon** | 📅 |
| **Criteria** | Read on 15 distinct days in a single calendar month |
| **CelebrationCopy** | "Fifteen days this month. More than half the month, you chose to read. That's a serious reading life." |
| **Hidden** | false |
| **Chain** | `{ chainId: "monthly-active", position: 1, nextId: "active-month-ii" }` |
| **Quality Gate** | null |
| **Phase** | 2 |

**Detection:** `checkConsistencyAchievements()` — `ctx.tier.currentMonthActiveDays >= 15` where `currentMonthKey` matches current month
**Data fields read:** `tier.currentMonthActiveDays`, `tier.currentMonthKey`
**New fields required:** `tier.currentMonthActiveDays: number` (reset to 0 when month changes), `tier.currentMonthKey: string` (format: `"2026-04"`). On loop completion: if `currentMonthKey !== currentMonth`, reset counter to 1 and update key; else increment.

---

#### 22. `active-month-ii`

| Field | Value |
|-------|-------|
| **Name** | Active Month Pro |
| **Track** | consistency |
| **Tier** | chapter |
| **IP** | 40 |
| **Icon** | 📅 |
| **Criteria** | Read on 25 distinct days in a single calendar month |
| **CelebrationCopy** | "Twenty-five days this month. You read almost every single day. This is what sustained intellectual curiosity looks like." |
| **Hidden** | false |
| **Chain** | `{ chainId: "monthly-active", position: 2, nextId: null }` |
| **Quality Gate** | null |
| **Phase** | 2 |

**Detection:** `checkConsistencyAchievements()` — `ctx.tier.currentMonthActiveDays >= 25`
**Data fields read:** `tier.currentMonthActiveDays`, `tier.currentMonthKey`
**New fields required:** Same as `active-month-i`

---

### EXPLORATION TRACK (8 achievements)

Rewards breadth across categories and depth within categories.

---

#### 23. `curious-mind`

| Field | Value |
|-------|-------|
| **Name** | Curious Mind |
| **Track** | exploration |
| **Tier** | page |
| **IP** | 25 |
| **Icon** | 🧭 |
| **Criteria** | Complete loops in 3 different categories |
| **CelebrationCopy** | "Three different domains. Curiosity doesn't stay in one lane — neither do you." |
| **Hidden** | false |
| **Chain** | `{ chainId: "exploration-breadth", position: 1, nextId: "cross-disciplinary" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkExplorationAchievements()` — `ctx.tier.categoriesExplored.length >= 3`
**Data fields read:** `tier.categoriesExplored`
**New fields required:** None

---

#### 24. `cross-disciplinary`

| Field | Value |
|-------|-------|
| **Name** | Cross-Disciplinary |
| **Track** | exploration |
| **Tier** | volume |
| **IP** | 50 |
| **Icon** | 🌐 |
| **Criteria** | Complete loops in 7 different categories |
| **CelebrationCopy** | "Seven categories. You're building the kind of broad foundation that makes deep work possible." |
| **Hidden** | false |
| **Chain** | `{ chainId: "exploration-breadth", position: 2, nextId: "renaissance-reader" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkExplorationAchievements()` — `ctx.tier.categoriesExplored.length >= 7`
**Data fields read:** `tier.categoriesExplored`
**New fields required:** None

---

#### 25. `renaissance-reader`

| Field | Value |
|-------|-------|
| **Name** | Renaissance Reader |
| **Track** | exploration |
| **Tier** | library |
| **IP** | 100 |
| **Icon** | 🎨 |
| **Criteria** | Complete loops in 12 different categories |
| **CelebrationCopy** | "Twelve domains. The connections between fields — that's where the real insights live." |
| **Hidden** | false |
| **Chain** | `{ chainId: "exploration-breadth", position: 3, nextId: "omnivore" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkExplorationAchievements()` — `ctx.tier.categoriesExplored.length >= 12`
**Data fields read:** `tier.categoriesExplored`
**New fields required:** None

---

#### 26. `omnivore`

| Field | Value |
|-------|-------|
| **Name** | Omnivore |
| **Track** | exploration |
| **Tier** | library |
| **IP** | 150 |
| **Icon** | 🦉 |
| **Criteria** | Complete loops in 18 or more different categories |
| **CelebrationCopy** | "Eighteen categories. Very few readers venture this wide. The mental models you're accumulating are compounding." |
| **Hidden** | false |
| **Chain** | `{ chainId: "exploration-breadth", position: 4, nextId: null }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkExplorationAchievements()` — `ctx.tier.categoriesExplored.length >= 18`
**Data fields read:** `tier.categoriesExplored`
**New fields required:** None

---

#### 27. `bridge-builder`

| Field | Value |
|-------|-------|
| **Name** | Bridge Builder |
| **Track** | exploration |
| **Tier** | volume |
| **IP** | 60 |
| **Icon** | 🌉 |
| **Criteria** | Complete 3 entire books across 3 different categories with ≥70% quiz accuracy |
| **CelebrationCopy** | "Three books across three domains. You don't just sample — you finish." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | `{ minAvgQuizAccuracy: 70 }` |
| **Phase** | 1 |

**Detection:** `checkExplorationAchievements()` — `ctx.bookCompleted && ctx.completedBooksInDistinctCategories >= 3`. The `completedBooksInDistinctCategories` count must only include books where the user's average quiz accuracy met the 70% threshold.
**Data fields read:** `ctx.bookCompleted`, `ctx.completedBooksInDistinctCategories`
**New fields required:** Modify the existing `completedBooksInDistinctCategories` computation in the loop-complete handler to filter by `avgQuizAccuracy >= 70`.

---

#### 28. `deep-diver-i`

| Field | Value |
|-------|-------|
| **Name** | Deep Diver I |
| **Track** | exploration |
| **Tier** | chapter |
| **IP** | 40 |
| **Icon** | 🤿 |
| **Criteria** | Complete 3 books in a single category with ≥70% quiz accuracy each |
| **CelebrationCopy** | "Three books in one category. You're moving past surface knowledge into genuine domain understanding." |
| **Hidden** | false |
| **Chain** | `{ chainId: "category-depth", position: 1, nextId: "deep-diver-ii" }` |
| **Quality Gate** | `{ minAvgQuizAccuracy: 70 }` |
| **Phase** | 2 |

**Detection:** `checkExplorationAchievements()` — `ctx.bookCompleted` → query `tier.completedBooksByCategory` → find any category where count >= 3
**Data fields read:** `tier.completedBooksByCategory`
**New fields required:** `tier.completedBooksByCategory: Record<string, number>` — on book completion with `avgQuizAccuracy >= 70`, increment the count for that book's category. Populated from the category passed in `ctx.bookCategory`.

---

#### 29. `deep-diver-ii`

| Field | Value |
|-------|-------|
| **Name** | Deep Diver II |
| **Track** | exploration |
| **Tier** | volume |
| **IP** | 70 |
| **Icon** | 🤿 |
| **Criteria** | Complete 5 books in a single category with ≥70% quiz accuracy each |
| **CelebrationCopy** | "Five books deep in a single category. At this level, you're developing real expertise." |
| **Hidden** | false |
| **Chain** | `{ chainId: "category-depth", position: 2, nextId: "category-master" }` |
| **Quality Gate** | `{ minAvgQuizAccuracy: 70 }` |
| **Phase** | 2 |

**Detection:** `checkExplorationAchievements()` — find any category in `tier.completedBooksByCategory` where count >= 5
**Data fields read:** `tier.completedBooksByCategory`
**New fields required:** Same as `deep-diver-i`

---

#### 30. `category-master`

| Field | Value |
|-------|-------|
| **Name** | Category Master |
| **Track** | exploration |
| **Tier** | library |
| **IP** | 120 |
| **Icon** | 🏛️ |
| **Criteria** | Complete every book in a single category with ≥70% quiz accuracy each |
| **CelebrationCopy** | "Every book in the category, completed. Within this domain, you've left nothing unread." |
| **Hidden** | false |
| **Chain** | `{ chainId: "category-depth", position: 3, nextId: null }` |
| **Quality Gate** | `{ minAvgQuizAccuracy: 70 }` |
| **Phase** | 2 |

**Detection:** `checkExplorationAchievements()` — on book completion, check if `tier.completedBooksByCategory[category] >= totalBooksInCategory`. Requires a lookup of total books per category from the book catalog.
**Data fields read:** `tier.completedBooksByCategory`, book catalog metadata
**New fields required:** Pass `ctx.totalBooksInCategory` from the loop-complete handler (derived from `BOOKS_CATALOG`).

---

### IDENTITY TRACK (11 achievements)

Rewards milestones that define the reader's identity — book completions, note-taking, and reflection habits.

---

#### 31. `cover-to-cover`

| Field | Value |
|-------|-------|
| **Name** | Cover to Cover |
| **Track** | identity |
| **Tier** | chapter |
| **IP** | 50 |
| **Icon** | 📗 |
| **Criteria** | Complete your first book with ≥70% average quiz accuracy |
| **CelebrationCopy** | "Your first book, completed with real comprehension. Most people start books. You finished one." |
| **Hidden** | false |
| **Chain** | `{ chainId: "book-completion", position: 1, nextId: "shelf-builder" }` |
| **Quality Gate** | `{ minAvgQuizAccuracy: 70 }` |
| **Phase** | 1 |

**Detection:** `checkIdentityAchievements()` — `ctx.bookCompleted && ctx.bookAvgQuizAccuracy >= 70 && ctx.tier.booksCompleted70Plus >= 1`
**Data fields read:** `ctx.bookCompleted`, `ctx.bookAvgQuizAccuracy`, `tier.booksCompleted70Plus`
**New fields required:** `tier.booksCompleted70Plus: number` — increment on book completion when average quiz accuracy across all book chapters is ≥70%. Add `ctx.bookAvgQuizAccuracy: number` to `AchievementCheckContext` — computed in the loop-complete handler by averaging all LOOP quizScores for the completed book.

---

#### 32. `shelf-builder`

| Field | Value |
|-------|-------|
| **Name** | Shelf Builder |
| **Track** | identity |
| **Tier** | volume |
| **IP** | 65 |
| **Icon** | 📚 |
| **Criteria** | Complete 3 books with ≥70% average quiz accuracy each |
| **CelebrationCopy** | "Three books completed with demonstrated understanding. You're building a real reading practice." |
| **Hidden** | false |
| **Chain** | `{ chainId: "book-completion", position: 2, nextId: "dedicated-reader" }` |
| **Quality Gate** | `{ minAvgQuizAccuracy: 70 }` |
| **Phase** | 1 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.booksCompleted70Plus >= 3`
**Data fields read:** `tier.booksCompleted70Plus`
**New fields required:** Same as `cover-to-cover`

---

#### 33. `dedicated-reader`

| Field | Value |
|-------|-------|
| **Name** | Dedicated Reader |
| **Track** | identity |
| **Tier** | volume |
| **IP** | 100 |
| **Icon** | 📖 |
| **Criteria** | Complete 10 books with ≥75% average quiz accuracy each |
| **CelebrationCopy** | "Ten books. Ten complete journeys through ideas, proven by your comprehension scores. You are a serious reader." |
| **Hidden** | false |
| **Chain** | `{ chainId: "book-completion", position: 3, nextId: "bibliophile" }` |
| **Quality Gate** | `{ minAvgQuizAccuracy: 75 }` |
| **Phase** | 2 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.booksCompleted75Plus >= 10`
**Data fields read:** `tier.booksCompleted75Plus`
**New fields required:** `tier.booksCompleted75Plus: number` — increment on book completion when average quiz accuracy across all book chapters is ≥75%.

---

#### 34. `bibliophile`

| Field | Value |
|-------|-------|
| **Name** | Bibliophile |
| **Track** | identity |
| **Tier** | library |
| **IP** | 175 |
| **Icon** | 🏆 |
| **Criteria** | Complete 25 books with ≥75% average quiz accuracy each |
| **CelebrationCopy** | "Twenty-five books with sustained excellence. This isn't casual reading — this is a disciplined intellectual practice." |
| **Hidden** | false |
| **Chain** | `{ chainId: "book-completion", position: 4, nextId: "grand-bibliophile" }` |
| **Quality Gate** | `{ minAvgQuizAccuracy: 75 }` |
| **Phase** | 2 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.booksCompleted75Plus >= 25`
**Data fields read:** `tier.booksCompleted75Plus`
**New fields required:** Same as `dedicated-reader`

---

#### 35. `grand-bibliophile`

| Field | Value |
|-------|-------|
| **Name** | Grand Bibliophile |
| **Track** | identity |
| **Tier** | library |
| **IP** | 250 |
| **Icon** | 🏆 |
| **Criteria** | Complete 50 books with ≥75% average quiz accuracy each |
| **CelebrationCopy** | "Fifty books. The breadth and depth of understanding you've built is genuinely remarkable." |
| **Hidden** | false |
| **Chain** | `{ chainId: "book-completion", position: 5, nextId: null }` |
| **Quality Gate** | `{ minAvgQuizAccuracy: 75 }` |
| **Phase** | 2 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.booksCompleted75Plus >= 50`
**Data fields read:** `tier.booksCompleted75Plus`
**New fields required:** Same as `dedicated-reader`

---

#### 36. `year-of-reading`

| Field | Value |
|-------|-------|
| **Name** | Year of Reading |
| **Track** | identity |
| **Tier** | library |
| **IP** | 150 |
| **Icon** | 🗓️ |
| **Criteria** | Complete 12 books in a single calendar year with ≥70% quiz accuracy each |
| **CelebrationCopy** | "Twelve books in one year. A book a month, each one completed with real comprehension. That's a reader's year." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | `{ minAvgQuizAccuracy: 70 }` |
| **Phase** | 2 |

**Detection:** `checkIdentityAchievements()` — `ctx.bookCompleted && ctx.tier.booksCompletedThisYear >= 12` where `currentYearKey` matches current year
**Data fields read:** `tier.booksCompletedThisYear`, `tier.currentYearKey`
**New fields required:** `tier.booksCompletedThisYear: number` — increment on quality-gated book completion. `tier.currentYearKey: string` (format: `"2026"`). On book completion: if `currentYearKey !== currentYear`, reset counter to 1 and update key; else increment.

---

#### 37. `first-ink`

| Field | Value |
|-------|-------|
| **Name** | First Ink |
| **Track** | identity |
| **Tier** | page |
| **IP** | 15 |
| **Icon** | ✏️ |
| **Criteria** | Save your first note |
| **CelebrationCopy** | "Your first note. Writing things down changes how you remember them — that's not folklore, it's neuroscience." |
| **Hidden** | false |
| **Chain** | `{ chainId: "notes", position: 1, nextId: "deep-thought" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.totalNotesCount >= 1`
**Data fields read:** `tier.totalNotesCount`
**New fields required:** `tier.totalNotesCount: number` — increment when a note is saved. Requires a note-save action to update the tier record (either via the note-save API or via the loop-complete handler if notes are saved as part of the loop).

---

#### 38. `deep-thought`

| Field | Value |
|-------|-------|
| **Name** | Deep Thought |
| **Track** | identity |
| **Tier** | chapter |
| **IP** | 35 |
| **Icon** | 🧠 |
| **Criteria** | Save 5 notes of 100 or more characters |
| **CelebrationCopy** | "Five substantial reflections. You're not skimming — you're processing ideas deeply enough to articulate them." |
| **Hidden** | false |
| **Chain** | `{ chainId: "notes", position: 2, nextId: "the-annotator" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.substantialNotesCount >= 5`
**Data fields read:** `tier.substantialNotesCount`
**New fields required:** `tier.substantialNotesCount: number` — increment when a note of ≥100 characters is saved.

---

#### 39. `the-annotator`

| Field | Value |
|-------|-------|
| **Name** | The Annotator |
| **Track** | identity |
| **Tier** | volume |
| **IP** | 60 |
| **Icon** | 🖊️ |
| **Criteria** | Save notes across 10 different chapters |
| **CelebrationCopy** | "Notes in ten different chapters. You're building a personal knowledge base, one chapter at a time." |
| **Hidden** | false |
| **Chain** | `{ chainId: "notes", position: 3, nextId: "cross-book-notes" }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.distinctChaptersWithNotes >= 10`
**Data fields read:** `tier.distinctChaptersWithNotes`
**New fields required:** `tier.distinctChaptersWithNotes: number` — increment when saving a note in a chapter that has no previous notes. Track via a set or by checking NOTE records on save.

---

#### 40. `cross-book-notes`

| Field | Value |
|-------|-------|
| **Name** | Cross-Book Notes |
| **Track** | identity |
| **Tier** | volume |
| **IP** | 70 |
| **Icon** | 📓 |
| **Criteria** | Save notes in 3 different books |
| **CelebrationCopy** | "Notes across three books. You're weaving connections between ideas that most readers never see." |
| **Hidden** | false |
| **Chain** | `{ chainId: "notes", position: 4, nextId: null }` |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.distinctBooksWithNotes >= 3`
**Data fields read:** `tier.distinctBooksWithNotes`
**New fields required:** `tier.distinctBooksWithNotes: number` — increment when saving a note in a book that has no previous notes. Track via a set or by checking NOTE records on save.

---

#### 41. `reflection-closer`

| Field | Value |
|-------|-------|
| **Name** | Reflection Closer |
| **Track** | identity |
| **Tier** | volume |
| **IP** | 55 |
| **Icon** | 💭 |
| **Criteria** | Complete 5 chapters where you saved a note after finishing the quiz |
| **CelebrationCopy** | "Five chapters closed with a written reflection. The gap between reading and understanding — you're bridging it." |
| **Hidden** | false |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkIdentityAchievements()` — `ctx.tier.chaptersWithReflectionNotes >= 5`
**Data fields read:** `tier.chaptersWithReflectionNotes`
**New fields required:** `tier.chaptersWithReflectionNotes: number` — increment when a note is saved for a chapter that has already been completed (LOOP record exists). This requires checking note-save timing relative to loop completion.

---

### HIDDEN TRACK (9 achievements)

Surprise achievements discovered through behavioral patterns. Not visible until earned. Detection is server-side and fully implemented.

---

#### 42. `night-owl`

| Field | Value |
|-------|-------|
| **Name** | Night Owl |
| **Track** | hidden |
| **Tier** | chapter |
| **IP** | 30 |
| **Icon** | 🦉 |
| **Criteria** | Complete 5 learning loops between 10pm and 5am (local time) |
| **CelebrationCopy** | "Discovery: Night Owl. Some of the best thinking happens when the world is quiet." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkHiddenAchievements()` — when `ctx.loopCompletedAt && ctx.userTimezone`, compute hour via `getHourInTimezone()`. If hour >= 22 or hour < 5, query `tier.nightLoopCount >= 5`.
**Data fields read:** `ctx.loopCompletedAt`, `ctx.userTimezone`, `tier.nightLoopCount`
**New fields required:** `tier.nightLoopCount: number` — increment on loop completion when the local hour is >= 22 or < 5. **This replaces the current O(n) full-LOOP-table scan** with an O(1) counter check, fixing the performance issue.

**Migration:** On deploy, backfill `nightLoopCount` for existing users by scanning their LOOP records once.

---

#### 43. `dawn-reader`

| Field | Value |
|-------|-------|
| **Name** | Dawn Reader |
| **Track** | hidden |
| **Tier** | chapter |
| **IP** | 30 |
| **Icon** | 🌄 |
| **Criteria** | Complete 5 learning loops between 5am and 7am (local time) |
| **CelebrationCopy** | "Discovery: Dawn Reader. Starting the day with learning — there's something powerful in that." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkHiddenAchievements()` — when hour >= 5 and hour < 7, check `tier.dawnLoopCount >= 5`
**Data fields read:** `tier.dawnLoopCount`
**New fields required:** `tier.dawnLoopCount: number` — increment on loop completion when local hour is >= 5 and < 7. **Replaces O(n) scan.**

---

#### 44. `weekend-scholar`

| Field | Value |
|-------|-------|
| **Name** | Weekend Scholar |
| **Track** | hidden |
| **Tier** | volume |
| **IP** | 40 |
| **Icon** | 📚 |
| **Criteria** | Complete loops on 8 consecutive weekend days (4 weekends in a row) |
| **CelebrationCopy** | "Discovery: Weekend Scholar. While others rest, you chose to grow." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkHiddenAchievements()` — query READINGDAY records, filter to weekend days (Sat/Sun), check for 8 consecutive weekend days using existing `countConsecutiveWeekendDays()` logic.
**Data fields read:** READINGDAY records
**New fields required:** None (existing logic works)

---

#### 45. `marathon-session`

| Field | Value |
|-------|-------|
| **Name** | Marathon Session |
| **Track** | hidden |
| **Tier** | chapter |
| **IP** | 35 |
| **Icon** | 🏃 |
| **Criteria** | Complete 5 learning loops in a single calendar day |
| **CelebrationCopy** | "Discovery: Marathon Session. Five chapters in one sitting — that's genuine immersion." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkHiddenAchievements()` — compute today's date string via `getTodayStr(ctx.userTimezone)`, query `countLoopsOnDate(tableName, userId, todayStr) >= 5`
**Data fields read:** `ctx.userTimezone`, LOOP records filtered by `completedAt` date
**New fields required:** None

---

#### 46. `full-circle`

| Field | Value |
|-------|-------|
| **Name** | Full Circle |
| **Track** | hidden |
| **Tier** | volume |
| **IP** | 45 |
| **Icon** | 🔄 |
| **Criteria** | Finish a book that was started more than 90 days ago |
| **CelebrationCopy** | "Discovery: Full Circle. You came back and finished what you started. Most people don't." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkHiddenAchievements()` — `ctx.bookCompleted && ctx.bookStartedAt` → compute `daysSinceStart = floor((now - Date(bookStartedAt)) / 86400000)` → award if `>= 90`
**Data fields read:** `ctx.bookCompleted`, `ctx.bookStartedAt`
**New fields required:** None

---

#### 47. `second-wind`

| Field | Value |
|-------|-------|
| **Name** | Second Wind |
| **Track** | hidden |
| **Tier** | page |
| **IP** | 25 |
| **Icon** | 💨 |
| **Criteria** | Complete a learning loop after 14 or more consecutive days of inactivity |
| **CelebrationCopy** | "Discovery: Second Wind. Coming back is harder than starting. Welcome back." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkHiddenAchievements()` — `ctx.inactiveDaysBeforeReturn >= 14`
**Data fields read:** `ctx.inactiveDaysBeforeReturn`
**New fields required:** `inactiveDaysBeforeReturn?: number` on `AchievementCheckContext`. Populated in the loop-complete handler: before the streak update, compute the gap between the streak's `lastActiveDate` and today. If `lastActiveDate` is null (new user), this is 0. Pass the raw gap days to the achievement context.

**BUG FIX:** This replaces the current stubbed logic at `achievement-repo.ts:362-374` which contains only comments and no `awardAchievement()` call. The fix adds:
```typescript
if (ctx.inactiveDaysBeforeReturn !== undefined && ctx.inactiveDaysBeforeReturn >= 14) {
  const r = await awardAchievement(ctx.tableName, ctx.userId, "second-wind");
  if (r) results.push(r);
}
```

---

#### 48. `century-loop`

| Field | Value |
|-------|-------|
| **Name** | Century Loop |
| **Track** | hidden |
| **Tier** | volume |
| **IP** | 50 |
| **Icon** | 💯 |
| **Criteria** | Complete your 100th learning loop |
| **CelebrationCopy** | "Discovery: Century Loop. One hundred chapters of genuine understanding. Milestone unlocked." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | null |
| **Phase** | 1 |

**Detection:** `checkHiddenAchievements()` — `ctx.tier.totalLoopsCompleted >= 100`
**Data fields read:** `tier.totalLoopsCompleted`
**New fields required:** None
**Bug fix (minor):** Change current `=== 100` to `>= 100` to prevent race condition where two loops complete rapidly and skip exactly 100.

---

#### 49. `speed-scholar`

| Field | Value |
|-------|-------|
| **Name** | Speed Scholar |
| **Track** | hidden |
| **Tier** | chapter |
| **IP** | 30 |
| **Icon** | ⚡ |
| **Criteria** | Complete a full learning loop (all 4 steps) in under 10 minutes while passing the quiz |
| **CelebrationCopy** | "Discovery: Speed Scholar. A complete chapter in under ten minutes — sometimes understanding just clicks." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | Must pass quiz (implicit — loop completion requires quiz pass) |
| **Phase** | 1 |

**Detection:** `checkHiddenAchievements()` — `ctx.loopDurationSeconds !== undefined && ctx.loopDurationSeconds < 600`
**Data fields read:** `ctx.loopDurationSeconds`
**New fields required:** `loopDurationSeconds?: number` on `AchievementCheckContext`. Add `loopStartedAt?: string` (ISO timestamp) to the loop-complete request body. In the handler, compute `durationSeconds = (Date(completedAt) - Date(loopStartedAt)) / 1000`. Pass to context if > 60 seconds (filter out sub-minute anomalies, see Anti-Abuse section).

---

#### 50. `the-librarian`

| Field | Value |
|-------|-------|
| **Name** | The Librarian |
| **Track** | hidden |
| **Tier** | luminary |
| **IP** | 500 |
| **Icon** | 🏛️ |
| **Criteria** | Complete every book in the library with ≥75% average quiz accuracy |
| **CelebrationCopy** | "Every book in the library. There's nothing left to read — only because you read it all. Extraordinary." |
| **Hidden** | true |
| **Chain** | null |
| **Quality Gate** | `{ minAvgQuizAccuracy: 75 }` |
| **Phase** | 2 |

**Detection:** `checkHiddenAchievements()` — `ctx.bookCompleted && ctx.tier.booksCompleted75Plus >= ctx.totalBooksInLibrary`
**Data fields read:** `tier.booksCompleted75Plus`, `ctx.totalBooksInLibrary`
**New fields required:** `totalBooksInLibrary?: number` on `AchievementCheckContext` — derived from `BOOKS_CATALOG.length` in the loop-complete handler.

---

### REFERRAL ACHIEVEMENTS (3, Phase 3, excluded from core count)

Quality-gated to referred user reading behavior. Prosocial framing.

---

#### R1. `book-club-founder`

| Field | Value |
|-------|-------|
| **Name** | Book Club Founder |
| **Track** | identity |
| **Tier** | chapter |
| **IP** | 50 |
| **Icon** | 🤝 |
| **Criteria** | 3 referred friends sign up and each start reading a book (complete at least 1 loop) |
| **CelebrationCopy** | "Three friends started reading because of you. Knowledge multiplies when it's shared." |
| **Hidden** | false |
| **Chain** | `{ chainId: "referral", position: 1, nextId: "literary-ambassador" }` |
| **Quality Gate** | Referred user must complete ≥1 loop |
| **Phase** | 3 |

**Detection:** New `checkReferralAchievements()` function — query referral records for the user, count referred users who have ≥1 LOOP record. Award when count >= 3.
**New fields required:** Referral tracking system (Phase 3 — new DynamoDB entity `BOOK_USER_REFERRAL` with `referrerId`, `referredUserId`, `referredAt`, `referredUserLoopsCompleted`).

---

#### R2. `literary-ambassador`

| Field | Value |
|-------|-------|
| **Name** | Literary Ambassador |
| **Track** | identity |
| **Tier** | volume |
| **IP** | 100 |
| **Icon** | 🌍 |
| **Criteria** | 5 referred friends each complete 1 book with ≥70% quiz accuracy |
| **CelebrationCopy** | "Five friends finished their first books. You didn't just share an app — you started a reading practice." |
| **Hidden** | false |
| **Chain** | `{ chainId: "referral", position: 2, nextId: "knowledge-catalyst" }` |
| **Quality Gate** | Referred user must complete 1 book with ≥70% accuracy |
| **Phase** | 3 |

**Detection:** `checkReferralAchievements()` — count referred users with ≥1 quality-gated book completion. Award when count >= 5.

---

#### R3. `knowledge-catalyst`

| Field | Value |
|-------|-------|
| **Name** | Knowledge Catalyst |
| **Track** | identity |
| **Tier** | library |
| **IP** | 200 |
| **Icon** | 🚀 |
| **Criteria** | 10 referred friends each complete 3 or more books with ≥70% quiz accuracy |
| **CelebrationCopy** | "Ten friends, thirty books between them. You've become a genuine catalyst for learning." |
| **Hidden** | false |
| **Chain** | `{ chainId: "referral", position: 3, nextId: null }` |
| **Quality Gate** | Referred user must complete ≥3 books with ≥70% accuracy |
| **Phase** | 3 |

**Detection:** `checkReferralAchievements()` — count referred users with ≥3 quality-gated book completions. Award when count >= 10.

---

### Achievement Count Summary

| Track | Count | Page | Chapter | Volume | Library | Luminary |
|-------|-------|------|---------|--------|---------|----------|
| Mastery | 8 | 1 | 4 | 2 | 1 | 0 |
| Consistency | 14 | 5 | 3 | 2 | 2 | 1 |
| Exploration | 8 | 1 | 1 | 3 | 3 | 0 |
| Identity | 11 | 2 | 2 | 5 | 2 | 0 |
| Hidden | 9 | 1 | 4 | 3 | 0 | 1 |
| **Total Core** | **50** | **10** | **14** | **15** | **8** | **2** |
| Referral (Phase 3) | 3 | 0 | 1 | 1 | 1 | 0 |

### IP Total by Tier

| Tier | Total IP (all achievements) |
|------|----------------------------|
| Page | 195 |
| Chapter | 555 |
| Volume | 955 |
| Library | 1,545 |
| Luminary | 1,000 |
| **Grand Total** | **4,250** |

---

## 4. Streak and Forgiveness System

### 7-Tier Streak Chain

| Position | Achievement | Streak Days | Tier | IP |
|----------|------------|-------------|------|-----|
| 1 | `first-spark` | 3 | Page | 15 |
| 2 | `weekly-rhythm` | 7 | Page | 30 |
| 3 | `fortnight-focus` | 14 | Chapter | 45 |
| 4 | `monthly-discipline` | 30 | Volume | 75 |
| 5 | `centurion` | 100 | Library | 200 |
| 6 | `bicentennial` | 200 | Library | 300 |
| 7 | `year-of-insight` | 365 | Luminary | 500 |

Existing streak milestones (3, 7, 14, 30, 60, 100, 200, 365) in `streak-repo.ts` already award IP at these thresholds independently of achievements. The achievement system layers on top — both the milestone IP and the achievement IP are awarded when the threshold is crossed.

### Grace Days

| Property | Specification |
|----------|---------------|
| **Allowance** | 2 automatic grace days per calendar week |
| **Week boundary** | Monday 00:00 in the user's timezone |
| **Consumption** | Automatic. When a user misses a day, a grace day is consumed silently. The streak counter continues as if the day was active. |
| **Visibility** | Grace day usage is shown in the streak detail view: "1 of 2 grace days used this week" |
| **Counter** | If the user reads on a grace day (i.e., they come back before the system would consume it), the grace day is not consumed. Grace days are only consumed on the NEXT active day when a gap is detected. |
| **Reset** | The counter resets to 2 every Monday at 00:00 in the user's timezone. |
| **Effect on consistency score** | Grace days do NOT count as active days for `consistencyLast30`. They only prevent streak breaks. |

**DynamoDB fields on `BookUserStreakItem`:**
```
graceDaysUsedThisWeek: number      // 0, 1, or 2
graceWeekStartDate: string         // YYYY-MM-DD (Monday) in user timezone
```

**Update logic in `streak-repo.ts`:**
1. On loop completion, compute `gap = daysBetween(lastActiveDate, today)`
2. If `gap === 0`: same day, no update needed
3. If `gap === 1`: consecutive day, `currentStreak++`, no grace consumed
4. If `gap === 2`: missed 1 day.
   - Check `graceWeekStartDate`. If current week is different, reset `graceDaysUsedThisWeek = 0` and update `graceWeekStartDate`.
   - If `graceDaysUsedThisWeek < 2`: consume 1 grace day (`graceDaysUsedThisWeek++`), `currentStreak += 2` (count the missed day + today), streak preserved.
   - If `graceDaysUsedThisWeek >= 2`: streak breaks (see below).
5. If `gap === 3`: missed 2 days.
   - If `graceDaysUsedThisWeek === 0` (both grace days available): consume 2, `currentStreak += 3`, streak preserved.
   - If `graceDaysUsedThisWeek === 1` (1 grace day available): consume 1, covers 1 missed day but not 2. Streak breaks.
   - If `graceDaysUsedThisWeek >= 2`: streak breaks.
6. If `gap > 3`: streak breaks regardless (max 2 grace days can only cover 2 missed days).

**Interaction with existing shields:** The current system has `streakShieldsHeld` (0-3). Grace days REPLACE shields as the forgiveness mechanism. Remove shield logic and migrate to grace days. Users with existing shields get those shields converted to grace days in the current week (up to 2).

### Vacation Pause

| Property | Specification |
|----------|---------------|
| **Activation** | User activates via Settings > Streak > "Pause streak" |
| **Duration** | 1 to 30 consecutive days per activation |
| **Annual limit** | 2 activations per calendar year |
| **Effect** | Streak counter freezes at its current value. No grace days are consumed. Consistency score pauses. |
| **Display** | Streak badge shows "Paused" state with remaining days. |
| **End** | Automatically ends when the duration expires, OR when the user completes a loop during the pause (early resumption). |
| **Resumption** | When the pause ends (or user resumes early), the streak continues from its frozen value. The first loop after pause is treated as a continuation, not a new streak. |

**DynamoDB fields on `BookUserStreakItem`:**
```
vacationActive: boolean                 // Is the user currently on vacation
vacationStartDate: string | null        // ISO date
vacationEndDate: string | null          // ISO date (when the vacation will end)
vacationsUsedThisYear: number           // 0, 1, or 2
vacationYearKey: string                 // "2026" — reset counter when year changes
```

**API:**
- `PUT /api/book/me/streak/vacation` — `{ action: "start", durationDays: number }` or `{ action: "cancel" }`
- Validation: `durationDays` must be 1-30. `vacationsUsedThisYear < 2`. Cannot start if already active.

### "Never Miss Twice" Recovery Window

| Property | Specification |
|----------|---------------|
| **Trigger** | When a streak breaks (gap too large for grace days) |
| **Window** | 24 hours from the moment the break is detected |
| **Mechanic** | If the user completes a loop within 24 hours of the break being detected, the streak is restored to its pre-break value and continues. |
| **Limit** | One recovery per streak break. If the user breaks again after recovering, a new 24-hour window opens. |
| **Display** | When a streak breaks, the app shows: "Your streak paused at [X] days. You have 24 hours to continue where you left off." with a countdown timer. |

**DynamoDB fields on `BookUserStreakItem`:**
```
streakBrokenAt: string | null           // ISO timestamp when break was detected
streakValueBeforeBreak: number          // The streak value before it was reset
recoveryWindowExpires: string | null    // ISO timestamp (streakBrokenAt + 24h)
```

**Update logic:**
1. When a streak break is detected (gap > grace days available):
   - Set `streakBrokenAt = now`, `streakValueBeforeBreak = currentStreak`, `recoveryWindowExpires = now + 24h`
   - Set `currentStreak = 1` (the current loop counts as day 1)
2. On the next loop completion, if `recoveryWindowExpires` is set and `now < recoveryWindowExpires`:
   - Restore: `currentStreak = streakValueBeforeBreak + daysSinceBreak`
   - Clear: `streakBrokenAt = null`, `streakValueBeforeBreak = 0`, `recoveryWindowExpires = null`
3. If `recoveryWindowExpires` has passed, clear the recovery fields. The break is permanent.

### Streak Break UX

When the system detects a streak break:

1. **Notification** (first visit after break): Full-width banner at the top of the reading dashboard.
   - **Headline:** "Your streak paused at [X] days."
   - **Body:** "You still have 24 hours to pick up where you left off. Complete one chapter and your [X]-day streak continues."
   - **CTA:** "Continue Reading" button linking to the user's current book/chapter.
   - **Secondary:** "It's okay — start fresh" dismiss link.
   - **Timer:** Countdown showing hours and minutes remaining in the recovery window.

2. **After recovery window expires:**
   - Banner changes to: "Your [X]-day streak is now your personal best. Your new streak starts today."
   - No guilt. No shame. Forward-looking messaging only.

3. **Streak display during recovery window:**
   - The streak badge shows the pre-break value with a warning indicator (amber border pulse).
   - Tooltip: "Complete a loop to preserve your streak."

### Best Streak Ever

| Property | Specification |
|----------|---------------|
| **Field** | `streak.longestStreak` (already exists) |
| **Update rule** | `longestStreak = max(longestStreak, currentStreak)` on every streak increment |
| **Display locations** | 1) Profile page — "Best Streak: [X] days" with fire icon. 2) Streak detail modal — shown alongside current streak. 3) Achievement celebration for streak milestones — "Your personal best is [X] days." |
| **Persistence** | Best streak is never reset, even if the user's current streak breaks. It is a permanent record. |

---

## 5. Achievement Utility Model

### What IP Does

Insight Points (IP) feed the **10-level reader progression system**:

| Level | Name | IP Threshold |
|-------|------|-------------|
| 1 | Newcomer | 0 |
| 2 | Reader | 50 |
| 3 | Thinker | 100 |
| 4 | Scholar | 200 |
| 5 | Sage | 350 |
| 6 | Luminary | 550 |
| 7 | Polymath | 800 |
| 8 | Oracle | 1,100 |
| 9 | Philosopher | 1,500 |
| 10 | Grandmaster | 2,000 |

IP is earned from multiple sources: loop completions (20-60), streak day bonuses (15), streak milestones (25-1500), tier advances (200-800), achievements (15-500), insight sparks (15-45 at 12% chance), and book completions (120).

### What IP Does NOT Do

IP does **NOT** fund transactional redemption. There is no "spend 900 IP for a bonus book unlock" or "buy a Pro pass with points." Remove any existing redemption config from `flow-points-economy.ts`. IP is a progression metric, not a currency to spend.

**Rationale:** Transactional redemption creates controlling reward dynamics (Deci et al., 1999, d = -0.40). The level system is informational feedback — "you've reached Scholar level" — not a store.

### Tier Experiential Unlocks

Experiential unlocks are tied to **achievement tiers**, not IP levels. The unlock activates when the user earns their first achievement of that tier.

| Tier | Unlock | Activation Condition |
|------|--------|---------------------|
| **Page** | None (symbolic recognition) | Earned automatically on first achievement |
| **Chapter** | 3 additional reading themes | First Chapter-tier achievement earned |
| **Volume** | Profile frame customization (3 styles) + reading stats export | First Volume-tier achievement earned |
| **Library** | 48-hour early access to new books + custom profile badge | First Library-tier achievement earned |
| **Luminary** | Name in "Hall of Readers" + founding-reader profile designation | First Luminary-tier achievement earned |

How unlocks are surfaced:
- On earning the first achievement of a new tier, the celebration modal includes: "You've reached [Tier] — [unlock description] is now available."
- The Settings page shows a "Tier Unlocks" section listing all available and locked unlocks.
- Profile frame selection appears in profile settings once Volume is reached.

---

## 6. Post-Reward Forward Momentum

### "Next Up" Mechanic

After every achievement celebration, the system immediately surfaces the user's next closest achievable achievement.

**Trigger:** Every time an achievement celebration dismisses (auto or manual).

**Where it appears:**
1. **Celebration modal footer:** A "Next Up" card at the bottom of the celebration modal showing the next achievement before it dismisses.
2. **Achievement page sidebar:** Persistent "Next Up" card at the top of the achievements page.
3. **Dashboard widget:** The `NextAchievementCard` component on the workspace dashboard.

**Selection logic:**

```
1. Start with all unearned, non-hidden achievements.
2. If the just-earned achievement is part of a chain AND the next chain position exists:
   → Select the next achievement in the chain.
3. Otherwise, compute progress for all unearned visible achievements.
   → Select the one with the highest progress percentage.
   → Tiebreaker: lower tier first (Page > Chapter > Volume > Library > Luminary).
4. Exclude achievements that require data the user has not started generating:
   → If user has 0 notes, exclude note achievements (they haven't engaged with that feature).
   → If user has never used Challenge mode, exclude challenge-mode achievements.
5. If all non-hidden achievements are earned:
   → Show: "You've unlocked every visible achievement. [N] hidden achievements remain to be discovered."
   → Do not hint at what the hidden achievements are.
```

**Progress computation for "Next Up":**
Progress percentage is computed server-side and returned with the earned-achievements API response. For each unearned achievement, the server returns `{ achievementId, currentProgress, targetProgress }` based on the user's current tier/streak/loop data.

**"Next Up" card content:**
- Achievement icon + name
- Progress bar with `currentProgress / targetProgress`
- Criteria text (from `criteria` field)
- Estimated distance text: "~X more [loops/days/books/notes] to go" derived from `targetProgress - currentProgress` and the achievement's criteria type.

---

## 7. Referral and Social Design (Phase 3)

### Referral Chain

Three-tier, quality-gated:

| Tier | Achievement | Criteria | Abuse Prevention |
|------|------------|---------|-----------------|
| Chapter | `book-club-founder` | 3 referred friends each complete ≥1 loop | Referred user must have a verified email and a different IP address from referrer |
| Volume | `literary-ambassador` | 5 referred friends each complete 1 book (≥70% accuracy) | Book completion is quality-gated — can't be speed-clicked |
| Library | `knowledge-catalyst` | 10 referred friends each complete 3+ books (≥70% accuracy) | Multiple books per referred user prevents drive-by signups |

**Prosocial framing (HC-13):**
- Referral prompt copy: "Share ChapterFlow with a friend. When they start reading, you both unlock something."
- No auto-sharing. No contact importing. No pre-selected recipients. No confirm-shaming ("Are you sure you don't want to share?").
- The referral link is a simple URL the user copies and shares however they choose.
- Referral achievements are framed as "helping friends discover reading" not "earning rewards."

**Referral tracking:**
- New DynamoDB entity: `BOOK_USER_REFERRAL`
  - `PK: BOOKUSER#{referrerId}`, `SK: REFERRAL#{referredUserId}`
  - Fields: `referredAt`, `referredUserStatus` ("signed_up" | "first_loop" | "first_book" | "three_books"), `updatedAt`
- On referred-user milestones (loop completion, book completion), update the referral record and check the referrer's referral achievements.
- Rate limit: Max 50 referral links generated per month per user.

### Share Cards (Phase 3)

**Trigger points:**
- Any Library or Luminary achievement earned
- Book completion milestones (1st, 10th, 25th, 50th book)
- Year-end Reading Wrapped

**Card content:**
- User's display name (optional, can be anonymous)
- Achievement name + celebrationCopy
- Book count / streak length / category count (relevant stat)
- ChapterFlow branding (subtle, bottom corner)
- Dark glassmorphic visual with tier-colored accents

**Platform formats:**
- Instagram Story (1080×1920)
- X/Twitter (1200×675)
- General share (1200×630 OG format)
- Copy to clipboard (text only)

**Implementation:**
- Server-side PNG generation using `@vercel/og` or similar
- `GET /api/share/card?achievementId=X&userId=Y` returns the card image
- No PII in the URL — userId is a hash, achievementId is public

### Reading Wrapped (Phase 3)

Annual summary at year-end (December 15-31 availability):

**Content:**
- Total books completed this year
- Total chapters / loops completed
- Total reading days
- Longest streak
- Top 3 categories
- Achievements earned this year
- "Reader Level" progression over the year

**Format:** Multi-slide story (5-7 slides), shareable as individual images or a single summary card.

**Data source:** All from existing tier, streak, achievement, and READINGDAY records. No new data collection required.

---

## 8. Anti-Abuse and Trust

### Quality Gates

| Achievement | Gate | Threshold |
|------------|------|-----------|
| `cover-to-cover` | Average quiz accuracy across book | ≥70% |
| `shelf-builder` | Average quiz accuracy per book | ≥70% |
| `dedicated-reader` | Average quiz accuracy per book | ≥75% |
| `bibliophile` | Average quiz accuracy per book | ≥75% |
| `grand-bibliophile` | Average quiz accuracy per book | ≥75% |
| `year-of-reading` | Average quiz accuracy per book | ≥70% |
| `bridge-builder` | Average quiz accuracy per book | ≥70% |
| `deep-diver-i` | Average quiz accuracy per book | ≥70% |
| `deep-diver-ii` | Average quiz accuracy per book | ≥70% |
| `category-master` | Average quiz accuracy per book | ≥70% |
| `the-librarian` | Average quiz accuracy per book | ≥75% |
| `speed-scholar` | Must pass quiz | Implicit (loop completion requires quiz pass) |
| Referral achievements | Referred user reading behavior | Varies per tier |

### Time-on-Task Minimums

A learning loop completed in under **60 seconds** is flagged as anomalous:
- The loop completion IP is still awarded (to avoid confusing the user)
- The loop does **NOT** count toward any achievement progress
- The LOOP record is created with `flagged: true` and excluded from achievement queries
- Implementation: Add `flagged?: boolean` to `BookUserLoopItem`. Achievement query filters add `AND attribute_not_exists(flagged)`.

**Rationale:** A legitimate learning loop involves reading a summary, engaging with examples, and answering quiz questions. Under 60 seconds is not possible for genuine engagement.

### Anomaly Detection (Phase 3)

| Signal | Threshold | Action |
|--------|-----------|--------|
| Loops per day | > 20 | Flag for review. Continue awarding IP. Hold achievement awards in queue. |
| Quiz answer pattern | Statistically random distribution (chi-squared test) across 10+ quizzes | Flag for review. |
| Identical loop durations | 5+ loops within 5% of identical duration | Flag as potential automation. |
| Referral velocity | 10+ referrals in 24 hours | Pause referral link. Notify user. |

**What "flag for review" means:**
- Achievement awards are held in a `BOOK_USER_ACHIEVEMENT_PENDING` state
- The user sees "Achievement verification in progress" (not "you cheated")
- A manual review process (admin dashboard, Phase 3) approves or denies
- If approved, the achievement is moved to `BOOK_USER_ACHIEVEMENT` and celebration fires
- If denied, the pending record is deleted and no notification is sent (silent)

**No punitive action is taken automatically.** Flags trigger human review only. False positives from legitimate power users (e.g., a student reading 15 chapters in exam prep) must not be penalized.

---

## 9. Data Model Changes

### Updated `AchievementDefinition` Type

```typescript
export type AchievementTrack = "mastery" | "consistency" | "exploration" | "identity" | "hidden";
export type AchievementTier = "page" | "chapter" | "volume" | "library" | "luminary";

export interface AchievementChain {
  chainId: string;
  position: number;
  nextId: string | null;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  track: AchievementTrack;
  tier: AchievementTier;
  ipValue: number;
  criteria: string;
  celebrationCopy: string;
  isHidden: boolean;
  icon: string;
  chain: AchievementChain | null;
  qualityGate: { minAvgQuizAccuracy: number } | null;
  phase: 1 | 2 | 3;
}
```

### New Fields on `BookUserTierItem`

| Field | Type | Purpose | Updated When |
|-------|------|---------|-------------|
| `totalActiveDays` | `number` | Count of distinct reading days | Loop completion (first loop of day) |
| `totalSummarySteps` | `number` | Summary steps completed | Loop completion (increment always) |
| `chaptersWithExamplesViewed` | `number` | Chapters where examples were engaged | Loop completion (when `examplesViewed` flag is true) |
| `distinctLensTypesUsed` | `string[]` | Set of lens types used ("personal", "school", "work") | Loop completion (add if not present) |
| `totalNotesCount` | `number` | Total notes saved | Note save action |
| `substantialNotesCount` | `number` | Notes with ≥100 characters | Note save action (when `noteLength >= 100`) |
| `distinctChaptersWithNotes` | `number` | Chapters with at least 1 note | Note save action (if first note in chapter) |
| `distinctBooksWithNotes` | `number` | Books with at least 1 note | Note save action (if first note in book) |
| `chaptersWithReflectionNotes` | `number` | Chapters where note saved after quiz completion | Note save action (if LOOP record exists for chapter) |
| `nightLoopCount` | `number` | Loops between 10pm-5am local time | Loop completion (based on hour check) |
| `dawnLoopCount` | `number` | Loops between 5am-7am local time | Loop completion (based on hour check) |
| `currentMonthActiveDays` | `number` | Active days in current calendar month | Loop completion (first loop of day) |
| `currentMonthKey` | `string` | Month identifier, e.g. "2026-04" | Loop completion (reset if month changed) |
| `completedBooksByCategory` | `Record<string, number>` | Quality-gated book completions per category | Book completion (when `avgAccuracy >= 70`) |
| `booksCompleted70Plus` | `number` | Books completed with ≥70% avg accuracy | Book completion |
| `booksCompleted75Plus` | `number` | Books completed with ≥75% avg accuracy | Book completion |
| `booksCompletedThisYear` | `number` | Quality-gated books completed in current year | Book completion (when `avgAccuracy >= 70`) |
| `currentYearKey` | `string` | Year identifier, e.g. "2026" | Book completion (reset if year changed) |

### New Fields on `BookUserStreakItem`

| Field | Type | Purpose | Updated When |
|-------|------|---------|-------------|
| `graceDaysUsedThisWeek` | `number` | Grace days consumed (0-2) | Streak update (gap detection) |
| `graceWeekStartDate` | `string` | Monday of current grace week (YYYY-MM-DD) | Streak update (reset on new week) |
| `vacationActive` | `boolean` | Is vacation pause active | Vacation API |
| `vacationStartDate` | `string \| null` | Vacation start date | Vacation API |
| `vacationEndDate` | `string \| null` | Vacation end date | Vacation API |
| `vacationsUsedThisYear` | `number` | Vacation activations this year (0-2) | Vacation API |
| `vacationYearKey` | `string` | Year for vacation counter reset | Vacation API |
| `streakBrokenAt` | `string \| null` | Timestamp when streak broke | Streak update (break detection) |
| `streakValueBeforeBreak` | `number` | Streak value before reset | Streak update (break detection) |
| `recoveryWindowExpires` | `string \| null` | 24h after break for recovery | Streak update (break detection) |

### New Fields on `AchievementCheckContext`

| Field | Type | Purpose |
|-------|------|---------|
| `inactiveDaysBeforeReturn` | `number \| undefined` | Gap days before this loop (for second-wind) |
| `streakGapDays` | `number \| undefined` | Days since last active (for comeback-reader) |
| `loopDurationSeconds` | `number \| undefined` | Duration of the learning loop (for speed-scholar) |
| `bookAvgQuizAccuracy` | `number \| undefined` | Average quiz accuracy for the completed book |
| `bookCategory` | `string \| undefined` | Category of the current book |
| `totalBooksInCategory` | `number \| undefined` | Total books in this category (from catalog) |
| `totalBooksInLibrary` | `number \| undefined` | Total books in library (from catalog) |
| `examplesViewed` | `boolean \| undefined` | Whether examples were viewed this loop |
| `lensType` | `string \| undefined` | Which lens was used this loop |

### New Fields on Loop-Complete Request Body

| Field | Type | Purpose |
|-------|------|---------|
| `loopStartedAt` | `string \| undefined` | ISO timestamp when loop was initiated (for speed-scholar duration calculation) |
| `examplesViewed` | `boolean \| undefined` | Whether examples/scenarios were viewed during this loop |
| `lensType` | `string \| undefined` | Which lens type was used ("personal" \| "school" \| "work") |

### New DynamoDB Entities (Phase 3)

**BOOK_USER_REFERRAL** (referral tracking):
```
PK: BOOKUSER#{referrerId}
SK: REFERRAL#{referredUserId}
entity: "BOOK_USER_REFERRAL"
Fields: referrerId, referredUserId, referredAt, referredUserStatus, updatedAt
```

**BOOK_USER_SHOWCASE** (showcase persistence):
```
PK: BOOKUSER#{userId}
SK: SHOWCASE
entity: "BOOK_USER_SHOWCASE"
Fields: userId, pinnedAchievementIds (string[], max 5), updatedAt
```

### New API Endpoints

| Method | Path | Purpose | Phase |
|--------|------|---------|-------|
| GET | `/api/book/me/achievements` | List earned achievements + showcase + progress for all unearned | 1 |
| PUT | `/api/book/me/achievements/showcase` | Update pinned achievement IDs (max 5) | 1 |
| PUT | `/api/book/me/streak/vacation` | Start or cancel vacation pause | 2 |
| GET | `/api/share/card` | Generate share card image (Phase 3) | 3 |

### Changes to Loop-Complete Response Payload

Add to the existing response:

```typescript
{
  // ... existing fields ...
  achievements: AchievementAwardResult[];  // Already exists
  nextUp: {                                 // NEW
    achievementId: string;
    name: string;
    icon: string;
    criteria: string;
    currentProgress: number;
    targetProgress: number;
  } | null;
  streakRecovery: {                         // NEW (Phase 2)
    isInRecoveryWindow: boolean;
    recoveryExpiresAt: string | null;
    previousStreakValue: number | null;
  } | null;
}
```

---

## 10. Achievement Health Metrics (Phase 3)

### Metrics to Track

| Metric | Computation | Review Cadence | Action Threshold |
|--------|-------------|---------------|-----------------|
| **Earn rate per achievement** | `usersWhoEarned / totalActiveUsers` | Monthly | If earn rate is <1% for a Page tier achievement → criteria may be too hard, investigate |
| **Earn rate by tier** | Average earn rate across achievements in each tier | Monthly | Page should be 30-50%, Chapter 15-25%, Volume 5-12%, Library 1-5%, Luminary <1% |
| **Time to first achievement** | Median time from account creation to first achievement | Monthly | If >1 hour → first-light criteria may need adjustment |
| **Achievement velocity** | Achievements earned per active user per month | Monthly | If <0.5/month → system may not be engaging enough |
| **Chain completion rate** | % of users who earn position N+1 after earning position N | Monthly | If <30% drop between adjacent chain positions → gap may be too large |
| **Forward momentum engagement** | % of users who complete a loop within 48h of seeing "Next Up" | Monthly | If <15% → "Next Up" selection may be poor |
| **Streak break recovery rate** | % of streak breaks where user returns within 24h recovery window | Monthly | If <20% → recovery window messaging may need improvement |
| **Grace day utilization** | % of weeks where at least 1 grace day is consumed | Monthly | If >60% → users are frequently missing, may need more forgiveness |
| **Celebration dismissal rate** | % of celebrations dismissed before auto-dismiss timer | Monthly | If >80% for modal celebrations → celebration is too intrusive |
| **Hidden achievement discovery rate** | How many active users have discovered each hidden achievement | Quarterly | If a hidden achievement has <0.1% discovery after 6 months → criteria may be too obscure |

### Computation Method

All metrics are computed from DynamoDB queries against ACHIEVEMENT, LOOP, STREAK, and engagement records. Run as a scheduled Lambda function (weekly for operational metrics, monthly for strategic review).

### Review Process

Monthly review meeting examines the dashboard. Actions:
- **Adjust IP values** if tier earn rates are significantly off target
- **Adjust criteria thresholds** if achievements are too easy or too hard
- **Adjust "Next Up" algorithm** if forward momentum engagement is low
- **Consider new achievements** if users are running out of achievable targets
- **Retire achievements** if earn rate is <0.01% after 12 months (move to hidden/legacy)

---

## 11. Consolidation Plan

### Legacy Concepts Ported (12 achievements)

| Legacy ID | Legacy Category | New ID | New Track | Detection Change |
|-----------|----------------|--------|-----------|-----------------|
| `first-ink` | notes | `first-ink` | identity | Client → server: query NOTE records or use `tier.totalNotesCount` counter |
| `deep-thought` | notes | `deep-thought` | identity | Client → server: use `tier.substantialNotesCount` counter |
| `cross-book-notes` | notes | `cross-book-notes` | identity | Client → server: use `tier.distinctBooksWithNotes` counter |
| `the-annotator` | notes | `the-annotator` | identity | Client → server: use `tier.distinctChaptersWithNotes` counter |
| `reflection-closer` | notes | `reflection-closer` | identity | Client → server: use `tier.chaptersWithReflectionNotes` counter |
| `applied-reader` | exploration | `applied-reader` | mastery | Client → server: use `tier.chaptersWithExamplesViewed` counter |
| `lens-master` | exploration | `lens-master` | mastery | Client → server: use `tier.distinctLensTypesUsed` set |
| `cover-to-cover` | books | `cover-to-cover` | identity | Client → server. ADD quality gate: ≥70% quiz accuracy |
| `shelf-builder` | books | `shelf-builder` | identity | Client → server. ADD quality gate: ≥70% quiz accuracy |
| `active-reader` | consistency | `active-reader` | consistency | Client → server: use `tier.totalActiveDays` counter |
| `comeback-reader` | consistency | `comeback-reader` | consistency | Client → server: check `ctx.streakGapDays === 2` |
| `speed-scholar` | secret | `speed-scholar` | hidden | Client → server: check `ctx.loopDurationSeconds < 600` |

### Legacy Concepts Dropped (24 badges)

| Legacy ID | Category | Reason |
|-----------|----------|--------|
| `kindling` | consistency | Replaced by `first-spark` (identical 3-day streak, different name) |
| `rhythm-silver` | consistency | Replaced by `weekly-rhythm` (identical 7-day streak) |
| `rhythm-gold` | consistency | Replaced by `fortnight-focus` (14-day streak) |
| `rhythm-platinum` | consistency | Replaced by `monthly-discipline` (30-day streak) |
| `balanced-rhythm` | consistency | Replaced by `weekend-warrior` and `steady-state` |
| `first-proof` | mastery | "Pass 1 quiz" is covered by learning loop completion itself. Replaced by `first-light` (faster endowed progress) |
| `depth-check` | mastery | "Quiz in Deeper mode" is replaced by Challenge-mode achievements |
| `perfect-pass` | mastery | "100% on any quiz" is replaced by `sharp-focus` (identical) |
| `perfect-series` | mastery | "3 perfect quizzes" is replaced by `flawless-run` (5 perfect = higher bar) |
| `mastery-baseline` | mastery | "80% avg over 10 quizzes" is replaced by `precision-reader` (85% avg = higher bar) |
| `answer-bank` | mastery | "100 quiz questions" is volume-tracking without depth. Replaced by loop-based achievements |
| `the-examiner` | mastery | "25 quizzes passed" is replaced by `century-loop` and book-completion chain |
| `deep-focus` | mastery | "5 chapters in focus mode" is replaced by Challenge-mode achievements |
| `hard-finish` | books | "Finish challenging book" — replaced by `challenge-mastery` (entire book in Challenge mode = higher bar) |
| `mind-reader` | books | "Complete psychology book" — single-genre 1-book achievements are too easy. Replaced by `deep-diver` chain (3→5→all) |
| `strategy-closer` | books | Same as `mind-reader` |
| `cross-book-mastery` | books | "Pass quizzes in 3 books" — redundant with `bridge-builder` and book-completion chain |
| `explorer` | exploration | "Start books in 3 categories" — replaced by `curious-mind` (complete loops, higher bar than "start") |
| `challenge-accepted` (legacy) | exploration | "Start a hard book" — **ID COLLISION**. The new system's `challenge-accepted` (10 Challenge loops) is authoritative. Legacy concept dropped entirely. |
| `path-builder` | exploration | "Add 5 books to reading list" — too close to trivial action (HC-4) |
| `return-loop` | exploration | "Return after 14+ days" — redundant with `second-wind` in hidden track |
| `night-owl` (legacy) | secret | "Read after midnight" (1 occurrence) — replaced by new system's `night-owl` (5 loops 10pm-5am, higher bar) |
| `marathon-reader` | secret | "2+ hours continuous" — requires continuous session tracking not currently implemented. Replaced by `marathon-session` (5 loops in 1 day, using existing data) |
| `polymath` | secret | "5 categories in one month" — replaced by exploration breadth chain which tracks categories without time constraint |

### UI Rewiring Approach

The 13 legacy badge UI components are production-quality and should be rewired, not rewritten.

**Step 1: Create `AchievementWithProgress` type** (replaces `BadgeWithProgress`):
```typescript
export interface AchievementWithProgress extends AchievementDefinition {
  isEarned: boolean;
  earnedDate: string | null;
  isDiscovered: boolean;       // For hidden: true only if earned
  currentProgress: number;     // 0 to targetProgress
  targetProgress: number;      // From criteria parsing
  percentage: number;          // 0 to 100
}
```

**Step 2: Create `useAchievementSystem` hook** (replaces `useBadgeSystem`):
- Fetches earned achievements from `GET /api/book/me/achievements`
- Merges with `ACHIEVEMENT_DEFINITIONS` to produce `AchievementWithProgress[]`
- Computes progress for each unearned achievement using server-returned progress data
- Manages showcase pins (with server persistence via PUT)
- Manages celebration state (newlyEarned = achievements earned since last seen)
- Exposes: `achievements`, `earnedCount`, `visibleCount`, `recommendations`, `timeline`, `profile`, `showcase`, `nextUp`

**Step 3: Update each UI component** to consume `AchievementWithProgress`:

| Component | Key Changes |
|-----------|------------|
| `BadgeCard` | `category` → `track`, `tier` → computed from `AchievementTier`, `fpValue` → `ipValue`, `icon` from definition |
| `BadgeCelebration` | Priority by `tier` (luminary > library > volume > chapter > page), celebration level mapped from tier |
| `BadgeDetailModal` | `narrative` → `celebrationCopy`, `description` → `criteria` |
| `BadgeShowcase` | Persist to server via `PUT /achievements/showcase`. Remove localStorage. |
| `BadgeRecommendations` | Use server-returned progress data. Route CTA by `track` not `category`. |
| `BadgeTimeline` | Track color mapping (mastery→cyan, consistency→amber, exploration→emerald, identity→violet, hidden→rose) |
| `BadgePageHeader` | `totalFP` → `totalIP`, counts from unified achievement list |
| `BadgeFilters` | Categories → tracks. "all", "earned", "locked" + mastery, consistency, exploration, identity. No "hidden" filter (hidden achievements only appear when earned). |
| `SeasonalChallenge` | Remove entirely (Phase 1). Reintroduce properly in Phase 3 with server persistence. |

**Step 4: Remove fake rarity.** Delete `getBadgeRarity()` and all rarity display. Replace with nothing until Phase 3 real population data is available.

### File Deletions

| File | Action |
|------|--------|
| `app/book/badges/lib/badge-data.ts` | Delete |
| `app/book/data/mockBadges.ts` | Delete |
| `app/book/hooks/useBadgeSystem.ts` | Delete |
| `app/app/api/book/me/badges/route.ts` | Delete |
| `app/book/badges/components/SeasonalChallenge.tsx` | Delete (reintroduce in Phase 3) |

### localStorage Migration

Execute on first page load after deployment:

```typescript
function migrateLocalStorage() {
  // 1. Read legacy keys
  const legacyEarned1 = localStorage.getItem("book-accelerator:badge-earned:v1");
  const legacyEarned2 = localStorage.getItem("cf:badge-earned-v2");
  const legacyShowcase = localStorage.getItem("cf:badge-showcase-v1");

  // 2. Set new celebration-seen timestamp
  localStorage.setItem("cf:achievements-last-seen", new Date().toISOString());

  // 3. Remove deprecated keys
  localStorage.removeItem("book-accelerator:badge-earned:v1");
  localStorage.removeItem("cf:badge-earned-v2");
  localStorage.removeItem("cf:badges-last-seen");
  localStorage.removeItem("cf:badge-showcase-v1");

  // 4. Mark migration complete
  localStorage.setItem("cf:achievement-migration-v4", "done");
}
```

Showcase migration: If `legacyShowcase` contains valid badge IDs that map to new achievement IDs, call `PUT /api/book/me/achievements/showcase` with the mapped IDs. Otherwise, start with empty showcase.

---

## 12. Implementation Phases

### Phase 1: Structural Consolidation

**Scope:** Unify the two systems. Fix all bugs. Port legacy concepts. Rewire UI. Delete legacy files.

**Deliverables:**
1. Expand `achievement-definitions.ts` with all Phase 1 achievements (35 of 50):
   - All 8 mastery (except `summary-scholar`)
   - 9 of 14 consistency (except `first-light`, `fortnight-focus`, `weekend-warrior`, `active-month-i`, `active-month-ii`)
   - 4 of 8 exploration (curious-mind, cross-disciplinary, renaissance-reader, omnivore, bridge-builder — but not deep-diver or category-master)
   - 6 of 11 identity (cover-to-cover, shelf-builder, first-ink, deep-thought, the-annotator, cross-book-notes, reflection-closer — but not dedicated-reader, bibliophile, grand-bibliophile, year-of-reading)
   - All 9 hidden (including fixed second-wind and ported speed-scholar)
2. Add `AchievementTier`, `AchievementChain`, `qualityGate`, `icon`, `phase` fields to `AchievementDefinition` type
3. Add `checkIdentityAchievements()` to `achievement-repo.ts`
4. Fix second-wind detection (add `awardAchievement()` call)
5. Fix century-loop detection (`=== 100` → `>= 100`)
6. Add pre-computed counters to tier record (`nightLoopCount`, `dawnLoopCount`, note counters, etc.)
7. Add new fields to `AchievementCheckContext` (`inactiveDaysBeforeReturn`, `loopDurationSeconds`, etc.)
8. Create `GET /api/book/me/achievements` endpoint (returns earned + progress)
9. Create `PUT /api/book/me/achievements/showcase` endpoint
10. Create `useAchievementSystem` hook
11. Rewire all badge UI components to consume `AchievementWithProgress`
12. Remove fake rarity display
13. Remove `SeasonalChallenge` component
14. Delete legacy files (`badge-data.ts`, `mockBadges.ts`, `useBadgeSystem.ts`, legacy badges route)
15. Execute localStorage migration
16. Add `loopStartedAt`, `examplesViewed`, `lensType` to loop-complete request body

**Scope boundary:** No new user-facing features beyond ported concepts. No streak forgiveness changes. No tier experiential unlocks. No "Next Up" mechanic. No quality gates on book-completion achievements. The system works identically to the user — they just see a unified, cleaned-up achievement page.

### Phase 2: Behavioral Core

**Scope:** Streak forgiveness. New achievements. Forward momentum. Tier hierarchy visual treatment. Quality gates. Chain metadata. Experiential unlocks.

**Deliverables:**
1. Add remaining 15 Phase 2 achievements:
   - `first-light`, `fortnight-focus`, `bicentennial`, `weekend-warrior`, `active-month-i`, `active-month-ii`
   - `summary-scholar`
   - `deep-diver-i`, `deep-diver-ii`, `category-master`
   - `dedicated-reader`, `bibliophile`, `grand-bibliophile`, `year-of-reading`
   - `the-librarian`
2. Implement grace day system (replace shields with 2 grace days/week)
3. Implement vacation pause API and UI
4. Implement "never miss twice" 24-hour recovery window
5. Implement streak break UX (banner, countdown, messaging)
6. Add Best Streak Ever display to profile and streak detail
7. Implement "Next Up" mechanic:
   - Server-side progress computation for all unearned achievements
   - Add `nextUp` to loop-complete response
   - Add "Next Up" card to celebration modal footer
   - Update `NextAchievementCard` dashboard widget
8. Implement tier visual hierarchy (5 distinct visual treatments)
9. Implement celebration type mapping by tier
10. Implement quality gates on book-completion and identity-milestone achievements
11. Add `totalSummarySteps` tracking to tier record
12. Add `currentMonthActiveDays` / `currentMonthKey` tracking
13. Add `completedBooksByCategory` tracking
14. Add `booksCompletedThisYear` / `currentYearKey` tracking
15. Implement experiential unlocks (reading themes at Chapter, profile frames at Volume, early access at Library)
16. Remove IP redemption options from economy config

**Scope boundary:** No referral system. No share cards. No Reading Wrapped. No real rarity. No anomaly detection. No seasonal achievements.

### Phase 3: Growth & Sustainability

**Scope:** Social features, growth mechanics, operational tooling.

**Deliverables:**
1. Referral system: tracking entity, referral link generation, 3 referral achievements
2. Share cards: server-side image generation, share card API, trigger points
3. Reading Wrapped: annual summary feature (December availability)
4. Real rarity: compute from actual user population data, display earn rate percentages
5. Achievement health metrics: dashboard, scheduled computation, review process
6. Anomaly detection: flagging logic, pending-achievement state, admin review UI
7. Seasonal achievements: time-limited achievements with server persistence and start/end dates
8. A/B testing flags: ability to enable/disable individual achievements for user segments
9. Reintroduce Seasonal Challenge component with server persistence

---

## 13. Validation Checklist

The team uses this checklist to verify completeness after each phase.

### Phase 1 Validation

- [ ] `badge-data.ts` is deleted from the codebase
- [ ] `mockBadges.ts` is deleted from the codebase
- [ ] `useBadgeSystem.ts` is deleted from the codebase
- [ ] `/api/book/me/badges/route.ts` is deleted from the codebase
- [ ] `achievement-definitions.ts` contains exactly 35 Phase 1 achievements
- [ ] Every achievement has all required fields: `id`, `name`, `track`, `tier`, `ipValue`, `criteria`, `celebrationCopy`, `isHidden`, `icon`, `chain`, `qualityGate`, `phase`
- [ ] No two achievements share the same `id`
- [ ] `checkIdentityAchievements()` exists and runs in parallel with the other 4 check functions
- [ ] `second-wind` detection calls `awardAchievement()` when `inactiveDaysBeforeReturn >= 14`
- [ ] `century-loop` detection uses `>= 100` not `=== 100`
- [ ] `tier.nightLoopCount` and `tier.dawnLoopCount` are pre-computed counters (no O(n) LOOP scans)
- [ ] `GET /api/book/me/achievements` returns earned achievements, showcase, and progress
- [ ] `PUT /api/book/me/achievements/showcase` persists to DynamoDB (not localStorage)
- [ ] Fake rarity display is removed from all UI components
- [ ] `SeasonalChallenge.tsx` is removed
- [ ] All badge UI components consume `AchievementWithProgress` (not `BadgeWithProgress`)
- [ ] `useAchievementSystem` hook works end-to-end: fetch → compute → display
- [ ] Celebration fires correctly for newly earned achievements (toast/modal/epic mapped by tier)
- [ ] Filter tabs show 5 tracks: mastery, consistency, exploration, identity, hidden (hidden only shows earned)
- [ ] localStorage migration runs on first load, removes deprecated keys
- [ ] `npm run build` passes with zero errors
- [ ] No imports from deleted files remain in the codebase
- [ ] All existing BOOK_USER_ACHIEVEMENT records in DynamoDB continue to work (backward compatible)

### Phase 2 Validation

- [ ] `achievement-definitions.ts` contains exactly 50 achievements (35 Phase 1 + 15 Phase 2)
- [ ] Grace day system replaces shield system in streak-repo
- [ ] Grace days reset every Monday in user timezone
- [ ] Vacation pause API exists and enforces 30-day max, 2x/year limit
- [ ] Recovery window fires on streak break with 24-hour countdown
- [ ] Streak break UX shows banner with recovery CTA (no guilt messaging)
- [ ] Best Streak Ever is displayed on profile page
- [ ] "Next Up" card appears in celebration modal footer after achievement dismiss
- [ ] "Next Up" card on dashboard shows correct progress data
- [ ] Chain-based "Next Up" selection works (after earning chain position N, show N+1)
- [ ] All 5 tier visual treatments render correctly (page → luminary)
- [ ] Celebration types map correctly: page=toast, chapter=modal, volume=full-modal, library=epic, luminary=cinematic
- [ ] Quality gates enforce ≥70% on book-completion achievements
- [ ] Quality gates enforce ≥75% on identity-milestone achievements (dedicated-reader, bibliophile, grand-bibliophile, the-librarian)
- [ ] IP redemption options are removed from `flow-points-economy.ts`
- [ ] Experiential unlock surfaces at Chapter (themes), Volume (frames), Library (early access)
- [ ] `first-light` is earnable within 5 minutes of first session

### Phase 3 Validation

- [ ] Referral tracking entity exists in DynamoDB
- [ ] 3 referral achievements detect correctly based on referred-user reading behavior
- [ ] No auto-sharing, no contact importing, no pre-selected sharing
- [ ] Share cards generate server-side PNG images
- [ ] Reading Wrapped is available December 15-31
- [ ] Real rarity percentages are computed from user population data
- [ ] Achievement health metrics dashboard exists
- [ ] Anomaly detection flags suspicious patterns without punitive action
- [ ] Seasonal achievements support start/end dates with server persistence

---

## Appendix: Chain Reference

| Chain ID | Positions | Achievements |
|----------|-----------|-------------|
| `streak` | 7 | first-spark → weekly-rhythm → fortnight-focus → monthly-discipline → centurion → bicentennial → year-of-insight |
| `exploration-breadth` | 4 | curious-mind → cross-disciplinary → renaissance-reader → omnivore |
| `category-depth` | 3 | deep-diver-i → deep-diver-ii → category-master |
| `book-completion` | 5 | cover-to-cover → shelf-builder → dedicated-reader → bibliophile → grand-bibliophile |
| `notes` | 4 | first-ink → deep-thought → the-annotator → cross-book-notes |
| `monthly-active` | 2 | active-month-i → active-month-ii |
| `referral` | 3 | book-club-founder → literary-ambassador → knowledge-catalyst |

---

## Appendix: Icon Reference

| Achievement | Icon | Achievement | Icon |
|------------|------|------------|------|
| `sharp-focus` | 🎯 | `bridge-builder` | 🌉 |
| `precision-reader` | 📐 | `deep-diver-i` | 🤿 |
| `challenge-accepted` | ⚔️ | `deep-diver-ii` | 🤿 |
| `flawless-run` | 💎 | `category-master` | 🏛️ |
| `challenge-mastery` | 👑 | `cover-to-cover` | 📗 |
| `summary-scholar` | 📝 | `shelf-builder` | 📚 |
| `applied-reader` | 🔬 | `dedicated-reader` | 📖 |
| `lens-master` | 🔭 | `bibliophile` | 🏆 |
| `first-light` | 🌅 | `grand-bibliophile` | 🏆 |
| `first-spark` | ✨ | `year-of-reading` | 🗓️ |
| `weekly-rhythm` | 🔥 | `first-ink` | ✏️ |
| `fortnight-focus` | 🔥 | `deep-thought` | 🧠 |
| `monthly-discipline` | 🔥 | `the-annotator` | 🖊️ |
| `centurion` | 🔥 | `cross-book-notes` | 📓 |
| `bicentennial` | 🔥 | `reflection-closer` | 💭 |
| `year-of-insight` | 🌟 | `night-owl` | 🦉 |
| `steady-state` | ⚖️ | `dawn-reader` | 🌄 |
| `active-reader` | 📖 | `weekend-scholar` | 📚 |
| `comeback-reader` | 🔄 | `marathon-session` | 🏃 |
| `weekend-warrior` | 🏖️ | `full-circle` | 🔄 |
| `active-month-i` | 📅 | `second-wind` | 💨 |
| `active-month-ii` | 📅 | `century-loop` | 💯 |
| `curious-mind` | 🧭 | `speed-scholar` | ⚡ |
| `cross-disciplinary` | 🌐 | `the-librarian` | 🏛️ |
| `renaissance-reader` | 🎨 | `book-club-founder` | 🤝 |
| `omnivore` | 🦉 | `literary-ambassador` | 🌍 |
| | | `knowledge-catalyst` | 🚀 |

---

## Appendix: Bug Fixes Summary

| # | Bug | Fix | Phase |
|---|-----|-----|-------|
| 1 | `second-wind` never awards (stubbed logic at achievement-repo.ts:362-374) | Add `inactiveDaysBeforeReturn` to context, add `awardAchievement()` call when `>= 14` | 1 |
| 2 | `challenge-accepted` ID collision (legacy=exploration/20FP, new=mastery/60IP) | Delete `badge-data.ts` entirely. New system's version is authoritative. | 1 |
| 3 | Badge showcase is localStorage-only | Create `BOOK_USER_SHOWCASE` DynamoDB entity, `PUT /achievements/showcase` API | 1 |
| 4 | Badge rarity is fake (`charCodeAt()` formula) | Remove all rarity display. Replace with real data in Phase 3. | 1 |
| 5 | Seasonal challenge is cosmetic and hardcoded | Remove `SeasonalChallenge.tsx`. Reintroduce with server persistence in Phase 3. | 1 |
| 6 | Night Owl criteria conflict (legacy: 1 read after midnight; new: 5 loops 10pm-5am) | Use new system's version. Delete legacy definition. | 1 |
| 7 | Night Owl / Dawn Reader queries are O(n) (scan all LOOP records) | Add `tier.nightLoopCount` and `tier.dawnLoopCount` pre-computed counters | 1 |
