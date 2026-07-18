# Service Level Objectives

Reliability targets for the ChapterFlow web app, the error budgets they imply,
and the burn-rate alerts that page on them. For how alarms are wired and where
they land, see [OPERATIONS.md §4](./OPERATIONS.md); for the system layout, see
[ARCHITECTURE.md](./ARCHITECTURE.md).

Method: SLIs/SLOs follow the Google SRE Workbook (Ch. 4 "Implementing SLOs",
Ch. 5 "Alerting on SLOs") — event-ratio SLIs, an explicit error budget, and
multi-window multi-burn-rate alerts rather than a static error-rate threshold.

## 1) Operating context sets the target

ChapterFlow is a solo-operated, revenue-bearing app with **no on-call
rotation** — one person, alerted by email, who is not awake for every page. The
target has to survive that reality:

- **Tighter than 99.9%** (e.g. 99.95% = 21.6 min/month, 99.99% = 4.32 min/month)
  is *unactionable*: a single ~40-minute incident that the operator sleeps
  through already blows a 99.95% month, so the target would be permanently
  violated and the alerts would be noise. You cannot hold a number your response
  model can't defend.
- **Looser than 99.9%** (99.5% = 216 min/month, 99% = 432 min/month) *leaks
  revenue*: a paying reader who hits errors for 3.6 hours a month churns, and the
  budget is loose enough that a real, ongoing problem never trips a page.

**99.9% monthly is the actionable floor**: a 43.2 min/month budget is small
enough that a genuine outage pages while there is still budget to protect, and
large enough that one recoverable blip doesn't mark the month as failed. It is
the tightest target a single human on email alerting can actually defend.

> SLO ≠ SLA. These are internal engineering targets with no customer-facing
> contractual teeth. If an SLA is ever written it must be *looser* than the SLO
> here, so we notice and fix before a customer is owed anything.

## 2) SLIs, SLOs, and error budgets per surface

Three surfaces, one paging SLI. Availability is measured as an event ratio
(good ÷ total); latency as a target on a percentile.

### 2a) Edge availability — the paging SLI

| Field | Value |
|---|---|
| **SLI** | `1 − CloudFront 5xxErrorRate` — the fraction of edge responses that are not 5xx, over the window. Numerator: non-5xx viewer responses; denominator: all viewer responses. |
| **SLO** | **99.9%** over a rolling 30-day window. |
| **Error budget** | 0.1% × 30 × 24 × 60 = **43.2 minutes / month** of 5xx-equivalent time. |
| **Source metric** | `AWS/CloudFront 5xxErrorRate` (Average, percent) on the distribution. |
| **Paging** | Yes — multi-window burn-rate (§3). |

**Why edge is the SLI users are paged on, not the server:** CloudFront sees
*what the reader sees*. It counts failures on cached and CDN-served paths, static
assets, and image responses that never reach the server Lambda, and it counts
the origin's own 5xx. A server-availability SLI is blind to everything CloudFront
serves without an origin hit; the edge ratio is the closest signal to
"did the reader get a working page." The server SLI below is the *diagnostic* —
when the edge SLI burns, the server error rate tells you whether the origin is
the cause.

### 2b) Server availability — tracked, diagnostic (not separately paged)

| Field | Value |
|---|---|
| **SLI** | `1 − (ServerFn Errors ÷ ServerFn Invocations)` — the fraction of OpenNext server-Lambda invocations that did not error. |
| **SLO** | **99.9%** over a rolling 30-day window (same budget shape as edge). |
| **Source metrics** | `AWS/Lambda Errors` and `Invocations` on `ChapterFlowServer[-env]`. |
| **Tracked on** | the `ChapterFlowGoldenSignals[-env]` dashboard (errors, throttles, duration widgets). |
| **Paging** | No burn-rate page of its own — it is the cause-analysis SLI behind an edge-availability page, and it already has the static `ServerFnErrorsAlarm` (≥5 errors / 5 min) as a floor. Paging it *and* the edge SLI would double-page the same incident. |

