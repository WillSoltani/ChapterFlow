/**
 * Campaign-instrument check gate (WP-208, decision ledger L-16).
 *
 * Two verifiers in the closed migration/qualification campaign compare the
 * CURRENT checkout against a retained live baseline:
 *   1. the IMP-22/24/24F production-instrument seal whole-src drift check
 *      (forwardProductionInstrumentSeal.verifyRetainedForwardProductionInstrumentSeal);
 *   2. the IMP-24C pre-live-freeze exact-contract-count assertion
 *      (imp24PreLiveFreeze.contractEvidence, ===16 against the current manifest).
 *
 * Both belong to the closed campaign and are SUPERSEDED by the S-tier program;
 * FORMAL retirement lands in WP-202/203/204. Until then they must not break the
 * default suite when ordinary src edits or additive contracts land. So they run
 * only under this explicit opt-in. Default (flag absent): historical /
 * retained-integrity verification ONLY — never a current-checkout comparison.
 *
 * Setting CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS=1 restores today's strict
 * behaviour byte-for-byte, so nothing is lost before formal retirement.
 */
export const CAMPAIGN_INSTRUMENT_CHECKS_ENV = "CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS" as const;

/** Reason string surfaced by skipped campaign-instrument tests in the default suite. */
export const CAMPAIGN_INSTRUMENT_CHECKS_SKIP_REASON =
  "superseded by S-tier program (ledger L-16); formal retirement in WP-202/203/204" as const;

/** True only when the operator has explicitly opted into the closed campaign's
 * current-checkout comparisons. */
export function campaignInstrumentChecksEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[CAMPAIGN_INSTRUMENT_CHECKS_ENV] === "1";
}
