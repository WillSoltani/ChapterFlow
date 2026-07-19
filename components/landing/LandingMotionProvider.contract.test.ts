import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

function source(relativePath: string): string {
  try {
    return readFileSync(path.join(process.cwd(), relativePath), "utf8");
  } catch {
    return "";
  }
}

test("MotionProvider is scoped to /book instead of the root layout", () => {
  const rootLayout = source("app/layout.tsx");
  const bookLayout = source("app/book/layout.tsx");

  assert.doesNotMatch(rootLayout, /import \{ MotionProvider \}/);
  assert.doesNotMatch(rootLayout, /<MotionProvider>/);
  assert.match(bookLayout, /import \{ MotionProvider \}/);
  assert.match(
    bookLayout,
    /<MotionProvider featureMode="compatible">[\s\S]*<BookProviders>/,
  );
  assert.match(bookLayout, /<\/BookProviders>[\s\S]*<\/MotionProvider>/);
});

test("the landing mounts one strict domAnimation feature provider", () => {
  const page = source("app/page.tsx");
  const provider = source("components/landing/LandingMotionProvider.tsx");
  const motionProvider = source("components/MotionProvider.tsx");

  assert.match(page, /import \{ LandingMotionProvider \}/);
  assert.equal((page.match(/<LandingMotionProvider>/g) ?? []).length, 1);
  assert.equal((page.match(/<\/LandingMotionProvider>/g) ?? []).length, 1);
  assert.match(provider, /<MotionProvider featureMode="strict">/);
  assert.match(motionProvider, /import \{ LazyMotion, MotionConfig \}/);
  assert.match(
    motionProvider,
    /import\("framer-motion"\)\.then\(\(\{ domAnimation \}\) => domAnimation\)/,
  );
  assert.match(
    motionProvider,
    /<LazyMotion features=\{loadMotionFeatures\} strict>/,
  );
});

test("the /book m facade has a compatible scoped feature provider", () => {
  const rootLayout = source("app/layout.tsx");
  const bookLayout = source("app/book/layout.tsx");
  const motionProvider = source("components/MotionProvider.tsx");

  assert.doesNotMatch(rootLayout, /featureMode=/);
  assert.match(bookLayout, /<MotionProvider featureMode="compatible">/);
  assert.match(
    motionProvider,
    /<LazyMotion features=\{loadMotionFeatures\}>\{children\}<\/LazyMotion>/,
  );
});

test("every measured landing-reachable motion element uses the lazy m facade", () => {
  const measuredFiles = [
    "components/landing/recall/RecallAmbient.tsx",
    "components/landing/recall/RecallReaderShowcase.tsx",
    "components/landing/reader-demo/AppWindowChrome.tsx",
    "components/landing/reader-demo/DesktopReaderShell.tsx",
    "components/reader/PhaseStepper.tsx",
    "components/reader/SummaryCard.tsx",
  ];

  for (const relativePath of measuredFiles) {
    const contents = source(relativePath);
    assert.doesNotMatch(
      contents,
      /import \{[^}]*\bmotion\b[^}]*\} from "framer-motion"/,
      relativePath,
    );
    assert.doesNotMatch(contents, /<\/?motion\./, relativePath);
    assert.match(
      contents,
      /import \{[^}]*\bm\b[^}]*\} from "framer-motion"/,
      relativePath,
    );
  }
});

test("JetBrains and Newsreader remain defined without eager root preloads", () => {
  const rootLayout = source("app/layout.tsx");
  const jetBrainsBlock =
    rootLayout.match(/const jetbrainsMono = JetBrains_Mono\(\{[\s\S]*?\n\}\);/)?.[0] ??
    "";
  const newsreaderBlock =
    rootLayout.match(/const newsreader = Newsreader\(\{[\s\S]*?\n\}\);/)?.[0] ?? "";

  assert.match(jetBrainsBlock, /preload: false/);
  assert.match(newsreaderBlock, /preload: false/);
  assert.match(rootLayout, /jetbrainsMono\.variable/);
  assert.match(rootLayout, /newsreader\.variable/);
});

test("both scoped providers retain OS and in-app reduced-motion authority", () => {
  const motionProvider = source("components/MotionProvider.tsx");
  const landingProvider = source("components/landing/LandingMotionProvider.tsx");

  assert.match(motionProvider, /root\.dataset\.motion === "reduced"/);
  assert.match(motionProvider, /<MotionConfig reducedMotion=\{reducedMotion\}>/);
  assert.match(motionProvider, /useState<"user" \| "always">\("user"\)/);
  assert.match(landingProvider, /<MotionProvider featureMode="strict">/);
});
