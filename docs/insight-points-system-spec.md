# ChapterFlow Insight Points System: Complete Design Specification

> **Status: Implemented** (original design spec, May 2026). The system this
> spec designs is live: earning ledger + referrals in
> `app/app/api/book/_lib/flow-points-repo.ts`, streaks in
> `app/app/api/book/_lib/streak-repo.ts`, user-facing routes under
> `app/app/api/book/me/` (`flow-points`, `shop`, `badges`, `streak`), and the
> admin adjustment route at `app/app/api/book/admin/insight-points/adjust/`.
> The shipped UI presents the currency as **Flow Points**. This document is the
> point-in-time design specification — where it and the code disagree, the code
> is the source of truth.

---

## Design Philosophy

The Insight Points (IP) system is a behavioral engagement platform built on the premise that **genuine comprehension is the only rewardable action**. Every IP earned represents demonstrated understanding through ChapterFlow's 4-step learning loop: Summary → Scenarios → Quiz → Unlock. No IP is awarded for passive actions — opening the app, browsing the library, or reading summaries without completing the loop.

The system follows a scaffolding model: heavy extrinsic reward prominence in the first 14 days gradually fades as the intrinsic identity shift takes hold. A day-1 user sees IP as motivation. A month-6 user identifies as "someone who reads and learns consistently" — the IP is a secondary signal, not the driver.

Three design anchors:

1. **Comprehension over consumption.** Points correlate with quiz performance, full loop completion, and mastery depth — never with volume alone.
2. **Gentle persistence over guilt.** Streaks celebrate continuity. Breaks are met with warmth and permanent records, not shame. Every punitive mechanic has a forgiveness counterpart.
3. **Premium intellectual identity.** Every name, icon, copy string, and animation reinforces the identity of a serious, curious person — never a gamer chasing XP.

---

## 1. Earning Structure

### 1.1 Earning Table

The core change from the current system: IP earning splits across **Quiz Pass** (Step 3, server-verified comprehension) and **Loop Complete** (Step 4, Unlock step finished). This preserves immediate gratification on quiz pass while incentivizing the full learning cycle. Total IP per chapter is unchanged from the current system.

#### Learning Loop Earnings

| Action | Mode | 1st Attempt | Retry | Conditions | Repeatable | Source Type |
|--------|------|-------------|-------|------------|------------|-------------|
| Quiz Pass | Guided | 50 IP | 30 IP | Score ≥ 70% | Per chapter (idempotent) | `quiz_pass` |
| Quiz Pass | Standard | 60 IP | 35 IP | Score ≥ 80% | Per chapter | `quiz_pass` |
| Quiz Pass | Challenge | 90 IP | 60 IP | Score ≥ 90% | Per chapter | `quiz_pass` |
| Loop Complete | Guided | 30 IP | 20 IP | Unlock step finished after quiz pass | Per chapter | `loop_complete` |
| Loop Complete | Standard | 40 IP | 25 IP | Unlock step finished after quiz pass | Per chapter | `loop_complete` |
| Loop Complete | Challenge | 60 IP | 40 IP | Unlock step finished after quiz pass | Per chapter | `loop_complete` |
| Perfect Score Bonus | Guided | +30 IP | +30 IP | Score = 100% (awarded on quiz pass) | Per chapter | `quiz_pass` (metadata) |
| Perfect Score Bonus | Standard | +50 IP | +50 IP | Score = 100% | Per chapter | `quiz_pass` (metadata) |
| Perfect Score Bonus | Challenge | +80 IP | +80 IP | Score = 100% | Per chapter | `quiz_pass` (metadata) |

**Total IP per chapter (preserved from current system):**

| Mode | 1st Attempt | 1st + Perfect | Retry | Retry + Perfect |
|------|-------------|---------------|-------|-----------------|
| Guided | 80 IP | 110 IP | 50 IP | 80 IP |
| Standard | 100 IP | 150 IP | 60 IP | 110 IP |
| Challenge | 150 IP | 230 IP | 100 IP | 180 IP |

#### Milestone and Activity Earnings

| Action | IP Value | Conditions | Repeatable | Source Type |
|--------|----------|------------|------------|-------------|
| Onboarding complete | 120 IP | `onboardingCompleted` transitions to `true` | No (one-time) | `onboarding_complete` |
| First book started | 40 IP | First book unlock ever | No (one-time) | `first_book_started` |
| Book complete | 120 IP | All chapters passed in a book | Per book | `book_complete` |
| Streak day bonus | 15 IP | First loop completion of the day while streak ≥ 1 | Daily | `streak_day` |
| Achievement earned | 15–500 IP | Achievement-specific criteria met | Per achievement (one-time each) | `achievement_earned` |
| Scenario approved | 60 IP | Admin approves user-submitted scenario | Per submission | `scenario_approved` |
| Tier advancement | 200–800 IP | Tier requirements met | Per tier (one-time each) | `tier_advance` |
| Streak milestone | 25–1,500 IP | Specific streak day thresholds | Per milestone (one-time each) | `streak_milestone` |
| Welcome back | 30 IP | First loop completion after 7+ consecutive inactive days | Repeatable (once per return) | `welcome_back` |
| Insight Spark (variable) | 15–45 IP | 12% probability per loop completion | Per trigger (see §7) | `insight_spark` |

#### Referral Earnings

| Action | Inviter Reward | Invitee Reward | Conditions | Source Type |
|--------|---------------|----------------|------------|-------------|
| Referral activation | 1 week Pro (free inviter) OR 200 IP (Pro inviter) | 1 week Pro | Invitee completes first full learning loop | `referral_activation_inviter` |

The `referral_pro_inviter` (600 IP per Pro conversion) has been **removed**. This was the system's most dangerous single faucet — uncapped per-occurrence, it could produce 15,000 IP from conversions alone at 25 referrals, and it structurally framed referrals as sender-benefit. The motivational value is redistributed into the escalation tier bonuses in §6.3, which are bounded and milestone-gated.

### 1.2 Mode Variations

The mode-based scaling is preserved exactly. The design rationale:

- **Guided mode** (70% threshold, 2 retries/question): Lowest IP because the system provides the most scaffolding. Still meaningful — 80 IP per loop rewards genuine effort.
- **Standard mode** (80% threshold, 1 retry/question): The default experience. 100 IP represents the baseline earning expectation.
- **Challenge mode** (90% threshold, 0 retries, 10-minute timer): Highest IP because the user demonstrates the strongest comprehension under the most demanding conditions. The ~2x multiplier over Guided reflects genuine difficulty differential.

Perfect score bonuses are intentionally awarded on Quiz Pass (not Loop Complete) because they reward comprehension quality, which is verified at the quiz step.

### 1.3 Earning Flow Changes from Current System

| Change | Current | New | Rationale |
|--------|---------|-----|-----------|
| IP trigger point | All IP on quiz pass | 60-65% on quiz pass, 35-40% on Unlock complete | Incentivizes full loop; preserves immediate gratification |
| Streak day bonus | Defined (25 IP) but unused | 15 IP, active and wired | Core retention mechanic |
| Welcome back bonus | Not found in repository | 30 IP on first loop after 7+ inactive days (repeatable) | Re-engagement nudge for lapsed users |
| Referral invitee reward | 80 IP | 1 week Pro (no IP) | Higher perceived value, prosocial framing |
| Referral inviter reward | 180 IP | 1 week Pro or 200 IP | Matching value, prosocial framing |
| Referral Pro conversion (inviter) | 600 IP per conversion | **Removed entirely** | Uncapped per-occurrence faucet; sender-benefit framing. Value redistributed into escalation tiers (§6.3) |
| Quiz pass display value | 15 IP (stale) | Accurate range per mode | Fixes misleading "Ways to Earn" |
| Onboarding display | Hardcoded "25" | Dynamic value from config (120) | Fixes incorrect celebration copy |
| `dailyGoalComplete` (25) | Unused constant | Removed | Replaced by streak day bonus |
| `weeklyGoalComplete` (50) | Unused constant | Removed | No weekly goal mechanic needed |
| 6 unused `CHAPTER_FP` fields | Dead code | Removed (`quizSpeedBonus`, `quizScoreImproved`, `scenarioSubmitted`, `streakBonus`, `reviewSessionComplete`, `reviewAllCorrect`) | Clean up dead constants |

**Loop Complete Implementation:**

A new API endpoint `POST /api/book/me/loop-complete/[bookId]/[chapterNumber]` is called when `handleUnlockComplete()` fires on the client (the Unlock phase completion handler in `ChapterReaderClient.tsx`). The server verifies:
1. The user has a passing quiz state for this chapter (`BOOK_USER_QUIZ_STATE.passed === true`)
2. The loop_complete grant doesn't already exist (`POINTSGRANT#loop_complete#{bookId}:{chapter}`)
3. Awards the appropriate IP based on learning mode and attempt number (retrieved from quiz state)
4. Updates streak state (if first loop of the day)
5. Checks for Welcome Back eligibility (if `daysBetween(lastActiveDate, today) >= 7`, awards 30 IP with `sourceType: "welcome_back"` and `sourceId` of the return date string)
6. Checks for achievement triggers and tier advancement

