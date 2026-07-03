# Promotion concurrency — ownership & recovery invariants

`promoteBook` is the final gate that publishes a `BookPackageV21` into the
production library. It stages the candidate inside a transaction directory under
`state/books/_transactions/<bookId>.<txId>/`, verifies it, then renames it over
`book-packages/<bookId>.v21.json` (an atomic single-step publication).

## The hazard this hardening removes

`promoteBook` used to begin every publish with `recoverPromotionTransactions(bookId)`,
which `rmSync`-removed **every** `state/books/_transactions/<bookId>.*` directory
unconditionally — no check of ownership, process liveness, age, or whether
another live promotion was mid-stage in that exact directory. Two promotions of
the same book racing through that path meant the second one's "recovery" deleted
the first's staging transaction out from under it: a torn publish, or a lost
package.

The fix is a **per-book promotion lease** ([`src/promotionLease.ts`](../src/promotionLease.ts))
plus **owner-proven, scoped recovery** ([`src/promoteBook.ts`](../src/promoteBook.ts)).
It is the same ownership-safe design the QC orchestrator already uses
([`src/qc/orchestrator/transaction.ts`](../src/qc/orchestrator/transaction.ts)),
applied to the promotion seam.

## The lock

- **Path:** `state/books/_locks/<bookId>.promotion.lock` — a directory kept
  separate from `_transactions/` so a lock file is never mistaken for a
  transaction directory.
- **Created atomically** with `writeFileSync(..., { flag: "wx" })` (exclusive
  create). The first writer wins; everyone else hits `EEXIST` and must evaluate.
- **Records** (`schemaVersion: "promotion-lease-v1"`): `bookId`, `ownerToken`
  (a cryptographically random 16-byte hex token — the authoritative identity),
  `ownerId` (human-readable), `pid`, `hostname`, `acquiredAt`, `lastHeartbeatAt`,
  `expiresAt`, and `transactionId` (ties the lock to its staging directory).

## Ownership invariants

1. **One promotion per book at a time.** A live, unexpired lease is never
   recoverable; a contender fails closed regardless of any liveness claim.
2. **Liveness, not the clock, authorizes recovery.** A contender that finds an
   existing lock may displace it **only** when *both*:
   - the lease is **expired** (`expiresAt <= now`), **and**
   - the owner is **provably dead** — same host, and the recorded pid no longer
     exists (`process.kill(pid, 0)` ⇒ `ESRCH`).
3. **Unknown liveness fails closed.** A remote-host owner, a recycled-but-live
   pid (`EPERM`), or an unreadable/foreign lock yields "unknown" — the promotion
   refuses to steal the lock and returns an actionable
   `PROMOTION_LEASE_UNAVAILABLE` verdict (no production state touched).
4. **A live owner never loses its lease to wall-clock TTL.** Promotion is
   synchronous, so a long publish can outlive the TTL; a same-host successor
   probes the owner pid, sees it alive, and refuses to steal. Heartbeats also
   push `expiresAt` forward at every durable transition, so a healthy lease
   rarely even reaches the stale path. The liveness gate is the load-bearing
   protection; the heartbeat is the optimization.
5. **Release is compare-by-owner-token.** A lease removes the lock only when the
   on-disk `ownerToken` still matches its own. A displaced old owner is a no-op,
   so it can never delete a successor's lock. Release is best-effort and never
   throws (safe in a `finally`).
6. **The lease is held across the whole critical section** — candidate
   construction, staging, verification, the final rename, journal completion,
   and cleanup — and released in a `finally`.
7. **No force-publish after losing ownership.** The lease is heartbeated (which
   re-asserts ownership) immediately before the atomic rename; if a successor
   has taken the lock, the heartbeat throws and the package is never renamed
   live behind the new owner's back.

## Transaction-directory recovery invariants

Each staging directory `state/books/_transactions/<bookId>.<txId>/` carries an
**owner stamp** `owner.json` (`schemaVersion: "promotion-tx-owner-v1"`) recording
the `ownerToken`, `transactionId`, `pid`, and `hostname` of the lease that
created it. This is the proof recovery needs.

8. **Recovery is owner-proven and scoped.** Under the held lease, promotion reaps
   a leftover `<bookId>.<txId>/` directory **only** when its owner stamp proves
   the owner is **dead** (same host, pid gone). Directories whose owner is alive,
   of unknown liveness, or that carry no readable owner stamp are **left in place**
   as forensic evidence. Recovery never destroys a directory it cannot prove is
   abandoned, and never touches a transaction it does not own.
9. **No broad deletion.** The old "remove every `<bookId>.*` directory" behavior
   is gone. Reaping is sound only while the per-book lease is held — the lease
   guarantees no concurrent live owner for the book, so any leftover directory is
   from a crashed/dead prior owner, never a racing one.
10. **A fault leaves recoverable evidence.** A crash/fault mid-publish leaves the
    transaction directory with its `owner.json`, `journal.json` (last durable
    state), and any staged `package.v21.json` intact — and exposes no production
    package. The owner releases its lease on the way out, so a clean re-promote
    can proceed; that re-promote's owner-proven reap removes the dead owner's
    directory once it can prove the owner is gone.

## What is preserved

- The atomic final publication (stage → verify → `rename`) and every
  fault-injection seam (`beforeStaging`, `afterStaging`, `afterVerification`,
  `beforeFinalRename`, `beforeRegistryUpdate`) are unchanged.
- A blocked promotion still writes its quarantine + gate report and touches no
  package; a lease-unavailable promotion writes nothing at all.

## Tests

- [`tests/promotion-lease.test.ts`](../tests/promotion-lease.test.ts) — the lease
  primitive: live-owner protection, expired-but-alive cannot be stolen,
  stale+dead recovery (with forensic `.recovered-*` retention), unknown/foreign
  fails closed, heartbeat extension, compare-by-owner release, an old owner
  cannot remove a successor's lock.
- [`tests/promote-gate.test.ts`](../tests/promote-gate.test.ts) — the integration:
  a live lease blocks a second promotion and never touches its staging directory;
  expired-but-alive / unknown promotions fail closed; a known-dead owner is
  recovered; two simulated promotions cannot both publish; a fault leaves
  owner-attributed recoverable evidence; recovery reaps only the dead owner's
  transaction; and every pre-existing transactional-promotion test stays green.
