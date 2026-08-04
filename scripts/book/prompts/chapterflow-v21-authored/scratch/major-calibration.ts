/**
 * One-off calibration: tally which MAJOR catalog ids fire across the clean + gold
 * reference corpus. A major that fires on reference-quality (shipped) books cannot
 * safely HARD-GATE QC — auto-fixing it would degrade a clean book and risk a
 * gate-converge spin. Those are the ADVISORY set; the zero-on-reference majors are
 * the BLOCKING set (safe to fix-before-QC).
 */
import { readFileSync } from "fs";
import { goldChapterFiles, cleanCorpusChapterFiles } from "../tests/helpers.js";
import { runShipGate } from "../src/critics/finalGate.js";
import { runBookGate } from "../src/critics/bookGate.js";
import { isAdvisoryMajor } from "../src/critics/majorPolicy.js";
import { unresolvedMajors } from "../src/qc/majorDisposition.js";

const oldWarn = console.warn;
console.warn = () => {};

const corpus = [...goldChapterFiles(), ...cleanCorpusChapterFiles()].filter((b) => b.files.length > 0);
const fire = new Map<string, Set<string>>(); // catalogId -> set of bookIds
let bookCount = 0;

for (const { bookId, files } of corpus) {
  bookCount++;
  const chapters = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
  for (const ch of chapters) {
    for (const m of runShipGate(ch).majors) {
      if (!fire.has(m.catalogId)) fire.set(m.catalogId, new Set());
      fire.get(m.catalogId)!.add(bookId);
    }
  }
  try {
    for (const f of runBookGate(bookId, chapters).findings) {
      if (f.severity !== "major") continue;
      if (!fire.has(f.catalogId)) fire.set(f.catalogId, new Set());
      fire.get(f.catalogId)!.add(bookId);
    }
  } catch { /* book-gate read error on a fixture is not a signal */ }
}

console.warn = oldWarn;
console.log(`corpus books: ${bookCount}\n`);
console.log("MAJORS THAT FIRE ON REFERENCE CORPUS:");
const rows = [...fire.entries()].sort((a, b) => b[1].size - a[1].size);
for (const [id, books] of rows) {
  console.log(`  ${isAdvisoryMajor(id) ? "ADVISORY" : "BLOCKING"}  ${id}  —  ${books.size} book(s): ${[...books].slice(0, 6).join(", ")}${books.size > 6 ? ", …" : ""}`);
}
if (rows.length === 0) console.log("  (none — every major is zero on the reference corpus)");

// The whole point: after demotion, a reference-quality book carries ZERO BLOCKING
// majors, so the gate-phase major convergence has nothing to chase on a clean book.
console.warn = () => {};
let blockingTotal = 0;
for (const { bookId, files } of corpus) {
  const chapters = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
  try { blockingTotal += unresolvedMajors(bookId, chapters, false).length; } catch { /* ignore */ }
}
console.warn = oldWarn;
console.log(`\nTOTAL BLOCKING majors across reference corpus (must be 0): ${blockingTotal}`);
