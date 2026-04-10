# Release Audit Report

- book: Crucial Conversations: Tools for Talking When Stakes Are High
- runId: 20260406-01
- wired package: book-packages/crucial-conversations.modern.json

## Chapter Hash Audit

- ch01: `428c3cabbe6b6f7ddbbd99fb43769b314ba97bdcb6037df3ae3b52d0f550c5ed`
- ch02: matched validated chapter in release guard
- ch03: matched validated chapter in release guard
- ch04: matched validated chapter in release guard
- ch05: matched validated chapter in release guard
- ch06: matched validated chapter in release guard
- ch07: matched validated chapter in release guard
- ch08: matched validated chapter in release guard
- ch09: matched validated chapter in release guard
- ch10: matched validated chapter in release guard

## Repo Wiring Checks

- repo validator: completed
  - command: `node scripts/book/validate-book.mjs book-packages/crucial-conversations.modern.json`
  - result: score `79.3/100`
  - findings: `345 total` (`217 high`, `126 medium`, `2 low`)
  - note: findings are dominated by broader legacy/heuristic content-audit rules across the full ten-chapter package rather than release-guard or schema failures
- repo package lint: pass (`FAIL=0 WARN=0`)
- build: pass (`npm run build`)

## Audit Conclusion

- sealed release contract: pass
- repo compilation: pass
- residual risk: the repo validator still reports substantial content-audit findings that would require a separate cross-book normalization pass rather than a release-assembly fix
