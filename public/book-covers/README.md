# Book Cover Uploads

Drop book cover images in this folder to override emoji placeholders across the Book Accelerator UI.

## Format (raster, not SVG)
Covers ship as **WebP + AVIF** rasters at **600×900** (2× the largest displayed
size, the 200×300 library hero). The library renders them through `next/image`
with `unoptimized` + an AVIF-first / WebP-fallback candidate chain
(`lib/book-covers.ts → getBookCoverCandidates`), so the optimizer never touches
them and there is no `/_next/image` 400.

The catalog was originally shipped as traced SVGs (~58 MB; single files up to
2.2 MB) that `/_next/image` refused — every shelf fell back to a gradient
placeholder. They were converted to WebP (4.6 MB total) + AVIF (3.3 MB total)
and the SVGs were deleted.

### Regenerating rasters from a new SVG/PNG source
Add the source here, then rasterize with `sharp` (already a dependency). Run
from the repo root so `node_modules` resolves:

```js
// node ./regen.mjs   (throwaway — do not commit)
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const base = "deep-work"; // bookId
const buf = readFileSync(`public/book-covers/${base}.svg`);
for (const [ext, enc] of [["webp", b => b.webp({ quality: 82 })], ["avif", b => b.avif({ quality: 55 })]]) {
  writeFileSync(`public/book-covers/${base}.${ext}`,
    await enc(sharp(buf, { density: 150 }).resize(600, 900, { fit: "cover" })).toBuffer());
}
```

## Naming rule
Use the exact `bookId` filename. Preferred: `.webp` (canonical) + `.avif`
(AVIF-first). Also accepted by the fallback chain:

- `.png`
- `.jpg`

Examples:

- `crucial-conversations.svg`
- `deep-work.png`
- `the-power-of-habit.jpg`
- `zero-to-one.webp`

## Where covers are used
These covers are automatically used in:

- onboarding book cards
- home dashboard cards
- library cards
- book detail overview

If no cover file is found, the UI falls back to the existing emoji icon.

## Optional explicit path
If you want a non-standard filename, set `coverImage` in:

- `app/book/data/booksCatalog.ts`

Example:

```ts
{
  id: "crucial-conversations",
  coverImage: "/book-covers/crucial-conversations-special-edition.png",
  // ...
}
```
