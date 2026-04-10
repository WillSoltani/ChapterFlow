# Release Validation

- assembled strictly from validated/*.chapter.json
- chapter count: 30
- first chapter: ch01
- last chapter: ch30
- book package: release/indistractable.modern.json
- release guard: `FAIL=0 WARN=0`
- release-gate lint: `FAIL=0 WARN=0`
- source guard: `FAIL=0 WARN=0`
- artifact guard: `FAIL=0 WARN=0`
- repo build: `npm run build` passed
- repo build warning: Next.js reported that the `middleware` file convention is deprecated in favor of `proxy`