### 2c) Latency — tracked, target set, NOT burn-rate-paged yet

| Field | Value |
|---|---|
| **SLI** | ServerFn request latency — `count(requests < 2s) ÷ total requests`, i.e. the fraction of server responses faster than 2s. |
| **SLO (target)** | **p99 < 2s** steady-state. |
| **Source metric** | `AWS/Lambda Duration` p50/p95/p99 on `ChapterFlowServer[-env]`. |
| **Tracked on** | the `ChapterFlowGoldenSignals[-env]` dashboard (duration widget) + the static `ServerFnDurationAlarm` (p99 ≥20s, the pre-timeout floor). |
| **Paging** | **Not burn-rate-paged.** See below. |

> **Stated follow-up — latency burn-rate paging is deferred.** A proper latency
> error budget is a ratio of *fast requests ÷ total requests* per window, which
> needs a request-level "was this request under 2s" count the stack does not
> emit today (`Lambda Duration` is a percentile summary, not a per-request
> good/bad count you can integrate into a burn rate). Adding it means either a
> CloudWatch metric-math approximation from the Duration percentiles or an
> EMF/embedded-metric latency-bucket count from the server. Until that SLI
> exists, latency is watched on the dashboard against the p99 < 2s target with
> the static 20s pre-timeout alarm as the only page. Burn-rate latency alerting
> is the follow-up.

## 3) Burn-rate alerting (edge availability)

*Burn rate* is how many times faster than sustainable the budget is being spent.
A burn rate of 1 exhausts the whole 30-day budget in exactly 30 days; a burn
rate of 14.4 exhausts it in ~50 hours.

```
burn_rate = (5xxErrorRate% / 100) / (1 − 0.999)
          = badEventFraction / errorBudgetFraction
```

### Multi-window multi-burn-rate table

| Alert | Burn multiple | Long window | Short window | Budget spent when it fires | 5xx rate at threshold | Time to exhaust budget | Severity |
|---|---|---|---|---|---|---|---|
| **Fast burn** | 14.4× | 1h | 5m | 2% in 1h | ≥ 1.44% | ~50 h | page |
| **Slow burn** | 6× | 6h | 30m | 5% in 6h | ≥ 0.60% | ~5 days | page |
| Ticket (future) | 1× | 3d | 6h | 10% in 3d | ≥ 0.10% | 30 days | ticket |

Every number is derived from the 99.9% objective:

- **5xx rate at threshold** = `burn_multiple × (1 − 0.999) × 100`.
  Fast: `14.4 × 0.001 × 100 = 1.44%`. Slow: `6 × 0.001 × 100 = 0.60%`.
- **Time to exhaust** = `30 days ÷ burn_multiple`. Fast: `720h / 14.4 = 50h`.
  Slow: `720h / 6 = 120h = 5 days`.
- **Budget spent when it fires** = `burn_multiple × long_window ÷ 720h`.
  Fast: `14.4 × 1h / 720h = 2%`. Slow: `6 × 6h / 720h = 5%`.

The 14.4× / 6× multiples and the (1h, 5m) / (6h, 30m) window pairs are the
Google SRE Workbook Ch. 5 recommended defaults for a 30-day 99.9% SLO.

### Why two windows, joined with AND

Each alert requires **both** its long window AND its short window to be over
threshold at once (a CloudWatch `CompositeAlarm` with an `AllOf` rule):

- The **long window** (1h / 6h) filters noise — a 30-second spike never fills it,
  so it doesn't page on a blip. This is what the static 1% CloudFront alarm gets
  wrong: it pages on any sustained 1%, calibrated to nothing.
- The **short window** (5m / 30m) speeds detection *and* — the AND is the point —
  **stops stale paging after recovery.** Once the incident clears, the short
  window falls below threshold within one period and the composite leaves ALARM,
  instead of the long window holding ALARM for its full hour/six-hours after the
  problem is already gone.

All four member alarms use `treatMissingData = NOT_BREACHING`: no edge traffic
(or no 5xx) is not a burn.

