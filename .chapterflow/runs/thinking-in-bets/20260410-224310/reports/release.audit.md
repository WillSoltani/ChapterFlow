# Release Audit Report

- Release assembled only after all numbered chapters validated.
- Release package built from seven validated chapter JSON files.
- Final chapter count in frozen map: 7.
- Final wave was routed as a compliant solo wave because the frozen chapter map ended at `ch07`.
- A release-gate deviation was found after initial assembly: continuity stored file-byte hashes while the v13 release guard expected canonical chapter-object hashes.
- The run state was repaired by resealing continuity to canonical chapter-object hashes and re-running release guard plus artifact guard to clean pass.
- Source guard passed on the frozen source bundle after release assembly.
- Repo-level `validate-book.mjs` remains a contract mismatch against this v13 release shape and was documented rather than silently ignored.
