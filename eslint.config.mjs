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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts (not source).
    "cdk.out/**",
    "infra/cdk.out/**",
    "infra/dist/**",
  ]),
]);

export default eslintConfig;
