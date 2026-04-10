# Release Validation Report — Games People Play

**Date:** 2026-04-09  
**Run root:** `.chapterflow/runs/games-people-play/20260406-01`  
**packageId:** f659396d-24b7-4b75-aea3-5d1e0a5bdd7a  
**schemaVersion:** 1.1.0  
**Assembly method:** Python — loaded each `validated/chNN.chapter.json` in order, wrapped in envelope, dumped with `json.dump(indent=2, ensure_ascii=False)`

---

## Hash Integrity Check

All SHA-256 hashes verified against `continuity/continuity-state.json → approvedChapterHashes`.

| Ch | Title | Expected Hash (first 16) | Result |
|----|-------|--------------------------|--------|
| ch01 | The Three Voices Inside You | e3f0370a785ab4c3... | OK |
| ch02 | What a Transaction Is and Why They Go Wrong | 95f5236bb50fa9c0... | OK |
| ch03 | Ulterior Transactions and the Anatomy of a Game | 73f56dbf93c45f42... | OK |
| ch04 | Why Games Feel So Hard to Stop | 6b80fd5be5e2cf03... | OK |
| ch05 | Life Games | 74cc0e4cf8d4b5c5... | OK (re-validated 2026-04-09) |
| ch06 | Marital Games | 9ff46ea45e522547... | OK |
| ch07 | Party and Social Games | 30487f553783a1cf... | OK |
| ch08 | Professional and Therapy-Room Games | 905c2e3a70278151... | OK |
| ch09 | Games That Aren't Worth Fighting | 8c932cbbf9b59d22... | OK |
| ch10 | What Comes After Games | 19b9676429aa9458... | OK |

**All 10 chapters: PASS**

---

## Ch05 Re-validation Note

A hash drift was detected on ch05 during the Phase 8 integrity check. Investigation found:
- `validated/ch05.chapter.json` had been overwritten with `structured/ch05.chapter.json`
- The structured version had 7 chapterBreakdown tones with word counts outside spec bands
- The chapter was re-validated at user direction (Option B: re-run validation from structured/)
- Word count corrections made (minimum words added per tone to meet floor):
  - easy.gentle: 130 → 149 words
  - easy.direct: 127 → 149 words  
  - easy.competitive: 132 → 151 words
  - medium.gentle: 328 → 330 words
  - medium.direct: 294 → 347 words
  - medium.competitive: 307 → 330 words
  - hard.competitive: 465 → 490 words
- No em dashes introduced. No banned phrases introduced.
- Quality gate score remains 12/12 (all prose and mechanical checks pass).
- New hash locked in continuity-state.json: `74cc0e4cf8d4b5c5b02926fdad760c10bf718ba0c86641914ce2322fbaace24c`

---

## Release Assembly

- Source: `validated/ch01.chapter.json` through `validated/ch10.chapter.json`
- Output: `release/games-people-play.modern.json`
- Chapter count: 10 (verified post-assembly by JSON parse)
- Chapter IDs in order: ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, ch09, ch10
- File size: 705,032 bytes
- v12-sealed tooling: not present in repo (skipped per handoff instructions)

**Result: PASS**