This piggybacks on the quiz pass as the trust anchor — no additional server-side verification of Unlock step content is needed.

**Welcome Back Implementation:**

The Welcome Back bonus (30 IP) is checked during the loop complete endpoint. When a user completes their first loop after 7+ consecutive days of inactivity:
- The STREAK record's `lastActiveDate` is compared to today
- If `daysBetween(lastActiveDate, today) >= 7`: award 30 IP
- Idempotency: `POINTSGRANT#welcome_back#{returnDateString}` — one award per return event
- This is separate from the "Second Wind" hidden achievement, which requires 14+ days and is one-time only
- Typical frequency: 0–3 times per year for most users. Economy impact: negligible (~30–90 IP/year)

---

## 2. Streak and Consistency System

### 2.1 Streak Mechanics

**Qualification:** A day counts toward the streak when the user completes at least **one full learning loop** (all 4 steps with a passing quiz score) during that calendar day (in the user's local timezone, derived from their browser timezone sent with the request).

**Day boundary:** Midnight in the user's local timezone. The server stores `lastActiveDate` as a `YYYY-MM-DD` string in the user's timezone.

**Streak continuation rules:**
- If `today === lastActiveDate + 1 day`: streak continues, increment `currentStreak`
- If `today === lastActiveDate`: already active today, no change
- If `today > lastActiveDate + 1 day`: check for Streak Shields (auto-activate one per missed day). If shields cover all missed days, streak continues. Otherwise, streak resets to 0.

**Streak reset behavior:**
- `currentStreak` resets to 0
- `longestStreak` is NEVER reduced — it's a permanent high-water mark
- A warm "welcome back" message is shown (never guilt or loss framing)

**Current localStorage streak data must be migrated to DynamoDB.** The existing `reading-streaks.ts` localStorage implementation is replaced by server-side tracking. On first server-side streak check, if no STREAK record exists, initialize from localStorage state if available.

### 2.2 Streak Shield Design

| Property | Value |
|----------|-------|
| Cost | 100 IP per shield |
| Maximum held | 3 |
| Activation | Automatic on first missed day |
| Purchase location | Rewards page, streak section on dashboard |
| Purchasable with money | Never — IP only |
| Can gift shields | No (prevents abuse) |

**Purchase flow:** User taps "Buy Streak Shield" → 100 IP deducted → shield added to inventory (STREAK record `streakShieldsHeld` incremented). If balance < 100 or shields already at 3, purchase is blocked.

**Auto-activation flow:** When the streak system detects a gap between `lastActiveDate` and today:
1. Count missed days: `gapDays = daysBetween(lastActiveDate, today) - 1`
2. If `gapDays <= streakShieldsHeld`: consume `gapDays` shields, streak continues unchanged, record shield-used dates
3. If `gapDays > streakShieldsHeld`: consume all available shields, reset streak to 0 (the shields "saved" some days but not enough)

**Shield consumption notification:** "Your Streak Shield kept your [X]-day streak alive while you were away. [Y] shields remaining."

### 2.3 Consistency Score

A rolling 30-day measure of engagement regularity, complementing the streak (which measures consecutive days).

**Calculation:** `consistencyScore = (activeDaysInLast30 / 30) × 100`, rounded to nearest integer.

**"Active day"** = a day in which the user completed at least one learning loop (same definition as streak).

**Storage:** Computed from existing `READINGDAY#{dayKey}` records (which already track daily activity). The STREAK record caches `consistencyLast30` for display, updated whenever streak state changes.

**Functional roles (not display-only):**

1. **Consistency track achievement trigger:** The "Steady State" achievement (see §4.2) requires maintaining 80%+ consistency score for 60 consecutive days. This gives the score a concrete, verifiable purpose in the achievement system.
2. **Streak milestone celebration enrichment:** When streak milestone celebrations fire (§2.4), the celebration copy includes the user's current consistency score as a secondary stat — e.g., "30-day consistency: 87%." This reinforces that consistency matters beyond pure consecutive-day streaks.
3. **Economy health signal:** The Consistency Score distribution across all users is tracked in the economy health dashboard (§9.3) as an engagement quality metric. A declining average consistency score across the user base signals retention risk.
4. **Profile display:** Shown on the user's profile as a secondary engagement metric alongside streak and tier.

**Visual representation:** Circular progress ring with percentage, colored by range:
- 0-29%: Neutral gray
- 30-59%: Amber (building)
- 60-84%: Cyan (strong)
- 85-100%: Emerald (exceptional)

### 2.4 Milestone Celebrations

Streak milestones award one-time IP bonuses and trigger celebrations:

| Streak Days | IP Award | Celebration Style | Example Copy |
|-------------|----------|-------------------|-------------|
| 3 | 25 IP | Toast notification | "Three days of learning. This is where habits begin." |
| 7 | 50 IP | Expanded toast with animation | "One full week. You chose to learn seven days in a row — that puts you ahead of most people who start." |
| 14 | 100 IP | Modal celebration | "Two weeks of sustained curiosity. The research says you're 3.6× more likely to keep going now." |
| 30 | 200 IP | Modal with confetti | "Thirty days. This isn't a streak anymore — it's who you are." |
| 60 | 350 IP | Modal with confetti | "Sixty days of deliberate learning. You've built something most people only talk about." |
| 100 | 500 IP | Full-screen celebration | "Triple digits. One hundred days of choosing to grow. This is rare and remarkable." |
| 200 | 750 IP | Full-screen celebration | "Two hundred days. At this point, the habit carries you — not the other way around." |
| 365 | 1,500 IP | Full-screen celebration with special animation | "One year of daily learning. Three hundred and sixty-five decisions to be curious. This is extraordinary." |

All milestones are one-time (earned once, never re-triggered even if streak resets and re-reaches the threshold).

### 2.5 Notification and Copy Framework

All streak notifications follow these rules:
1. **Learning accomplishment first**, point value second
2. **Identity-reinforcing language** ("you're becoming someone who..." not "you earned X!")
3. **Never guilt, shame, or fear of loss** — even on streak breaks
4. **Progressive tone**: early milestones are encouraging, later milestones are recognizing

#### Notification Templates by Trigger Type

**Daily loop completion (streak active):**
> "[Chapter Name] complete. Day [X] of your reading streak."
> (+15 IP streak bonus shown subtly below)

**Streak approaching milestone (1 day before):**
> "Tomorrow is day [X]. One more loop and you'll hit a new milestone."
> (No IP shown — anticipation, not reward preview)

**Streak broken (shields exhausted or none held):**
> "Your streak paused at [X] days. Your longest streak of [Y] days is yours permanently. Ready to start fresh whenever you are."
> (No IP. Warm. Permanent record emphasized.)

**Streak saved by shield:**
> "Your Streak Shield kept your [X]-day streak alive. [Y] shields remaining."
> (Positioned as safety net, not loss-aversion trigger)

**Welcome back (after 7–13 days inactive, on first loop completion):**
> "Welcome back. Your reading history and progress are right where you left it."
> (+30 IP shown subtly below. No streak mention unless streak survived via shields. Focus on continuity.)

**Welcome back (after 14+ days inactive, on first loop completion — also triggers Second Wind achievement if first time):**
> "It's good to have you back. Pick up wherever feels right."
> (+30 IP shown subtly below. Warm, zero guilt, no mention of what was "lost." If Second Wind triggers simultaneously, the achievement celebration takes priority and the 30 IP welcome-back bonus is folded into the achievement display.)

---

## 3. Progression and Tier System

### 3.1 Tier Definitions

Five named tiers replacing the current 10-level badge-FP-accumulation model. Every name is something a professional would use in conversation without hesitation.

| Tier | Name | Identity Statement | Icon Treatment |
|------|------|-------------------|----------------|
| 1 | **Reader** | "I'm engaging with ideas" | Simple geometric prism, single facet |
| 2 | **Analyst** | "I understand what I read" | Prism with two visible facets |
| 3 | **Synthesizer** | "I connect ideas across domains" | Prism refracting light into spectrum |
| 4 | **Polymath** | "I've built broad and deep knowledge" | Full spectrum prism with glow |
| 5 | **Luminary** | "I illuminate understanding for myself and others" | Radiant prism with halo effect |

### 3.2 Advancement Requirements

Each tier requires meeting ALL three criteria simultaneously: loop count (volume of practice), average quiz score (quality of comprehension), and category breadth (diversity of knowledge).

| Tier | Loops Completed | Avg Quiz Score | Categories Explored | IP Award on Advancement |
|------|----------------|----------------|---------------------|------------------------|
| Reader | 0 (auto-assigned) | — | — | — |
| Analyst | 25 | ≥ 70% | ≥ 2 | 200 IP |
| Synthesizer | 100 | ≥ 75% | ≥ 5 | 400 IP |
| Polymath | 300 | ≥ 80% | ≥ 10 | 600 IP |
| Luminary | 750 | ≥ 85% | ≥ 15 | 800 IP |

**Total tier advancement IP: 2,000 IP** across all four advancements. The Polymath and Luminary awards are intentionally moderated — a user reaching Luminary has completed 750+ loops and earned 75,000+ IP from loops alone. At that stage, the celebration derives its significance from the identity recognition and visual ceremony, not from the IP amount. A 2,000 IP windfall for a user who has already exhausted most one-time sinks would accelerate the terminal accumulation problem without adding motivational value.

**"Loops Completed"** = total learning loops finished (all 4 steps with passing quiz), tracked in the TIER record's `totalLoopsCompleted` field.

**"Avg Quiz Score"** = mean of `bestScoreByChapter` across ALL completed chapters (not just recent ones). This rewards users who go back and improve scores on earlier chapters. Computed as `avgQuizScoreSum / avgQuizScoreCount` on the TIER record, updated on each quiz pass.

**"Categories Explored"** = count of distinct book categories in which the user has completed at least one full learning loop. Derived from the user's LOOP records cross-referenced with book category metadata.

### 3.3 Endowed Progress Design

New users start at **Reader** tier immediately on account creation. The onboarding flow generates visible progress toward **Analyst**:

1. **Account created:** Reader tier assigned. Progress bar shows 0/25 loops, encouraging first step.
2. **Onboarding quiz completed:** Counts as loop #1. Progress bar shows 1/25 (4%). The 120 IP onboarding award goes to balance AND the loop counts toward Analyst.
3. **First book started:** 40 IP to balance. Book's category counts toward the "2 categories" requirement (progress: 1/2).
4. **First regular loop completed:** Loop #2. Progress bar shows 2/25 (8%). If in a different category than onboarding, category progress: 2/2 (one requirement already met).

The endowed progress effect means the user sees advancement momentum from the very first session, making the Analyst tier feel achievable rather than distant.

### 3.4 Tier Celebration Design

Tier advancement triggers a **modal celebration** with the following structure:

```
[Tier icon animation — prism transforms to new tier form]

"You've reached [Tier Name]"

[Specific accomplishment summary]:
"[X] learning loops completed · [Y]% average comprehension · [Z] categories explored"

[Identity statement]:
"You're connecting ideas across disciplines and building real understanding."

+[IP Award] Insight Points

[Dismiss button]
```

**Animation:** The prism icon morphs from the previous tier to the new tier with a glassmorphic shimmer effect. For Luminary (final tier), a radiant halo animation plays with subtle particle effects.

**Timing:** Celebration triggers immediately when all three criteria are simultaneously met, checked after every loop completion.

---

## 4. Achievement Taxonomy

All achievements replace the current flat badge list. Existing badges in `mockBadges.ts` and `badge-data.ts` are consolidated into the four-track taxonomy below. The dual-file system (`mockBadges.ts` with `.flowPoints` and `badge-data.ts` with `.fpValue`) is unified into a single source of truth.

### 4.1 Mastery Track

Achievements demonstrating deep comprehension and willingness to challenge oneself.

| Achievement | Criteria | IP | Celebration Copy |
|-------------|----------|-----|-----------------|
| **Sharp Focus** | Score 100% on any quiz | 20 IP | "Perfect comprehension. Every concept, every nuance — you didn't miss a thing." |
| **Precision Reader** | Average ≥ 85% across 10 completed chapters | 40 IP | "Consistent excellence across ten chapters. You don't just read — you understand." |
| **Challenge Accepted** | Complete 10 learning loops in Challenge mode | 60 IP | "Ten chapters under the hardest conditions. You chose difficulty, and you met it." |
| **Flawless Run** | Score 100% on 5 different chapter quizzes | 80 IP | "Five perfect scores. This level of comprehension is genuinely rare." |
| **Challenge Mastery** | Complete every chapter of a book in Challenge mode | 120 IP | "An entire book in Challenge mode. That takes more than ability — it takes resolve." |

### 4.2 Consistency Track

Achievements demonstrating sustained engagement and habit formation.

| Achievement | Criteria | IP | Celebration Copy |
|-------------|----------|-----|-----------------|
| **First Spark** | Reach a 3-day streak | 15 IP | "Three days in a row. Every lasting habit starts exactly like this." |
| **Weekly Rhythm** | Reach a 7-day streak | 30 IP | "One full week of choosing to learn. The rhythm is real now." |
| **Monthly Discipline** | Reach a 30-day streak | 75 IP | "Thirty days. The research is clear — this is a habit, not a streak." |
| **Centurion** | Reach a 100-day streak | 200 IP | "One hundred days. Most people set goals. You built a practice." |
| **Year of Insight** | Reach a 365-day streak | 500 IP | "Three hundred sixty-five days. A full year of deliberate curiosity. Extraordinary." |
| **Steady State** | Maintain 80%+ consistency score for 60 consecutive days | 50 IP | "Sixty days above eighty percent. You don't need a perfect streak — you just keep showing up." |

Note: These overlap with streak milestones intentionally. The streak milestone awards IP at the moment it happens; the achievement adds recognition and a permanent record to the profile. The IP values here are IN ADDITION to the streak milestone IP.

### 4.3 Exploration Track

Achievements demonstrating intellectual breadth and willingness to venture outside comfort zones.

| Achievement | Criteria | IP | Celebration Copy |
|-------------|----------|-----|-----------------|
| **Curious Mind** | Complete loops in 3 different categories | 25 IP | "Three different domains. Curiosity doesn't stay in one lane — neither do you." |
| **Cross-Disciplinary** | Complete loops in 7 different categories | 50 IP | "Seven categories. You're building the kind of broad foundation that makes deep work possible." |
| **Renaissance Reader** | Complete loops in 12 different categories | 80 IP | "Twelve domains. The connections between fields — that's where the real insights live." |
| **Omnivore** | Complete loops in 18+ different categories | 150 IP | "Eighteen categories. Very few readers venture this wide. The mental models you're accumulating are compounding." |
| **Bridge Builder** | Complete 3 entire books in 3 different categories | 60 IP | "Three books across three domains. You don't just sample — you finish." |

### 4.4 Hidden Track

Achievements that are **undiscoverable until earned**. They never appear in achievement lists, progress views, or "Ways to Earn" — they surface only when the user's natural behavior triggers them. All are triggered by genuine usage patterns, not gameable behaviors.

| Achievement | Criteria | IP | Celebration Copy | Detection Method |
|-------------|----------|-----|-----------------|-----------------|
| **Night Owl** | Complete 5 learning loops between 10pm and 5am (user's local time) | 30 IP | "Discovery: Night Owl. Some of the best thinking happens when the world is quiet." | Server checks loop completion timestamp against user timezone |
| **Dawn Reader** | Complete 5 learning loops between 5am and 7am (user's local time) | 30 IP | "Discovery: Dawn Reader. Starting the day with learning — there's something powerful in that." | Same |
| **Weekend Scholar** | Complete loops on 8 consecutive weekend days (4 Sat+Sun pairs) | 40 IP | "Discovery: Weekend Scholar. While others rest, you chose to grow." | Track weekend-day loop completions |
| **Marathon Session** | Complete 5 learning loops in a single calendar day | 35 IP | "Discovery: Marathon Session. Five chapters in one sitting — that's genuine immersion." | Count daily loops |
| **Full Circle** | Finish a book that was started more than 90 days ago | 45 IP | "Discovery: Full Circle. You came back and finished what you started. Most people don't." | Compare book start date to completion date |
| **Second Wind** | Complete a learning loop after 14+ consecutive days of inactivity | 25 IP | "Discovery: Second Wind. Coming back is harder than starting. Welcome back." | Check gap between current and last activity |
| **Century Loop** | Complete the 100th learning loop | 50 IP | "Discovery: Century Loop. One hundred chapters of genuine understanding. Milestone unlocked." | Check total loop count |

**Display treatment for hidden achievements:**
- Before earned: Not visible anywhere. No hints, no "???" placeholders.
- On earn: A distinctive glassmorphic modal with a violet shimmer border and the text "Discovery unlocked:" above the achievement name.
- After earned: Appears in the Hidden section of the achievement list with an "Unlocked [date]" label. The criteria is revealed.

---

## 5. Spending and Redemption System

### 5.1 Sink Table

| Item | IP Cost | One-time / Repeatable | Availability | Category | Justification |
|------|---------|----------------------|-------------|----------|---------------|
| **Bonus Book Unlock** | 900 IP | One-time | Free only | Bridge | *Preserved.* ~1.6 weeks of typical earning. |
| **7-Day Pro Pass** | 2,400 IP | One-time | Free only | Bridge | *Preserved.* ~4.2 weeks of typical earning. |
| **30-Day Pro Pass** | 6,500 IP | One-time | Free only | Bridge | *Preserved.* ~11.3 weeks of typical earning. |
| **Streak Shield** | 100 IP | Repeatable | All | Utility | ~0.9 days of typical earning. Affordable enough to purchase regularly, expensive enough to create meaningful spending. |
| **Gift a Friend 1 Week Pro** | 800 IP | Repeatable | All | Prosocial | ~6.7 days of typical earning. The primary repeatable sink. Priced to be affordable enough for regular use (~once every 4–6 weeks for a typical user) without trivializing Pro access. At 1,200 IP, internal analysis showed the sink was too expensive to drive meaningful spending velocity — typical users could only afford ~1 gift per quarter, reducing its effectiveness as a terminal-accumulation countermeasure. At 800 IP, a typical user can gift every 4–6 weeks while maintaining shield spending, producing a 60–65% spend rate. |
| **Obsidian Theme** | 400 IP | One-time | All | Personalization | ~3.5 days. Pure black tones with subtle geometric patterns. |
| **Twilight Theme** | 500 IP | One-time | All | Personalization | ~4.4 days. Deep purple-blue gradient panels. |
| **Ember Theme** | 500 IP | One-time | All | Personalization | ~4.4 days. Warm amber-tinted dark panels. |
| **Aurora Theme** | 600 IP | One-time | All | Personalization | ~5.3 days. Deep green-teal glassmorphic panels. |
| **Analyst Frame** | 150 IP | One-time | Analyst+ tier | Personalization | Tier-gated profile frame. Clean geometric lines. |
| **Synthesizer Frame** | 300 IP | One-time | Synthesizer+ tier | Personalization | Tier-gated. Refracting light motif. |
| **Polymath Frame** | 500 IP | One-time | Polymath+ tier | Personalization | Tier-gated. Full spectrum geometric design. |
| **Luminary Frame** | 800 IP | One-time | Luminary tier | Personalization | Tier-gated. Radiant halo effect. |
| **Seasonal Item** | 500–1,000 IP | One-time per item | All | Rotating | Quarterly rotation (4 per year). Examples: "Solstice" theme (winter), "Equinox" frame (spring). Available for ~8 weeks, then replaced. Creates gentle urgency without manipulative FOMO. |

### 5.2 Economy Balance Analysis

**Baseline: Typical active user (5 loops/week, standard mode, first attempts, maintains streak with shields)**

| Source | Weekly IP | Notes |
|--------|----------|-------|
| Quiz Pass (5 × 60) | 300 IP | Standard mode, first attempt |
| Loop Complete (5 × 40) | 200 IP | Unlock step completion |
| Streak Day Bonus (5 × 15) | 75 IP | Active days only |
| Insight Spark (~12% × 5 × avg 30) | ~18 IP | Variable, expected value |
| Welcome Back | ~0 IP | Typical active users do not trigger this |
| **Gross Weekly** | **~593 IP** | |
| Streak Shields (2/week × 100) | −200 IP | Covers 2 off-days |
| **Net Weekly** | **~393 IP** | |
| **Net Monthly (4 weeks)** | **~1,572 IP** | |
| **Gross Monthly** | **~2,375 IP** | |

**Expected monthly spending pattern (after one-time purchases exhausted):**

| Sink | Monthly IP | Frequency |
|------|-----------|-----------|
| Streak Shields | ~800 IP | ~8/month |
| Gift a Friend (800 IP) | ~533 IP | ~1 per 6 weeks (amortized) |
| Seasonal Item | ~200 IP | ~1 per quarter (amortized) |
| **Monthly Spend** | **~1,533 IP** | |

**Projected steady-state balance: ~842 IP net accumulation per month** before occasional one-time purchases (themes 400–600 IP, frames 150–800 IP). With intermittent one-time purchases in the first 3–6 months, steady-state balance settles at **600–1,400 IP** — within target range.

**Spend rate: ~65%** (1,533 spent / 2,375 gross monthly) — within 40–70% target. ✓

**IP velocity: ~18 days** (average time from earning to spending, based on shield purchase cadence as the most frequent transaction) — within 14–28 day target. ✓

**One-time purchase absorption (first 6 months):**
Total one-time sinks available: 4 themes (2,000 IP) + 4 frames (1,750 IP) + 2 seasonal items (~1,500 IP) = ~5,250 IP. At ~842 IP net accumulation/month, these are absorbed within the first ~6 months, after which the user enters pure steady-state with only repeatable sinks.

**Referral earnings (amended):**
With the 600 IP Pro conversion payout removed, referral earnings for a typical user who refers 2–3 friends per year consist of: activation rewards (200 IP each for Pro inviter, or 1 week Pro for free inviter) + no per-conversion bonus. Total: ~400–600 IP/year from referrals, or ~35–50 IP/month amortized. This is negligible relative to loop earnings and does not affect the economy balance analysis.

**Power user scenario (7 loops/week, challenge mode, natural streak):**

| Source | Weekly IP |
|--------|----------|
| Quiz + Loop (7 × 150) | 1,050 IP |
| Perfect scores (~3/week × 80) | 240 IP |
| Streak Day (7 × 15) | 105 IP |
| Insight Spark | ~25 IP |
| **Weekly** | **~1,420 IP** |
| **Monthly** | **~5,680 IP** |

**Power user spending (steady state, after one-time sinks exhausted):**

| Sink | Monthly IP | Notes |
|------|-----------|-------|
| Streak Shields | 0 IP | Natural streak, no missed days |
| Gift a Friend (800 IP × 2–3) | 1,600–2,400 IP | Power users are most likely to gift frequently |
| Seasonal Item | ~250 IP | Amortized quarterly |
| **Monthly Spend** | **~1,850–2,650 IP** | |

**Power user spend rate: 33–47%.** At 2 gifts/month (33%), the rate is at the lower boundary. At 3 gifts/month (47%), it enters the healthy range. Power users naturally accumulate — their spend rate depends heavily on gifting behavior. The Gift a Friend price reduction from 1,200 to 800 IP makes more frequent gifting realistic. Soft-decay (§9) provides a backstop if power user balances consistently exceed 3,000 IP after 6 months. See §5.4 for additional detail.

**Tier advancement impact (amended):** Total tier IP reduced from 3,700 to 2,000 across all four advancements. For a power user reaching Luminary, this is a 1,700 IP reduction — roughly 1.2 weeks of their earning. Negligible economy impact, but prevents a late-game IP dump into an already-saturated balance.

### 5.3 Pro User Economy

**Problem:** The current system excludes Pro users from all three bridge redemptions (`freeOnly: true`). Pro users are the highest-LTV segment and need meaningful spending.

**Solution:** The following sinks are available to ALL users (free and Pro):

| Sink | Available to Pro? | Repeatable? | Notes |
|------|-------------------|-------------|-------|
| Streak Shield | Yes | Yes | Primary utility sink for all users |
| Gift a Friend 1 Week Pro | Yes | Yes | Primary prosocial sink — Pro users are most likely to gift |
| All Themes | Yes | One-time each | Personalization |
| Tier-gated Frames | Yes | One-time each | Identity expression |
| Seasonal Items | Yes | One-time each | Rotating collection |

**Pro users earning profile:** Same as free users, but without the 3 bridge sinks motivating saving. This means they spend more freely on shields, gifts, and personalization — which is the intended behavior.

### 5.4 Terminal Sink Prevention

The terminal accumulation problem (engaged users eventually exhaust all one-time sinks) is addressed through four mechanisms:

1. **Gift a Friend (repeatable, unlimited):** The most important sink. A Pro power user who gifts 2–3 friends/month spends 1,600–2,400 IP at 800 IP per gift — a significant portion of their earning. The prosocial framing, accessible price point, and unlimited repeatability make this the long-term steady-state sink.

2. **Streak Shields (repeatable, consumed on use):** Even users who rarely miss days will maintain a buffer of 3 shields, periodically consuming and repurchasing.

3. **Seasonal rotation (quarterly new items):** Four new items per year at 500–1,000 IP each creates ~2,500 IP of annual new sink demand.

4. **Soft-decay (designed, not initially implemented):** If monitoring shows average balances exceeding 3,000 IP after 6 months, implement: points older than 180 days decay at 5% per month, applied only to balance above 2,000 IP, capped at 200 IP decay per month. Users receive a 30-day notice before first decay. See §9 for full specification.

---

## 6. Referral System

### 6.1 Reward Structure

**Prosocial framing is mandatory.** All referral copy leads with what the friend receives, not what the inviter earns.

| Role | Reward | Conditions |
|------|--------|------------|
| **Invitee** | 1 free week of Pro | Applied automatically when invitee completes first full learning loop |
| **Inviter (free plan)** | 1 free week of Pro | Activated when invitee completes first loop |
| **Inviter (Pro plan)** | 200 IP | Activated when invitee completes first loop |

The `referral_pro_inviter` payout (previously 600 IP per Pro conversion) has been **removed entirely**. Rationale: (a) it was uncapped per-occurrence — 25 referrals could produce 15,000 IP from conversions alone; (b) it was the system's highest individual award, creating a structural incentive to optimize for referral farming over learning; (c) it framed referrals as sender-benefit, contradicting the prosocial design principle. The motivational value is redistributed into the escalation tier bonuses (§6.3), which are bounded, milestone-gated, and reward sustained referral quality over individual conversion events.

### 6.2 Activation Threshold

**Current:** Invitee completes onboarding + starts first book (too shallow — doesn't require experiencing core value).

**New:** Invitee completes their **first full learning loop** (all 4 steps with passing quiz score). This ensures:
- The invitee has experienced the core product value
- The referral represents genuine product adoption, not just signup
- The inviter's reward correlates with actual activation, not surface-level engagement

### 6.3 Escalation Tiers

Inviter milestone bonuses for sustained referral success, capped at **25 successful activations per rolling 12-month period**. These escalation tiers are now the **only** source of outsized referral rewards — the per-conversion 600 IP payout has been removed (see §6.1). The values below are increased from the original specification to compensate.

| Milestone | Bonus | Additional Reward |
|-----------|-------|-------------------|
| 3 activations | +300 IP | "Mentor" profile frame (exclusive, not purchasable) |
| 5 activations | +600 IP | "Meridian" reading theme (exclusive, not purchasable) |
| 10 activations | +1,200 IP | 30-Day Pro Pass (free inviter) or 1,200 IP (Pro inviter) |
| 25 activations (annual cap) | +2,500 IP | "Advocate" achievement badge (permanent, visible on profile) |

**Total escalation IP: 4,600 IP** across all four milestones (increased from 2,900 to absorb the removed per-conversion payout).

**Lifetime referral earning ceiling (rolling 12-month, maximum 25 activations):**

| Source | Max IP (Pro inviter) | Max IP (Free inviter) |
|--------|---------------------|-----------------------|
| Per-activation (200 IP × 25) | 5,000 IP | 0 IP (gets Pro weeks instead) |
| 3-activation milestone | 300 IP | 300 IP |
| 5-activation milestone | 600 IP | 600 IP |
| 10-activation milestone | 1,200 IP | 1,200 IP |
| 25-activation milestone | 2,500 IP | 2,500 IP |
| **Annual ceiling** | **9,600 IP** | **4,600 IP** (+ 25 Pro weeks) |

For a Pro inviter: 9,600 IP over 12 months = **800 IP/month** amortized at maximum referral volume. This is meaningful but bounded — roughly equivalent to 1 Gift a Friend per month. The old system with Pro conversion payouts had a theoretical ceiling of 22,900 IP/year (2.4x higher).

**Cap mechanics:** The rolling 12-month window is tracked per inviter. After 25 activations in any 12-month period, new referral invitations still work (invitees still get their Pro week), but the inviter earns no further rewards until the window resets. This prevents referral farming while preserving the invitee experience.

### 6.4 Share Message Template

Pre-written, editable by user before sending:

> I've been using ChapterFlow to learn key ideas from nonfiction books — it's the best way I've found to actually retain what I read. Here's a free week of Pro, on me: [personalized link]

**CTA button in app:** "Give a friend a free week of Pro"

**Not:** "Earn points by inviting" / "Invite friends for rewards" / "Share and earn"

### 6.5 Contextual Trigger Moments

Referral prompts appear only at natural satisfaction peaks, subject to these hard rules:
- Maximum **1 referral prompt per session**
- **Never during a learning loop** (never interrupts Summary, Scenarios, Quiz, or Unlock)
- **Not shown until user has completed ≥ 3 learning loops** (earned right to recommend)
- Prompt is a **dismissible card**, not a modal or blocking UI

| Trigger Event | Prompt Copy | Priority |
|---------------|-------------|----------|
| Book completion | "You just finished [Book Title]. Know someone who'd get value from it? Give them a free week." | Highest |
| Tier advancement | "You've reached [Tier]. Share ChapterFlow with someone who'd appreciate it — they'll get a free week of Pro." | High |
| 7-day streak milestone | "A full week of learning. Want to bring someone along? Give a friend a free week." | Medium |
| Hidden achievement earned | "You just discovered something special. Know a fellow reader who'd enjoy ChapterFlow?" | Low |

Only one prompt fires per session, selected by highest priority. If multiple triggers occur in the same session, only the highest-priority one displays.

### 6.6 Fraud Prevention

| Check | Threshold | Action |
|-------|-----------|--------|
| Device fingerprint match | Invitee shares device fingerprint with inviter | Block activation, flag for review |
| Device fingerprint velocity | Same device used by ≥ 3 different invitees in 30 days | Block all pending activations from that device |
| Network + user-agent match | Invitee on same IP + user-agent as inviter during first 24 hours | Flag for manual review |
| Disposable email domain | Invitee email matches known disposable domain list (maintained, ~3,000 domains) | Block referral claim at signup |
| Inviter velocity | > 5 activations per inviter per 7-day rolling window | Delay reward release, flag for review |
| Invitee engagement minimum | Invitee must complete first full learning loop (not just signup) | Structural — activation threshold handles this |
| Cross-referral detection | Two users refer each other | Block both rewards, flag for review |

All flagged referrals enter a manual review queue. Rewards are held in "pending" status until review completes (approved or rejected).

---

## 7. Variable and Surprise Reward Mechanics

### 7.1 Random Bonus Mechanic: Insight Spark

A small, delightful variable-ratio reward that fires after learning loop completion.

| Property | Value |
|----------|-------|
| Trigger | After any learning loop completion (Unlock step finished) |
| Probability | 12% per loop (server-side roll, not client-predictable) |
| Amount | Random from {15, 20, 25, 30, 35, 40, 45} IP, uniform distribution |
| Expected value per loop | ~3.6 IP (12% × 30 avg) |
| Cooldown | Cannot trigger on consecutive loops within the same session |
| Display | Subtle prismatic shimmer on the IP counter, followed by a soft toast |
| Server seed | `hash(userId + date + loopSequenceNumber)` — deterministic per-user-per-loop but unpredictable to the user |

**Toast copy (randomly selected):**
- "Insight Spark — your curiosity was rewarded."
- "Insight Spark — a spark of unexpected understanding."
- "Insight Spark — sometimes learning rewards you in surprising ways."

**Why this is not a loot box or casino mechanic:**
- The user has already earned their full fixed IP from the loop. The Spark is purely additive.
- There is no choice, wager, anticipation mechanic, or reveal animation.
- The amount range (15–45 IP) is small relative to the base earning (80–230 IP).
- The display is subtle (shimmer + toast), not dramatic (no spinners, no suspense).
- No real money is involved in any direction.

### 7.2 Hidden Achievement Triggers

See §4.4 for the full list of 7 hidden achievements. Their interaction with the core economy:

- Hidden achievement IP values (25–50 IP) are small relative to loop earnings.
- They are one-time, so they don't create a sustained faucet imbalance.
- Total IP from all hidden achievements: 255 IP — less than 2 days of typical earning.
- Their purpose is delight and identity reinforcement, not economy impact.

### 7.3 Interaction with Core Economy

The variable reward layer adds approximately **3-5% to total IP earning** for a typical user:

| Source | Weekly IP | % of Gross |
|--------|----------|-----------|
| Fixed loop earnings | ~575 IP | ~94% |
| Insight Spark | ~18 IP | ~3% |
| Achievements (amortized) | ~15 IP | ~2.5% |
| Streak milestones (amortized) | ~5 IP | ~0.5% |
| **Total** | **~613 IP** | **100%** |

The variable layer is intentionally small. It creates moments of delight without distorting the economy or creating expectations of random rewards.

---

## 8. UX, Copy, and Presentation

### 8.1 Display Rules

**IP Balance Display:**

| Context | Treatment | Content |
|---------|-----------|---------|
| Header bar | Compact: diamond icon + number | "◇ 1,247" |
| Dashboard card | Large: balance + label + lifetime stats | "1,247 Insight Points" with "Earned: 4,830 · Redeemed: 3,583" below |
| Profile page | Medium: balance + tier badge + consistency score | Balance, tier icon, consistency ring |
| Rewards page | Large: balance + next reward progress + full catalog | Full earning/spending UI |
| Post-loop summary | Inline: earned amounts with source labels | "+100 IP — Chapter mastered" |

**Streak Display:**

| Context | Treatment |
|---------|-----------|
| Header bar | Flame icon + day count: "🔥 14" |
| Dashboard | Streak card with flame, day count, shield count, and next milestone |
| Profile | Streak + longest streak + consistency score ring |
| Post-loop | "Day [X] of your streak" inline text |

**Tier Display:**

| Context | Treatment |
|---------|-----------|
| Profile header | Tier icon (prism) + tier name + progress bar to next |
| Dashboard | Compact tier badge next to username |
| Achievement list | Tier shown in header as context for achievement progress |
| Post-tier-advance | Modal celebration (see §3.4) |

**Icon:** The IP icon is a **geometric diamond/prism** (◇), not the current Zap (⚡). The prism motif represents refracted understanding — knowledge broken into its component insights. It scales from a simple outline (Reader) to a radiant, spectrum-refracting design (Luminary) based on tier.

### 8.2 Celebration Copy Framework

All celebration copy follows the pattern: **[Learning accomplishment]. [Identity reinforcement or insight].** IP value appears below in smaller text, never in the headline.

#### Five Trigger Types with Example Copy

**1. Learning Loop Completion (every loop):**
> "You demonstrated solid understanding of [Chapter Name]."
> *+100 IP*

For perfect score:
> "Perfect comprehension of [Chapter Name]. Not a single concept missed."
> *+150 IP (includes +50 IP perfect score bonus)*

**2. Streak Milestone (at thresholds):**
> **7-day:** "One full week. You chose to learn seven days in a row — that puts you ahead of most people who start."
> *+50 IP*

> **30-day:** "Thirty days. The science says this is no longer a streak — it's a habit."
> *+200 IP*

**3. Tier Advancement:**
> **Analyst:** "You've reached Analyst — you've demonstrated consistent comprehension across [X] chapters in [Y] categories."
> *+200 IP*

> **Synthesizer:** "You've reached Synthesizer — connecting ideas across [X] categories with an average score of [Y]%."
> *+400 IP*

**4. Book Completion:**
> "You finished [Book Title]. That's [X] chapters of genuine understanding in [Category]."
> *+120 IP*

**5. Hidden Achievement Discovery:**
> "Discovery unlocked: [Achievement Name]"
> *"[Celebration copy from §4.4]"*
> *+[IP value]*

**Copy anti-patterns (never use):**
- Leading with points: "~~+100 IP! You completed a chapter!~~"
- Gaming language: "~~Level up! Achievement unlocked! XP earned!~~"
- Guilt: "~~Don't break your streak! You'll lose your progress!~~"
- Hollow enthusiasm: "~~Amazing! Incredible! You're on fire!~~"
- Comparison: "~~You're in the top 5% of readers!~~"

### 8.3 Tenure-Aware Presentation

The system adapts reward prominence based on user age to scaffold the extrinsic-to-intrinsic transition.

**Days 1–14 (Scaffolding Phase):**
- IP earning toast after **every** loop completion and earning event
- IP counter in header with subtle glow animation on change
- Dashboard: IP section is the **first** card, prominently sized
- "Ways to Earn" card expanded by default on dashboard
- Streak section prominent with day count and shield availability
- Tier progress bar visible with clear "Next: Analyst" label
- Achievement progress cards visible for nearest achievements

**Days 15–60 (Habit Formation Phase):**
- IP earning toast only for amounts **≥ 50 IP** (milestones, bonuses, tier advances)
- IP counter in header, standard display (no glow)
- Dashboard: Learning stats card moves to **first** position (books read, chapters completed, categories explored). IP section moves to **second**.
- "Ways to Earn" collapsed by default
- Streak display remains visible (streaks remain motivating through habit formation)
- Begin showing "Personal Records" section (longest streak, highest quiz score, most productive week)

**Days 60+ (Intrinsic Phase):**
- IP earning toast only for **milestones, tier advances, and hidden achievements**
- IP counter compact in header (number only, no "Insight Points" label)
- Dashboard: Personal learning insights lead ("You've explored [X] categories this month," "Your average quiz score has improved [Y]% since starting"). IP balance shown as compact summary.
- Streak display remains but is smaller — at this point, the streak is self-sustaining
- Focus shifts to mastery stats, knowledge map (categories explored as a visual), and personal bests

**Implementation:** Tenure is computed from account creation date. The transitions are gradual CSS class changes (e.g., `data-tenure="scaffolding"` | `"forming"` | `"intrinsic"` on the dashboard container), not hard switches.

### 8.4 Accurate "Ways to Earn" Specification

Replace the current misleading display with accurate, mode-aware information:

**"Ways to Earn" Section Content:**

| Activity | Display | Detail |
|----------|---------|--------|
| Complete a learning loop | "80–230 IP" | "Varies by mode and quiz performance. Challenge mode and perfect scores earn the most." |
| Maintain your streak | "+15 IP/day" | "Awarded on your first loop each day while your streak is active." |
| Finish a book | "120 IP" | "Awarded when you complete every chapter." |
| Earn an achievement | "15–500 IP" | "Different achievements award different amounts. Check the Achievements tab for details." |

**Achievement IP range verification:** The "15–500 IP" range is confirmed against all 23 achievements across four tracks. Minimum: First Spark (Consistency, 15 IP). Maximum: Year of Insight (Consistency, 500 IP). Full distribution: Mastery track 20–120 IP (5 achievements), Consistency track 15–500 IP (6 achievements including Steady State), Exploration track 25–150 IP (5 achievements), Hidden track 25–50 IP (7 achievements). This range does NOT include tier advancement IP (200–800 IP, listed separately) or streak milestone IP (25–1,500 IP, listed separately).
| Complete onboarding | "120 IP" | "One-time award for setting up your reading preferences." |
| Refer a friend | "1 week Pro or 200 IP" | "Give a friend a free week of Pro — you'll both be rewarded." |

**Expanded breakdown (accessible via "See details" link):**

| Mode | Base Range | With Perfect Score |
|------|-----------|-------------------|
| Guided | 50–80 IP | 80–110 IP |
| Standard | 60–100 IP | 110–150 IP |
| Challenge | 100–150 IP | 180–230 IP |

---

## 9. Anti-Abuse and Economy Health

### 9.1 Referral Fraud Prevention

See §6.6 for the complete referral fraud prevention specification.

### 9.2 Quiz Rate Limiting (Preserved)

The existing quiz rate limiting is preserved unchanged:
- Maximum 5 quiz attempts per chapter per hour
- Escalating cooldown after consecutive failures (computed by `cooldownSecondsForFailureStreak()`)
- Tracked in `BOOK_USER_QUIZ_STATE.failureStreak` and `nextEligibleAttemptAt`

### 9.3 Economy Health Monitoring

**Dashboard metrics (checked weekly, automated alerts for threshold breaches):**

| Metric | Healthy Range | Warning Threshold | Alert Threshold | Action |
|--------|--------------|-------------------|-----------------|--------|
| Average user balance | 500–1,500 IP | < 300 or > 2,000 IP | < 200 or > 3,000 IP | Investigate earning/spending imbalance |
| Median user balance | 300–1,200 IP | < 200 or > 1,800 IP | < 100 or > 2,500 IP | Cross-check with average for distribution skew |
| Spend rate (monthly) | 40–70% | < 30% or > 80% | < 20% or > 90% | If low: add sinks or increase sink appeal. If high: check for exploit |
| IP velocity (earn-to-spend) | 14–28 days | < 7 or > 42 days | < 3 or > 60 days | If fast: users may be dumping points. If slow: sinks not compelling |
| Balance Gini coefficient | 0.3–0.6 | > 0.7 | > 0.8 | Extreme inequality — investigate if top earners are exploiting |
| Gross monthly faucet | Tracked, no fixed range | > 20% change month-over-month | > 40% change | Catalog or behavior change causing inflation |
| Gross monthly sink | Tracked, no fixed range | > 20% change month-over-month | > 40% change | Sink demand change — investigate |
| Streak Shield consumption rate | Informational | > 60% of shields purchased are consumed | > 80% | Users may be over-relying on shields — consider adjusting streak definition |

**Monitoring implementation:** Compute metrics from ENGAGEMENT and LEDGER records via a scheduled Lambda function (weekly). Store results in the analytics table. Surface on an admin dashboard.

### 9.4 Admin Adjustment Mechanism

**Endpoint:** `POST /api/book/admin/flow-points/adjust`

**Request body:**
```typescript
{
  userId: string;       // Target user
  amount: number;       // Positive (grant) or negative (deduct)
  reason: string;       // Required, minimum 10 characters
}
```

**Behavior:**
1. Validates admin authentication and authorization
2. Validates `amount` is a finite integer and `reason` meets minimum length
3. Calls `awardFlowPoints()` (for positive) or a new `deductFlowPoints()` (for negative) with `sourceType: "admin_adjustment"`
4. Records admin user ID in metadata
5. Creates ledger entry with `direction: "adjustment"`
6. Fires analytics event

**Constraints:**
- Single adjustment capped at ±10,000 IP (prevents accidental catastrophic changes)
- All adjustments are logged with the admin's user ID, timestamp, reason, and amount
- Adjustments appear in the user's transaction history as "Points adjustment" with the reason visible to the user
- No batch adjustments — one user at a time to force intentionality

### 9.5 Soft-Decay Design (Designed, Not Initially Implemented)

**Recommended implementation timing:** 6+ months after launch, only if monitoring shows average active-user balance consistently > 2,500 IP.

**Design:**
- Applies only to balances above 2,000 IP
- Decay rate: 5% of (balance − 2,000) per month
- Maximum decay: 200 IP per month (prevents dramatic balance drops)
- Decay computed on the 1st of each month
- Users receive notification 30 days before first potential decay: "Points older than 6 months may begin to expire. Spend them on shields, gifts, or personalization to keep your balance active."
- Decay creates a ledger entry with `sourceType: "expiration"`, `direction: "spend"`
- Decay does NOT apply to users who have made any spend transaction in the last 60 days (active spenders are exempt)

**Example:** User has 4,000 IP and hasn't spent in 60+ days. Decay = 5% of (4,000 − 2,000) = 100 IP. New balance: 3,900 IP. The user retains 97.5% of their balance. Capped at 200 IP even if balance is very high.

---

## 10. Data Model Additions

All new records follow the existing single-table DynamoDB design with `PK` (partition key) and `SK` (sort key).

### 10.1 New DynamoDB Records

#### STREAK Record
```
PK: BOOKUSER#{userId}
SK: STREAK
```
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | User ID |
| `currentStreak` | number | Current consecutive days |
| `longestStreak` | number | All-time high (never decreases) |
| `lastActiveDate` | string | `YYYY-MM-DD` in user's timezone |
| `lastActiveTimezone` | string | IANA timezone (e.g., "America/Toronto") |
| `streakShieldsHeld` | number | Current shield inventory (0–3) |
| `shieldUsedDates` | string[] | Dates where shields auto-activated |
| `consistencyLast30` | number | Active days in last 30 (cached, updated on activity) |
| `consistencyAbove80Since` | string \| null | ISO date when consistency score first exceeded 80%. Resets to null if score drops below 80%. Used for "Steady State" achievement (§4.2) — triggers at 60 consecutive days above 80%. |
| `milestonesReached` | number[] | Array of milestone days already claimed (e.g., [3, 7, 14]) |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

#### TIER Record
```
PK: BOOKUSER#{userId}
SK: TIER
```
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | User ID |
| `currentTier` | string | `"reader"` \| `"analyst"` \| `"synthesizer"` \| `"polymath"` \| `"luminary"` |
| `totalLoopsCompleted` | number | Lifetime full learning loops |
| `avgQuizScoreSum` | number | Running sum of best scores per chapter |
| `avgQuizScoreCount` | number | Count of chapters with scores |
| `categoriesExplored` | string[] | Distinct categories with ≥ 1 completed loop |
| `tiersAdvanced` | string[] | Tiers already reached (prevents re-awarding IP) |
| `tierAdvancedAt` | string | ISO timestamp of most recent tier advance |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

Avg quiz score = `avgQuizScoreSum / avgQuizScoreCount`.

#### ACHIEVEMENT Record (one per achievement per user)
```
PK: BOOKUSER#{userId}
SK: ACHIEVEMENT#{achievementId}
```
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | User ID |
| `achievementId` | string | Achievement identifier (e.g., `"sharp-focus"`, `"night-owl"`) |
| `track` | string | `"mastery"` \| `"consistency"` \| `"exploration"` \| `"hidden"` |
| `earnedAt` | string | ISO timestamp |
| `ipAwarded` | number | IP granted for this achievement |
| `metadata` | Record | Context (e.g., `{ quizScore: 100, bookId: "..." }`) |
| `createdAt` | string | ISO timestamp |

#### LOOP Record (one per completed learning loop)
```
PK: BOOKUSER#{userId}
SK: LOOP#{bookId}#{paddedChapterNumber}
```
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | User ID |
| `bookId` | string | Book ID |
| `chapterNumber` | number | Chapter number |
| `completedAt` | string | ISO timestamp of Unlock step completion (the moment the user completes the 4th step of the learning loop) |
| `quizScore` | number | Best quiz score for this chapter |
| `learningMode` | string | `"guided"` \| `"standard"` \| `"challenge"` |
| `isFirstAttempt` | boolean | Whether quiz was passed on first try |
| `category` | string | Primary category of the book (denormalized for query efficiency) |
| `createdAt` | string | ISO timestamp |

#### INVENTORY Record (one per owned item)
```
PK: BOOKUSER#{userId}
SK: INVENTORY#{itemType}#{itemId}
```
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | User ID |
| `itemId` | string | Item identifier (e.g., `"obsidian"`, `"analyst-frame"`) |
| `itemType` | string | `"theme"` \| `"frame"` \| `"seasonal"` |
| `acquiredAt` | string | ISO timestamp |
| `equipped` | boolean | Whether currently active |
| `ipCost` | number | IP spent to acquire |
| `createdAt` | string | ISO timestamp |

### 10.2 New Fields on Existing Records

#### ENGAGEMENT Record (existing: `PK: BOOKUSER#{userId}`, `SK: ENGAGEMENT`)
No schema changes needed. The `points` field already tracks balance. The display name "Flow Points" → "Insight Points" is a UI-only change; the field name `points` remains unchanged in DynamoDB.

#### REFERRAL Record (existing: `PK: BOOKUSER#{userId}`, `SK: REFERRAL`)
Add fields:

| New Field | Type | Description |
|-----------|------|-------------|
| `rollingYearActivations` | number | Activations in current 12-month window |
| `capWindowStart` | string | ISO date when current 12-month cap window began |
| `highestMilestoneReached` | number | 0, 3, 5, 10, or 25 |

#### REFERRALCLAIM Record (existing: `PK: BOOKUSER#{userId}`, `SK: REFERRALCLAIM`)
Modify activation qualification:

| Changed Field | Old Meaning | New Meaning |
|---------------|-------------|-------------|
| `activationQualifiedAt` | Onboarding + book start | First full learning loop completion |

### 10.3 PK/SK Pattern Summary

| Record | PK | SK | Purpose |
|--------|-----|-----|---------|
| Streak | `BOOKUSER#{userId}` | `STREAK` | Streak state, shields, consistency |
| Tier | `BOOKUSER#{userId}` | `TIER` | Tier progress, requirements tracking |
| Achievement | `BOOKUSER#{userId}` | `ACHIEVEMENT#{achievementId}` | Per-achievement earned state |
| Loop | `BOOKUSER#{userId}` | `LOOP#{bookId}#{paddedChapterNumber}` | Per-chapter loop completion record |
| Inventory | `BOOKUSER#{userId}` | `INVENTORY#{itemType}#{itemId}` | Owned personalization items |
| Points Grant | `BOOKUSER#{userId}` | `POINTSGRANT#{sourceType}#{sourceId}` | *Existing.* New source types: `loop_complete`, `streak_day`, `streak_milestone`, `tier_advance`, `achievement_earned`, `insight_spark`, `welcome_back` |
| Ledger Entry | `BOOKUSER#{userId}` | `FLOWPOINTS#{createdAt}#{transactionId}` | *Existing.* New source types added to ledger |

---

## 11. Phased Rollout Plan

### P0: Foundation (Weeks 1–4)

**Goal:** Rename, fix bugs, implement split earning, and launch streak system.

| Task | Details | Priority |
|------|---------|----------|
| Rename "Flow Points" → "Insight Points" | All code references, UI copy, component names, hook names, API response fields (display names only — DynamoDB field `points` unchanged) | Critical |
| Replace Zap icon with diamond/prism icon | Header, dashboard, rewards page, celebrations, toasts | Critical |
| Fix UnlockCelebration.tsx | Replace hardcoded `value: "25"` with dynamic value from `FLOW_POINTS_AMOUNTS.onboardingComplete` (120) | Critical |
| Fix "Ways to Earn" display | Replace `quizPass: 15` with accurate mode-aware range table (see §8.4) | Critical |
| Consolidate badge definitions | Merge `mockBadges.ts` and `badge-data.ts` into single source file using unified `ipValue` property | Critical |
| Implement loop complete endpoint | `POST /api/book/me/loop-complete/[bookId]/[chapterNumber]` — awards loop completion IP, validates quiz pass exists | Critical |
| Split quiz earning | Adjust quiz submit route to award reduced IP (quiz-pass portion only). Loop complete awards remainder. | Critical |
| Create STREAK DynamoDB record | Schema per §10.1. Migrate existing localStorage streak state on first server-side check. | Critical |
| Implement server-side streak tracking | Update streak on loop completion. Apply timezone-aware day boundary. | Critical |
| Implement Streak Shield | Purchase (100 IP), inventory (max 3), auto-activation on missed days | High |
| Add streak day bonus | +15 IP on first loop of each active streak day | High |
| Create LOOP DynamoDB record | Written on Unlock step completion | High |
| Implement Welcome Back bonus | 30 IP on first loop after 7+ inactive days, repeatable. Checked during loop-complete endpoint. | Medium |
| Remove dead constants | `dailyGoalComplete`, `weeklyGoalComplete`, `quizSpeedBonus`, `quizScoreImproved`, `scenarioSubmitted`, `streakBonus`, `reviewSessionComplete`, `reviewAllCorrect` | Medium |

### P1: Amplification (Weeks 4–8)

**Goal:** Streak celebrations, tier system, core achievements.

| Task | Details | Priority |
|------|---------|----------|
| Streak milestone celebrations | Toast/modal celebrations at 3, 7, 14, 30, 60, 100, 200, 365 days with copy per §2.4 | Critical |
| Create TIER DynamoDB record | Schema per §10.1. Initialize all existing users at Reader. | Critical |
| Implement tier advancement logic | Check requirements after every loop completion. Award IP on advancement. | Critical |
| Tier celebration modals | Prism animation, accomplishment summary, identity copy per §3.4 | High |
| Implement Mastery achievements (5) | Detection logic, IP awards, celebration copy per §4.1 | High |
| Implement Consistency achievements (5) | Detection logic, IP awards, celebration copy per §4.2 | High |
| Streak visualization on dashboard | Flame icon, day count, shield count, next milestone progress | High |
| Consistency score computation | Rolling 30-day from READINGDAY records, cached in STREAK record | Medium |
| Endowed progress | Onboarding loop counts toward Analyst tier. Show progress bar after first loop. | Medium |
| Streak notification copy | Implement all notification templates from §2.5 | Medium |

### P2: Elevation (Weeks 8–14)

**Goal:** Full achievement taxonomy, variable rewards, personalization, referral redesign.

| Task | Details | Priority |
|------|---------|----------|
| Implement Exploration achievements (5) | Category-breadth tracking, detection logic per §4.3 | Critical |
| Implement Hidden achievements (7) | Time-based detection, loop-count detection, inactivity detection per §4.4 | Critical |
| Implement Insight Spark | 12% server-side roll per loop, 15–45 IP range, shimmer + toast UI per §7.1 | High |
| Implement personalization themes (4) | Obsidian, Twilight, Ember, Aurora — purchase with IP, apply to reading UI | High |
| Implement tier-gated profile frames (4) | Analyst, Synthesizer, Polymath, Luminary — purchase with IP after tier reached | High |
| Create INVENTORY DynamoDB record | Schema per §10.1. Track owned and equipped items. | High |
| Implement "Gift a Friend 1 Week Pro" | 800 IP repeatable sink. Generate gift link, apply Pro to recipient. | High |
| Redesign referral system | Prosocial framing, new activation threshold (first loop), new reward structure per §6 | High |
| Implement referral contextual triggers | Satisfaction-peak prompts with priority system per §6.5 | Medium |
| Implement tenure-aware presentation | Three phases (scaffolding/forming/intrinsic) with gradual CSS transitions per §8.3 | Medium |
| Achievement UI | Four-track display with progress bars, earned state, celebration queue | Medium |

### P3: Maturation (Weeks 14–20)

**Goal:** Seasonal items, referral escalation, fraud prevention, economy monitoring, admin tooling.

| Task | Details | Priority |
|------|---------|----------|
| Implement seasonal rotating items | First set of 2 items. Quarterly rotation schedule. Availability windows. | High |
| Implement referral escalation tiers | Milestone bonuses at 3/5/10/25 with exclusive rewards per §6.3 | High |
| Implement referral fraud prevention | Device fingerprinting, IP matching, disposable email blocking, velocity monitoring per §6.6 | High |
| Implement referral annual cap | Rolling 12-month window, cap at 25 activations per §6.3 | High |
| Build economy health dashboard | Weekly metrics computation, threshold alerts per §9.3 | High |
| Build admin adjustment endpoint | `POST /admin/flow-points/adjust` per §9.4 | Medium |
| Design soft-decay | Specify and code the logic per §9.5 but deploy behind a feature flag (off by default) | Medium |
| Implement monitoring alerts | Automated alerts for economy health threshold breaches | Medium |
| Backfill tier and loop records | One-time migration: compute TIER and LOOP records from existing BOOK_PROGRESS and QUIZ_STATE data | Medium |
| A/B test readiness | Instrument IP values as configurable parameters for future tuning | Low |

---

## 12. What to Preserve, What to Remove, What to Modify

### Preserve (with reasoning)

| Element | Reasoning |
|---------|-----------|
| Atomic DynamoDB TransactWriteCommand for all earning/spending | Production-grade integrity; no reason to change |
| Idempotent grant records (`POINTSGRANT#sourceType#sourceId`) | Prevents double-awards; proven reliable |
| Complete audit ledger (`FLOWPOINTS#timestamp#txId`) | Essential for economy monitoring and debugging |
| Quiz-score-gated earning (70%/80%/90% thresholds) | Core to "reward comprehension" philosophy |
| Mode-based IP scaling (guided < standard < challenge) | Correct incentive gradient; values preserved exactly |
| Perfect-score bonuses (+30/+50/+80) | Rewards exceptional comprehension; values unchanged |
| First-attempt vs. retry distinction | Correct incentive to prepare before attempting |
| Book completion award (120 IP) | Meaningful milestone reward |
| Three free-to-Pro bridge redemptions (900/2,400/6,500 IP, `freeOnly`) | Core monetization bridge; preserved exactly |
| Quiz rate limiting (5/hour, escalating cooldowns) | Anti-abuse; working correctly |
| Device fingerprinting and network velocity detection | Anti-abuse for free access; extend to referrals |
| Fire-and-forget analytics on all transactions | Non-blocking observability; proven pattern |
| `useFlowPoints` React hook pattern | Clean client-side state management; rename to `useInsightPoints` |
| Framer Motion celebration system | Premium animation framework; extend for new celebrations |
| DynamoDB single-table design (PK/SK patterns) | Consistent, proven architecture |
| Scenario approved earning (60 IP) | Rewards quality user contributions |

### Remove (with reasoning)

| Element | Reasoning |
|---------|-----------|
| `FLOW_POINTS_AMOUNTS.quizPass` (15) | Stale — superseded by `CHAPTER_FP` mode-dependent values. Only used in misleading "Ways to Earn" display. |
| `FLOW_POINTS_AMOUNTS.dailyGoalComplete` (25) | Unused constant. Replaced by streak day bonus (15 IP). |
| `FLOW_POINTS_AMOUNTS.weeklyGoalComplete` (50) | Unused constant. No weekly goal mechanic needed. |
| `CHAPTER_FP.quizSpeedBonus` | Unused. No speed bonus mechanic designed — Challenge mode's 10-minute timer is sufficient difficulty. |
| `CHAPTER_FP.quizScoreImproved` | Unused. Score improvement is rewarded through the retry earning structure. |
| `CHAPTER_FP.scenarioSubmitted` | Unused. Points are awarded on approval (`scenario_approved`), not submission. |
| `CHAPTER_FP.streakBonus` | Unused. Replaced by the proper streak system (15 IP/day). |
| `CHAPTER_FP.reviewSessionComplete` | Unused. No review session feature exists. |
| `CHAPTER_FP.reviewAllCorrect` | Unused. No review session feature exists. |
| `mockBadges.ts` (file) | Replaced by consolidated achievement definitions in a single file. |
| `badge-data.ts` (file) | Merged into consolidated achievement definitions. |
| 10-level badge-FP accumulation system | Replaced by 5-tier mastery-based progression. Level names like "Oracle" and "Grandmaster" do not fit premium identity. |
| Zap icon (⚡) for currency | Replaced by diamond/prism icon (◇). Zap is generic; prism is intellectually aligned. |
| "Flow Points" name | Replaced by "Insight Points." "Flow" is neutral; "Insight" reinforces the learning identity. |
| localStorage-only streak tracking | Replaced by server-side DynamoDB STREAK record. Client-observable streaks are exploitable. |
| Referral invitee IP award (80 IP) | Replaced by 1 free week of Pro (higher perceived value, prosocial). |
| Referral inviter IP award (180 IP) | Replaced by matching Pro week (free inviter) or 200 IP (Pro inviter). |
| Referral Pro conversion inviter award (600 IP) | Removed entirely. Uncapped per-occurrence, highest single award in system, sender-benefit framing. Value redistributed into escalation tier bonuses (§6.3). |

### Modify (with reasoning)

| Element | Current | New | Reasoning |
|---------|---------|-----|-----------|
| IP earning trigger | 100% on quiz pass | ~60% on quiz pass, ~40% on Unlock step complete | Incentivizes full 4-step learning loop; preserves immediate gratification on quiz pass |
| Onboarding celebration value | Hardcoded "25" | Dynamic from `FLOW_POINTS_AMOUNTS.onboardingComplete` (120) | Fixes incorrect display |
| "Ways to Earn" quiz display | "15 FP" | "80–230 IP" with mode breakdown | Fixes misleading understatement |
| Referral activation threshold | Onboarding + book start | First full learning loop completion | Ensures invitee has experienced core product value |
| Referral inviter reward | 180 IP flat | 1 week Pro (free) or 200 IP (Pro) + escalation | Prosocial framing, matching value |
| `getBadgeFlowPoints()` | Reads from `mockBadges.ts` `.flowPoints` | Reads from consolidated file `.ipValue` | Eliminates dual-file divergence risk |
| `getLevel()` in badge-utils.ts | 10-level system based on badge FP sum | 5-tier system based on loops + score + categories | Measures mastery, not accumulation |
| Badge earned IP award | 10–80 IP per badge | 15–500 IP per achievement (4-track taxonomy) | Broader range reflects achievement significance |
| `useFlowPoints` hook | Named for "Flow Points" | Rename to `useInsightPoints`, same pattern | Naming consistency |
| Streak tracking | localStorage via `reading-streaks.ts` | DynamoDB STREAK record with server-side validation | Tamper-proof, cross-device consistent |
| `FLOW_POINTS_AMOUNTS.referralActivationInviter` | 180 | Remove — replaced by Pro week or 200 IP logic | Structural change to referral rewards |
| `FLOW_POINTS_AMOUNTS.referralActivationInvitee` | 80 | Remove — invitee gets Pro week, not IP | Structural change |
| `FLOW_POINTS_AMOUNTS.referralProInviter` | 600 | Remove entirely — value redistributed to escalation tiers | Uncapped faucet, sender-benefit framing |
| Tier advancement IP | 200/500/1,000/2,000 (total 3,700) | 200/400/600/800 (total 2,000) | Top-tier awards too large for users who've exhausted sinks |
| Gift a Friend price | N/A (new) | 800 IP (reduced from initial 1,200 IP spec) | 1,200 was too expensive to drive regular spending velocity |

---

*End of specification.*
