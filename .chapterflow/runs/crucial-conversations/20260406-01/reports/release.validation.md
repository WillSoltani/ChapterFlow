# Release Validation Report

- book: Crucial Conversations: Tools for Talking When Stakes Are High
- runId: 20260406-01
- release artifact: .chapterflow/runs/crucial-conversations/20260406-01/release/crucial-conversations.modern.json
- status: pass

## Release Gate Checks

- assembled from validated chapters only: pass
- validated chapter count: pass (10)
- release-gate lint: pass (`FAIL=0 WARN=0`)
- release guard: pass (`FAIL=0 WARN=0`)
- approved hash preservation: pass after explicit normalization of `approvedChapterHashes.ch01` from file-byte SHA to canonical JSON SHA

## Release Package

- schemaVersion: `1.1.0`
- packageId: `crucial-conversations-20260406-01-release`
- createdAt: `2026-04-06T23:40:00Z`
- contentOwner: `ChapterFlow`

## Decision

- release gate result: cleared for repo wiring
- notes: release guard compared each release chapter object against the corresponding validated chapter object and found no drift
