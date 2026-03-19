#!/usr/bin/env -S npx tsx

import fs from "node:fs";
import path from "node:path";
import { BOOK_PACKAGES } from "@/app/book/data/bookPackages";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "public", "book-covers");
const REPORT_PATH = path.join(ROOT, "scripts", "book", "openlibrary-cover-report.json");

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const token of ta) {
    if (tb.has(token)) overlap += 1;
  }
  return (overlap / Math.max(ta.size, tb.size)) * 40;
}

function pickBestDoc(
  docs: Array<Record<string, unknown>>,
  title: string,
  author: string
): { doc: Record<string, unknown>; score: number } | null {
  const titleNorm = normalize(title);
  const authorNorm = normalize(author);
  const authorLast = authorNorm.split(" ").filter(Boolean).slice(-1)[0] || "";

  let best: { doc: Record<string, unknown>; score: number } | null = null;

  for (const doc of docs) {
    const coverId = typeof doc.cover_i === "number" ? doc.cover_i : 0;
    if (!coverId) continue;

    const docTitle = String(doc.title || "");
    const docAuthor = Array.isArray(doc.author_name) ? String(doc.author_name[0] || "") : "";
    const docNorm = normalize(docTitle);
    const docAuthorNorm = normalize(docAuthor);

    let score = 0;
    if (docNorm === titleNorm) score += 70;
    if (titleNorm && (docNorm.includes(titleNorm) || titleNorm.includes(docNorm))) score += 25;
    score += tokenOverlapScore(title, docTitle);
    if (authorLast && docAuthorNorm.includes(authorLast)) score += 25;
    score += Math.min(Number(doc.edition_count || 0), 20) * 0.25;

    if (!best || score > best.score) {
      best = { doc, score };
    }
  }

  if (!best || best.score < 22) return null;
  return best;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "chapterflow-cover-fetch/1.0",
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchBinary(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "chapterflow-cover-fetch/1.0",
      accept: "image/*",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const report: Array<Record<string, unknown>> = [];
  let downloaded = 0;
  let matched = 0;
  let failed = 0;

  for (const pkg of BOOK_PACKAGES) {
    const id = pkg.book.bookId;
    const title = pkg.book.title;
    const author = pkg.book.author;
    const entry: Record<string, unknown> = { id, title, author };

    try {
      const simplifiedTitle = cleanTitleForSearch(title);
      const queryCandidates = [
        `https://openlibrary.org/search.json?title=${encodeURIComponent(
          title
        )}&author=${encodeURIComponent(author)}&limit=20`,
        `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=20`,
        `https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=20`,
      ];
      if (simplifiedTitle && simplifiedTitle !== title) {
        queryCandidates.push(
          `https://openlibrary.org/search.json?title=${encodeURIComponent(simplifiedTitle)}&limit=20`,
          `https://openlibrary.org/search.json?q=${encodeURIComponent(simplifiedTitle)}&limit=20`
        );
      }

      const docsMap = new Map<string, Record<string, unknown>>();
      for (const query of queryCandidates) {
        const data = (await fetchJson(query)) as { docs?: Array<Record<string, unknown>> };
        const docs = Array.isArray(data.docs) ? data.docs : [];
        for (const doc of docs) {
          const key = String(doc.key || `${doc.title || ""}|${doc.cover_i || ""}`);
          if (!docsMap.has(key)) docsMap.set(key, doc);
        }
      }
      const docs = [...docsMap.values()];
      const best = pickBestDoc(docs, title, author);
      if (!best) {
        entry.status = "no-match";
        failed += 1;
        report.push(entry);
        continue;
      }

      const coverId = Number(best.doc.cover_i || 0);
      const coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      const bytes = await fetchBinary(coverUrl);
      const filePath = path.join(OUTPUT_DIR, `${id}.jpg`);
      fs.writeFileSync(filePath, bytes);

      matched += 1;
      downloaded += 1;
      entry.status = "downloaded";
      entry.matchScore = Math.round(best.score * 10) / 10;
      entry.coverId = coverId;
      entry.coverUrl = coverUrl;
      entry.matchTitle = String(best.doc.title || "");
      entry.matchAuthor = Array.isArray(best.doc.author_name)
        ? String(best.doc.author_name[0] || "")
        : "";
      report.push(entry);
      await sleep(110);
    } catch (error) {
      entry.status = "error";
      entry.error = error instanceof Error ? error.message : String(error);
      failed += 1;
      report.push(entry);
    }
  }

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        books: BOOK_PACKAGES.length,
        matched,
        downloaded,
        failed,
        reportPath: path.relative(ROOT, REPORT_PATH),
      },
      null,
      2
    )
  );
}

function cleanTitleForSearch(title: string): string {
  return title
    .replace(/\bvol(?:ume)?\.?\s*\d+\b/gi, "")
    .replace(/\bpart\s+\d+\b/gi, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
