import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

const config: OpenNextConfig = {
  // NOTE (H9): every route is served by this single `default` server function,
  // deployed with a 30s timeout (ServerFn in
  // infra/lib/chapterflow-frontend-stack.ts). OpenNext does NOT honour Next's
  // per-route `maxDuration` export, and there is no per-route function split
  // here, so a long-running handler cannot buy itself more time. Heavy fan-out
  // work (e.g. admin segment bulk-notify) must be moved off the request onto an
  // async worker rather than relying on a higher timeout. Splitting a route into
  // its own function here would ALSO need new infra to deploy and route to it, so
  // it is not a config-only change.
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
