# ChapterFlow v19 Sealed Provenance Pack

This is a sealed, Director + Workers ChapterFlow pack designed to stop long-book drift.

What changed from the failing runs:
- the Director cannot author content
- generator shortcuts are explicitly banned
- every chapter must leave a provenance chain on disk
- chapters are committed only through a guard-checked commit tool
- release is assembled from committed validated chapters only
- weak source freezes are blocked instead of silently fabricated into books

Use this pack when earlier versions produced strong early chapters and weak later chapters by drifting into metadata-driven generation.
