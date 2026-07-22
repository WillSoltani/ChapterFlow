import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const projectRoot = process.cwd();
const projectExtensions = [".ts", ".tsx", ".js", ".jsx"];

function source(relativePath: string): string {
  try {
    return readFileSync(path.join(projectRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

function resolveProjectImport(fromFile: string, specifier: string): string | undefined {
  let basePath: string;
  if (specifier.startsWith("@/")) {
    basePath = path.join(projectRoot, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    basePath = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return undefined;
  }

  const candidates = [
    basePath,
    ...projectExtensions.map((extension) => `${basePath}${extension}`),
    ...projectExtensions.map((extension) => path.join(basePath, `index${extension}`)),
  ];
  return candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
}

function landingReachableSources(): Set<string> {
  const entry = path.join(projectRoot, "app/page.tsx");
  const pending = [entry];
  const reachable = new Set<string>();

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || reachable.has(file)) continue;
    reachable.add(file);

    const contents = readFileSync(file, "utf8");
    const scriptKind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
      file,
      contents,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const visit = (node: ts.Node) => {
      let specifier: string | undefined;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        specifier = node.moduleSpecifier.text;
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        specifier = node.arguments[0].text;
      }

      if (specifier) {
        const resolved = resolveProjectImport(file, specifier);
        if (resolved && !reachable.has(resolved)) pending.push(resolved);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return reachable;
}

test("root keeps reduced-motion policy without loading LazyMotion features", () => {
  const rootLayout = source("app/layout.tsx");
  const motionProvider = source("components/MotionProvider.tsx");

  assert.match(rootLayout, /import \{ MotionProvider \}/);
  assert.match(rootLayout, /<MotionProvider>\{children\}<\/MotionProvider>/);
  assert.doesNotMatch(rootLayout, /MotionFeatureProvider/);
  assert.doesNotMatch(motionProvider, /LazyMotion|domAnimation|featureMode/);
  assert.match(motionProvider, /root\.dataset\.motion === "reduced"/);
  assert.match(motionProvider, /<MotionConfig reducedMotion=\{reducedMotion\}>/);
  assert.match(motionProvider, /useState<"user" \| "always">\("user"\)/);
});

test("landing and /book mount scoped async domAnimation features", () => {
  const page = source("app/page.tsx");
  const bookLayout = source("app/book/layout.tsx");
  const landingProvider = source("components/landing/LandingMotionProvider.tsx");
  const featureProvider = source("components/MotionFeatureProvider.tsx");

  assert.match(page, /import \{ LandingMotionProvider \}/);
  assert.equal((page.match(/<LandingMotionProvider>/g) ?? []).length, 1);
  assert.equal((page.match(/<\/LandingMotionProvider>/g) ?? []).length, 1);
  assert.match(landingProvider, /<MotionFeatureProvider strict>/);
  assert.match(bookLayout, /import \{ MotionFeatureProvider \}/);
  assert.match(bookLayout, /<MotionFeatureProvider>[\s\S]*<BookProviders>/);
  assert.match(bookLayout, /<\/BookProviders>[\s\S]*<\/MotionFeatureProvider>/);
  assert.match(
    featureProvider,
    /import\("framer-motion"\)\.then\(\(\{ domAnimation \}\) => domAnimation\)/,
  );
  assert.match(
    featureProvider,
    /<LazyMotion features=\{loadMotionFeatures\} strict=\{strict\}>/,
  );
});

test("the complete landing import graph is strict-LazyMotion compatible", () => {
  const reachable = landingReachableSources();
  const relativePaths = new Set(
    [...reachable].map((file) => path.relative(projectRoot, file)),
  );

  for (const expected of [
    "components/reader/PhaseStepper.tsx",
    "components/reader/SummaryCard.tsx",
    "components/ui/Dialog.tsx",
    "components/ui/SegmentedControl.tsx",
  ]) {
    assert.ok(relativePaths.has(expected), `reachability missed ${expected}`);
  }

  for (const file of reachable) {
    const contents = readFileSync(file, "utf8");
    const relativePath = path.relative(projectRoot, file);
    assert.doesNotMatch(
      contents,
      /import \{[^}]*\bmotion\b[^}]*\} from "framer-motion"/,
      relativePath,
    );
    assert.doesNotMatch(contents, /<\/?motion\./, relativePath);
    assert.doesNotMatch(
      contents,
      /<m\.[A-Za-z][^>]*\b(?:layout(?:Id|Scroll|Root)?|drag(?:[A-Z]\w*)?)\b(?=\s|=|\/>)/,
      `${relativePath} requires domMax inside the domAnimation landing boundary`,
    );
  }
});

test("shared m controls self-provide features for consumers outside scoped routes", () => {
  const dialog = source("components/ui/Dialog.tsx");
  const segmentedControl = source("components/ui/SegmentedControl.tsx");

  assert.match(dialog, /<MotionFeatureProvider>/);
  assert.doesNotMatch(dialog, /<MotionFeatureProvider strict>/);
  assert.match(segmentedControl, /<MotionFeatureProvider strict>/);

  const pricing = source("components/sections/Pricing.tsx");
  assert.match(pricing, /<MotionFeatureProvider strict>/);
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