### Alarm mapping (for the runbook)

Constructs in `infra/lib/chapterflow-frontend-stack.ts` (WS6-030). `[-env]` is
the resource suffix (`""` prod, `-dev` / `-staging`).

| Construct | Alarm name | Role |
|---|---|---|
| `SloFastBurn1hAlarm` | `ChapterFlowSloFastBurn1h[-env]` | fast-burn long window, no action |
| `SloFastBurn5mAlarm` | `ChapterFlowSloFastBurn5m[-env]` | fast-burn short window, no action |
| `SloFastBurnAlarm` (composite) | `ChapterFlowSloFastBurn[-env]` | **AllOf(1h, 5m) → pages** |
| `SloSlowBurn6hAlarm` | `ChapterFlowSloSlowBurn6h[-env]` | slow-burn long window, no action |
| `SloSlowBurn30mAlarm` | `ChapterFlowSloSlowBurn30m[-env]` | slow-burn short window, no action |
| `SloSlowBurnAlarm` (composite) | `ChapterFlowSloSlowBurn[-env]` | **AllOf(6h, 30m) → pages** |

Only the two composites carry an action; today they page the shared
`ChapterFlowOpsAlerts[-env]` SNS topic (same inbox as every other alarm). A
later severity-routing step re-routes them to a page-grade channel distinct
from the ticket-grade alarms. The four member alarms have no action of their
own — they exist only to feed the composites.

## 4) Error budget policy

Burning budget has to *do* something, or the SLO is theater. Budget is the
30-day rolling remainder of 43.2 minutes.

| State | Budget remaining | What the operator does |
|---|---|---|
| **Healthy** | > 50% | Normal operation. Ship features, run migrations. |
| **Caution** | 25–50% | De-risk changes. No speculative deploys late in the day; keep a rollback ready. |
| **Critical** | < 25% | **Freeze feature deploys.** Only reliability fixes and SLO-improving changes ship; each with an explicit rollback plan. Prioritize the reliability work that caused the burn. |
| **Violated** | 0% (budget exhausted) | Stop the bleeding first (rollback to last known-good per [OPERATIONS.md §5](./OPERATIONS.md), or CloudFront/kill-switch). Then a written postmortem within 48h and at least one follow-up fix within 14 days. |

"Freeze feature deploys" is literal: no deploy to prod except a fix for the
thing burning budget. For a solo operator the freeze is a note-to-self with
teeth — the point is to spend the remaining budget on *finding the cause*, not
on shipping more change on top of an already-degraded month.

A fast-burn page (§3) is an *immediate* action regardless of the monthly state:
investigate now, because 50 hours at that rate ends the month's budget.

## 5) Review cadence

- **Quarterly SLO review.** For each SLO: was it never burned (too loose —
  tighten) or frequently burned (too tight, or the system needs work)? Did the
  burn-rate pages fire usefully — real incidents, not noise? Adjust targets and
  thresholds, and land the deferred latency SLI (§2c) when the request-level
  signal exists.
- **After every budget-Violated month.** Re-ask whether 99.9% is still the right
  target for the current traffic and response model before the next quarter.
- **On any alarm-mapping change.** Editing the SLO constants in
  `chapterflow-frontend-stack.ts` (`SLO_EDGE_AVAILABILITY_TARGET`,
  `SLO_FAST_BURN_MULTIPLE`, `SLO_SLOW_BURN_MULTIPLE`) must update §2–§3 here in
  the same change — the code comments point back to this file for exactly that
  reason.

## 6) Links

- [OPERATIONS.md §4](./OPERATIONS.md) — how alarms are wired, the ops SNS topic,
  and the golden-signals dashboard.
- `ChapterFlowGoldenSignals[-env]` — the CloudWatch dashboard tracking server
  availability and latency (WS6-033), out-of-band from the in-app admin view.
- Google SRE Workbook, Ch. 4 (Implementing SLOs) & Ch. 5 (Alerting on SLOs) —
  the burn-rate methodology these thresholds come from.
