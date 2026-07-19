import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { test } from "node:test";

const ADMIN_ROOT = join(process.cwd(), "app/book/admin");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const RECHARTS_IMPORT = /(?:from\s+|import\s*)["']recharts["']/;

const EXPECTED_LAZY_LEAVES = [
  "_components/charts/BillingCharts.tsx",
  "_components/charts/ContentCharts.tsx",
  "_components/charts/DevicesCharts.tsx",
  "_components/charts/EconomyCharts.tsx",
  "_components/charts/EngagementCharts.tsx",
  "_components/charts/GrowthCharts.tsx",
  "_components/charts/KPISparklineChart.tsx",
  "_components/charts/PerformanceCharts.tsx",
  "_components/charts/RetentionCharts.tsx",
  "_components/charts/RevenueCharts.tsx",
];

const EXPECTED_DYNAMIC_CALLERS = [
  "_clients/BillingClient.tsx",
  "_clients/ContentClient.tsx",
  "_clients/DevicesClient.tsx",
  "_clients/EconomyClient.tsx",
  "_clients/EngagementClient.tsx",
  "_clients/GrowthClient.tsx",
  "_clients/PerformanceClient.tsx",
  "_clients/RetentionClient.tsx",
  "_clients/RevenueClient.tsx",
  "_components/KPITile.tsx",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

test("admin Recharts imports are confined to lazy chart leaves", () => {
  const importers = sourceFiles(ADMIN_ROOT)
    .filter((path) => RECHARTS_IMPORT.test(readFileSync(path, "utf8")))
    .map((path) => relative(ADMIN_ROOT, path))
    .sort();

  assert.deepEqual(importers, EXPECTED_LAZY_LEAVES);
});

test("admin chart leaves have no static import path back into an initial route", () => {
  const importers = sourceFiles(ADMIN_ROOT)
    .filter((path) => !relative(ADMIN_ROOT, path).startsWith("_components/charts/"))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return /(?:from\s+|import\s+)["'][^"']*\/_components\/charts\//.test(source);
    })
    .map((path) => relative(ADMIN_ROOT, path));

  assert.deepEqual(importers, []);
});

test("each former Recharts owner uses a named-export client-only dynamic boundary", () => {
  for (const caller of EXPECTED_DYNAMIC_CALLERS) {
    const source = readFileSync(join(ADMIN_ROOT, caller), "utf8");
    const dynamicCalls = source.match(/dynamic\(\s*\(\)\s*=>\s*import\(/g) ?? [];
    const namedExports =
      source.match(/\.then\(\s*\(module\)\s*=>\s*module\.[A-Za-z][A-Za-z0-9]*,?\s*\)/g) ?? [];
    const clientOnlyOptions = source.match(/\{\s*ssr:\s*false\s*\}/g) ?? [];
    const chartLeafImports =
      source.match(/import\("@\/app\/book\/admin\/_components\/charts\/[A-Za-z]+"\)/g) ?? [];

    assert.match(source, /import dynamic from "next\/dynamic";/, `${caller} must import next/dynamic`);
    assert.ok(dynamicCalls.length > 0, `${caller} must define at least one dynamic chart`);
    assert.equal(
      chartLeafImports.length,
      dynamicCalls.length,
      `${caller} must point every dynamic boundary at an admin-local chart leaf`,
    );
    assert.equal(
      namedExports.length,
      dynamicCalls.length,
      `${caller} must select a named export for every dynamic chart`,
    );
    assert.equal(
      clientOnlyOptions.length,
      dynamicCalls.length,
      `${caller} must disable SSR for every dynamic chart`,
    );
  }
});
