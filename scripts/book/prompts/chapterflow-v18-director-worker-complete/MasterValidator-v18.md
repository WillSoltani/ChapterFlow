
# ChapterFlow v18 MasterValidator

Run in two modes:
- chapter_gate
- release_gate

## Chapter gate must check

1. canonical schema only
2. tone objects everywhere required
3. quiz present with 10 questions
4. no instruction leakage
5. no source-splice contamination outside allowed quotes
6. no duplicate semantic surfaces
7. word counts in range
8. repetition ceiling
9. medium/hard depth differentiation
10. scenario vividness and lesson diversity
11. prompt functionality
12. reading time alignment

## Release gate must also check

- every release chapter hash matches a committed validated chapter
- chapter order complete
- continuity caps
- cross-chapter references and q09/q10 synthesis
- repo wiring excluding cover work

## Scoring emphasis

A structurally valid chapter still fails if:
- the same idea is padded across depths
- moreDetails restate instead of extend
- examples are functional but generic
- the package shows leftover assembly seams
- the output feels template-driven instead of edited
