# Release Audit Report

- release source: validated chapter artifacts only
- release chapter count: 10
- repo package path: book-packages/never-split-the-difference.modern.json

## Assembly Audit

- chapter source files loaded: `validated/ch01.chapter.json` through `validated/ch10.chapter.json`
- assembly order: sorted by `number`
- regenerated chapter content during release: no
- builder functions called during release assembly: no
- prose normalized during release assembly: no

## Integrity Audit

- release chapters match validated chapters: yes
- sealed chapter hashes preserved after repair: yes
- review wrappers remain matched to full validated payloads: yes
- all required chapter artifact bundles remain present on disk: yes

## Repo Audit

- repo validator result: pass
- release-gate lint result: pass
- build result: pass

## Notes

- release metadata uses locked edition title and author metadata from `edition-lock.json`
- repo package categories and tags were populated at release assembly to satisfy repo package shape validation
