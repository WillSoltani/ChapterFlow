import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/book/**/*.{ts,tsx}"],
    rules: {
      // Book app uses client-side hydration patterns for localStorage-backed state.
      "react-hooks/set-state-in-effect": "off",
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
