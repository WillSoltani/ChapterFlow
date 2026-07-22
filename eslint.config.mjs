import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "app/book/**/*.{ts,tsx}",
      // WS3-001 preserves the existing hydration exemption for the same live
      // book modules after promoting them below the route tree.
      "hooks/book/**/*.{ts,tsx}",
      "lib/client/book-api-cache.ts",
      "components/book/BookSaveButton.tsx",
      "components/brand/ChapterFlowMark.tsx",
      "components/navigation/**/*.{ts,tsx}",
      "components/reader/**/*.{ts,tsx}",
      "components/review/ReviewSessionFSRS.tsx",
      "components/ui/{ErrorBanner,SegmentedControl,Toast}.tsx",
      "components/workspace/PartnerProgressCard.tsx",
    ],
    rules: {
      // Book app uses client-side hydration patterns for localStorage-backed state.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // WS3-001: shared components live below the route tree. Route modules may
    // compose shared UI, but shared UI must never reach back into app/book.
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/book", "@/app/book/*", "@/app/book/**"],
              message:
                "components/ must not import from the app/book route tree — promote shared UI, hooks, data, or contracts below the route tree (WS3-001).",
            },
          ],
        },
      ],
    },
  },
  {
    // WS3-007: lib/ is the shared base layer — every other layer (app/,
    // components/) may depend on it, never the reverse. An import from lib/
    // reaching up into app/ or components/ is a boundary violation (it was
    // found twice: catalog data and the ReaderLevel type, both now defined
    // in lib/ itself with the old locations kept as re-export shims).
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app/**"],
              message:
                "lib/ is the base layer and must not import from app/ — move the shared code into lib/ instead (WS3-007).",
            },
            {
              group: ["@/components/*", "@/components/**"],
              message:
                "lib/ is the base layer and must not import from components/ — move the shared code into lib/ instead (WS3-007).",
            },
          ],
        },
      ],
    },
  },
  {
    // WS3-002: route handlers must not touch DynamoDB directly — the
    // command construction+send belongs in an entity `*-repo.ts` module
    // (app/app/api/book/_lib/*-repo.ts and friends), never inline in
    // route.ts. Only the DynamoDB document-client name is restricted from
    // _lib/aws — routes may still import its other exports (s3, sfn,
    // mustEnv, REGION) directly.
    files: ["app/**/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@aws-sdk/lib-dynamodb",
              message:
                "Route handlers must call a `*-repo` module instead of importing @aws-sdk/lib-dynamodb directly — WS3-002.",
            },
            {
              name: "@/app/app/api/_lib/aws",
              importNames: ["ddbDoc"],
              message:
                "Route handlers must call a `*-repo` module instead of importing `ddbDoc` directly — WS3-002.",
            },
          ],
        },
      ],
    },
  },
  {
    // WS6-015: promote a correctness-rule subset from eslint-config-next's
    // default "warn" to "error" so the lint-ratchet's severity-2 count (and
    // the zero-tolerance checker in scripts/ci/check-eslint-correctness.mjs)
    // actually catches these instead of silently passing as warnings.
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "react-hooks/exhaustive-deps": "error",
      // argsIgnorePattern/varsIgnorePattern/caughtErrorsIgnorePattern preserve
      // the codebase's existing underscore-prefix convention for intentionally
      // unused parameters (e.g. app/book/data/bookChapters.ts, ExamplesList.tsx).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-chapterflow/**",
    ".next-chapterflow-bookcheck/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts (not source).
    ".chapterflow/runs/**",
    "cdk.out/**",
    "infra/cdk.out/**",
    "infra/dist/**",
    // Out of scope for the web-app lint surface: the offline v21 authoring
    // pipeline and the CDK infra package live in their own contexts (separate
    // tsconfig / package). The app lint focuses on app/, components/, lib/.
    "scripts/**",
    "infra/**",
  ]),
]);

export default eslintConfig;
