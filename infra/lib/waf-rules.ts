import type * as wafv2 from "aws-cdk-lib/aws-wafv2";

// ---------------------------------------------------------------------------
// WAFv2 rule definitions (pure data — no CDK construct instantiation)
// ---------------------------------------------------------------------------
// Extracted from chapterflow-frontend-stack.ts so the rule shape can be
// unit-tested without standing up an App/Stack (CDK constructs require a
// synth context). The WebACL is attached to the CloudFront distribution and
// therefore inspects EVERY request, including the SSR app's own JSON API
// (/app/api/*), which is served by the CloudFront default behavior.
//
// Why ruleActionOverrides are required (do NOT remove):
//
// AWSManagedRulesCommonRuleSet ships several Block-mode sub-rules that
// false-positive on legitimate ChapterFlow API traffic:
//
//   • CrossSiteScripting_BODY / _QUERYARGUMENTS / _COOKIE — fire on any JSON
//     value that merely CONTAINS XSS-lookalike substrings ("<", "javascript:",
//     'on...=' handler text). ChapterFlow accepts free-text the user controls
//     (display names, book-request notes, search queries, settings) and stores
//     it as data — the API is a JSON sink, never an HTML sink, and every value
//     is validated/escaped server-side. With these rules in Block mode a user
//     named "Tom <the Reader>" or a search for "a < b" gets a hard 403 from the
//     edge before the request ever reaches the Lambda.
//
//   • SizeRestrictions_BODY — blocks bodies over the managed default (8 KB at
//     the time of writing). ChapterFlow POSTs (book ingestion payloads, bulk
//     settings, quiz submissions) can legitimately exceed that.
//
// We override ONLY these high-false-positive sub-rules to Count so they still
// emit CloudWatch metrics / sampled requests (observability is retained) but no
// longer block. Every other CommonRuleSet protection — path traversal, LFI,
// the EC2 IMDS SSRF guard, no-user-agent, restricted extensions, etc. — stays
// in its default Block mode, and the per-IP rate-limit rule below is untouched.
//
// ⚠️ AWS WAF SILENTLY IGNORES an override whose `name` does not case-sensitively
// match a real sub-rule of the managed group. These strings are the canonical
// AWSManagedRulesCommonRuleSet rule names — verify against the AWS docs before
// editing, and keep the regression test (waf-rules.test.ts) in sync.

/**
 * Sub-rules of AWSManagedRulesCommonRuleSet that we run in Count (not Block)
 * mode because they hard-403 legitimate JSON API traffic. Exported so the
 * regression test can assert the set never silently shrinks.
 */
export const COMMON_RULE_SET_COUNT_OVERRIDES: readonly string[] = [
  // XSS-lookalike free-text in request bodies / query args / cookies.
  "CrossSiteScripting_BODY",
  "CrossSiteScripting_QUERYARGUMENTS",
  "CrossSiteScripting_COOKIE",
  // Legitimate large JSON POST bodies (ingestion, bulk settings, quiz submit).
  "SizeRestrictions_BODY",
];

/**
 * Build the ruleActionOverrides array for the AWS managed common rule set.
 * Each named sub-rule is forced to `count` so it observes but does not block.
 */
export function buildCommonRuleSetActionOverrides(): wafv2.CfnWebACL.RuleActionOverrideProperty[] {
  return COMMON_RULE_SET_COUNT_OVERRIDES.map((name) => ({
    name,
    actionToUse: { count: {} },
  }));
}

/**
 * URI prefix of the landing's film-reel frames. Must stay identical to the
 * `films/*` CloudFront behavior in chapterflow-frontend-stack.ts, so the
 * rate-limit carve-out below can only ever reach the static S3 origin.
 */
export const FILM_FRAMES_PATH_PREFIX = "/films/";

/** Per-IP requests per rolling 5 minutes allowed under FILM_FRAMES_PATH_PREFIX. */
export const FILM_FRAMES_RATE_LIMIT = 20000;

/** "URI path starts with /films/" — raw match, no transformation. */
function filmFramesPathStatement(): wafv2.CfnWebACL.StatementProperty {
  return {
    byteMatchStatement: {
      searchString: FILM_FRAMES_PATH_PREFIX,
      fieldToMatch: { uriPath: {} },
      positionalConstraint: "STARTS_WITH",
      textTransformations: [{ priority: 0, type: "NONE" }],
    },
  };
}

/**
 * Build the full ordered WebACL rule list for the CloudFront distribution.
 *
 * @param webAclMetricName CloudWatch metric name for the ACL (caller-namespaced).
 */
export function buildWebAclRules(): wafv2.CfnWebACL.RuleProperty[] {
  return [
    {
      name: "AWSManagedCommonRuleSet",
      priority: 1,
      // overrideAction stays `none` so the group's own per-rule actions apply,
      // except for the sub-rules we explicitly downgrade to Count below.
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: "AWS",
          name: "AWSManagedRulesCommonRuleSet",
          ruleActionOverrides: buildCommonRuleSetActionOverrides(),
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "AWSManagedCommonRuleSet",
        sampledRequestsEnabled: true,
      },
    },
    {
      // Per-IP rate limit: block a source IP sending >2000 requests in any
      // rolling 5-minute window (baseline volumetric/bot mitigation).
      //
      // Film-reel frames are scoped OUT of this rule and counted by their own
      // rule below. The landing paints its scroll-scrubbed film from one
      // static image per frame (~1,700 per pass through the reel), all served
      // from the S3 static-assets origin. Counted here, one visitor scrolling
      // the landing spent the whole 2,000 allowance, and two visitors behind
      // one carrier/home NAT exceeded it: WAF then 403'd the PAGE and the API
      // for that IP, not just the frames (12,581 requests blocked in one hour
      // on 2026-11-09). WAF evaluates before the CloudFront cache, so edge
      // cache hits count too.
      name: "RateLimitPerIp",
      priority: 2,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: 2000,
          aggregateKeyType: "IP",
          scopeDownStatement: {
            notStatement: { statement: filmFramesPathStatement() },
          },
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "RateLimitPerIp",
        sampledRequestsEnabled: true,
      },
    },
    {
      // Film frames keep a volumetric ceiling of their own, sized for several
      // visitors behind one IP scrolling the reel at once. Exceeding it blocks
      // only further frame requests (the reel holds its nearest frame); the
      // page, the app and the API stay reachable.
      name: "RateLimitFilmsPerIp",
      priority: 3,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: FILM_FRAMES_RATE_LIMIT,
          aggregateKeyType: "IP",
          scopeDownStatement: filmFramesPathStatement(),
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "RateLimitFilmsPerIp",
        sampledRequestsEnabled: true,
      },
    },
  ];
}
