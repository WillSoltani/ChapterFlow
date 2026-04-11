# Source Freeze Report — The Checklist Manifesto

## Locked package facts
- title: `The Checklist Manifesto: How to Get Things Right`
- author: `Atul Gawande`
- language: `English`
- dominant edition family: `2010 Metropolitan Books first-edition family`
- ISBN-13: `9780805091748`
- page count: `209`
- chapter range: `1-9`

## Frozen source bundle contents
- `source-freeze/book-source.md`
- `source-freeze/toc.json`
- `manifests/source-ledger.json`
- `manifests/edition-lock.json`
- `sidecars/source/source-heading-index.json`

## Source sufficiency assessment
- Book-level metadata: strong
- Chapter order and titles: strong
- Page starts: strong
- Chapter-level examples and mechanisms: medium
- Exact quote support: thin

## Practical implications
- Strong enough to build chapter briefs, outlines, quiz blueprints, and source sidecars for the full run.
- Strong enough to write paraphrase-first canonical and edited drafts.
- Not strong enough for broad exact-quote usage; any exact quote must stay short and trace to the frozen preview support.

## Rejected source types
- Pirate mirrors and reposted scans were excluded.
- Full-text copies without clear rights posture were excluded.
- Generic summary sites without visible chapter-level specificity were not included in the ledger.
