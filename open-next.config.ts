import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

const config: OpenNextConfig = {
  // NOTE (H9 / M13): every route is served by this single `default` server
  // function, deployed with a 45s timeout (ServerFn in
  // infra/lib/chapterflow-frontend-stack.ts). OpenNext does NOT honour Next's
  // per-route `maxDuration` export, and there is no per-route function split
  // here, so a long-running handler cannot buy itself more time. Heavy fan-out
  // work (e.g. admin segment bulk-notify, billing reconciliation in
  // app/app/api/book/admin/reconciliation/route.ts) must either stay bounded so
  // it finishes inside 45s — surfacing partial results clearly — or move off the
  // request onto an async worker; it must NOT rely on a `maxDuration` export.
  // Splitting a route into its own function here would ALSO need new infra to
  // deploy and route to it, so it is not a config-only change.
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
    },
  },
  imageOptimization: {
    loader: "s3",
  },
  buildCommand: "npm run build",
};

export default config;
