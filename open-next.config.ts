import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

const config: OpenNextConfig = {
  // NOTE (H9 / M13): the `default` server function serves every route EXCEPT the
  // admin surface (`/app/api/book/admin/*`), which is split into its own `admin`
  // function below (WS6-005). Both deploy with a 45s timeout (ServerFn / AdminFn
  // in infra/lib/chapterflow-frontend-stack.ts). OpenNext does NOT honour Next's
  // per-route `maxDuration` export, so a long-running handler cannot buy itself
  // more time. Heavy fan-out work (e.g. admin segment bulk-notify, billing
  // reconciliation in app/app/api/book/admin/reconciliation/route.ts) must either
  // stay bounded so it finishes inside 45s — surfacing partial results clearly —
  // or move off the request onto an async worker; it must NOT rely on a
  // `maxDuration` export. The admin split exists so the admin Lambda's IAM role
  // can carry `dynamodb:Scan` (needed by the metrics/economy-health aggregates)
  // while the far-larger public `default` role drops Scan entirely — a route
  // split ALSO needs new infra to deploy and route to it (AdminFn + its Function
  // URL + a CloudFront `app/api/book/admin/*` behavior), so it is not a
  // config-only change.
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
    },
  },
  functions: {
    admin: {
      // CloudFront-compatible pattern for the double-nested admin API surface
      // (URL is /app/api/book/admin/* — the leading `app` is a real path segment
      // because this project's App Router app dir contains an `app/` folder).
      patterns: ["app/api/book/admin/*"],
      routes: [
        "app/app/api/book/admin/books/[bookId]/versions/[version]/publish/route",
        "app/app/api/book/admin/books/[bookId]/versions/route",
        "app/app/api/book/admin/books/upload-request/route",
        "app/app/api/book/admin/events-feed/route",
        "app/app/api/book/admin/events/[eventId]/route",
        "app/app/api/book/admin/events/route",
        "app/app/api/book/admin/events/seed/route",
        "app/app/api/book/admin/ingest/run/route",
        "app/app/api/book/admin/ingestions/[jobId]/route",
        "app/app/api/book/admin/insight-points/adjust/route",
        "app/app/api/book/admin/license-keys/[code]/route",
        "app/app/api/book/admin/license-keys/route",
        "app/app/api/book/admin/metrics/acquisition/route",
        "app/app/api/book/admin/metrics/billing/route",
        "app/app/api/book/admin/metrics/content/route",
        "app/app/api/book/admin/metrics/devices/route",
        "app/app/api/book/admin/metrics/economy/route",
        "app/app/api/book/admin/metrics/engagement/route",
        "app/app/api/book/admin/metrics/funnels/route",
        "app/app/api/book/admin/metrics/geography/route",
        "app/app/api/book/admin/metrics/growth/route",
        "app/app/api/book/admin/metrics/moderation/route",
        "app/app/api/book/admin/metrics/notifications/route",
        "app/app/api/book/admin/metrics/ops/route",
        "app/app/api/book/admin/metrics/overview/route",
        "app/app/api/book/admin/metrics/performance/route",
        "app/app/api/book/admin/metrics/retention/route",
        "app/app/api/book/admin/metrics/revenue/route",
        "app/app/api/book/admin/ops-failures/route",
        "app/app/api/book/admin/reconciliation/route",
        "app/app/api/book/admin/scenario-submissions/[submissionId]/route",
        "app/app/api/book/admin/scenario-submissions/pending/route",
        "app/app/api/book/admin/segments/[segmentId]/notify/route",
        "app/app/api/book/admin/segments/[segmentId]/route",
        "app/app/api/book/admin/segments/preview/route",
        "app/app/api/book/admin/segments/route",
        "app/app/api/book/admin/users/[userId]/account-status/route",
        "app/app/api/book/admin/users/[userId]/entitlements/route",
        "app/app/api/book/admin/users/[userId]/erase/route",
        "app/app/api/book/admin/users/[userId]/route",
        "app/app/api/book/admin/users/search/route",
      ],
      override: {
        wrapper: "aws-lambda-streaming",
        converter: "aws-apigw-v2",
      },
    },
  },
  imageOptimization: {
    loader: "s3",
  },
  buildCommand: "npm run build",
};

export default config;
