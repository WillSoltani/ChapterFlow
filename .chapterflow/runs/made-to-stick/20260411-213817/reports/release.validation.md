# Release Validation Report

Run: 20260411-213817
Book: Made to Stick
Release: `.chapterflow/runs/made-to-stick/20260411-213817/release/made-to-stick.modern.json`

## Assembly Checks

- release assembled from validated chapter JSONs only
- package id: `made-to-stick.modern`
- chapter count: 6
- chapter range in release: 1-6

## Guard Results

- source guard: `FAIL=0 WARN=0`
- release lint (`release_gate`): `FAIL=0 WARN=0`
- release guard: `FAIL=0 WARN=0`

## Repair Log

- detected deviation: continuity seals were stored as file-byte `sha256` values while `chapterflow_v13_release_guard.py` checks canonical chapter-object hashes
- repair applied: added canonical `chapterSha256` values for `ch01` through `ch06` in `continuity/continuity-state.json`
- relevant validation rerun: release guard rerun after repair and passed clean

## Decision

Pass.
