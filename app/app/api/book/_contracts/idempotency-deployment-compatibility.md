# Idempotency deployment-compatibility manifest — WP-IDEMPOTENCY-01

Coordinated two-repo change adding a **stable mutation identity** to retryable
durable writes: the iOS client stamps an `Idempotency-Key` header; the backend
deduplicates repeat submissions of the same `(account, key)`.

**This backend change is LOCAL ONLY.** It has not been deployed, pushed, or
merged. `Deployed backend revision/environment: UNEVALUABLE` — source presence
is not deployment proof.

## Compatibility matrix (both directions are safe)

| Client half | Backend half | Behavior | Safe? |
|---|---|---|---|
| ships `Idempotency-Key` | **no dedupe deployed (current prod)** | header is an unknown request header → ignored; writes apply exactly as today | ✅ |
| ships `Idempotency-Key` | dedupe deployed | first `(account,key)` applies + is stored; repeats replay the stored outcome, never double-apply | ✅ |
| no header (old client / non-write) | dedupe deployed | empty/absent key disables dedupe (`runIdempotent` executes every time) — identical to pre-dedupe behavior | ✅ |

**Ship order:** the client half is safe to ship **first**. A backend without
dedupe treats the header as an ordinary unknown header and applies the write
unchanged (today's behavior). Therefore the iOS change carries no dependency on
this backend change reaching production.

## Rollback

- **Client:** revert `feat(sync): stamp durable writes with a stable idempotency key`.
  The header simply stops being sent; no persisted state depends on it.
- **Backend:** revert this branch. In-flight `BOOK_IDEMPOTENCY` records self-expire
  via the table `ttl` attribute; no migration or backfill is required. Reverting
  restores the pre-dedupe execute-every-time path.

## Wired routes (in-scope native writes)

Durable **creates / accumulators** where a retried submit would double-apply are
wired through `runIdempotent` (`idempotency-core.ts` + DynamoDB store in
`idempotency-repo.ts`):

- `POST /book/me/commitments` — prevents a duplicate commitment row.
- `POST /book/me/reading-sessions` — prevents double-counting reading time.
- `POST /book/me/notebook` — prevents a duplicate highlight/note row (CF2-022).
  The route mints `highlightId = crypto.randomUUID()` server-side per attempt, so
  the `attribute_not_exists(SK)` guard in `createHighlight` cannot dedupe a retry
  (each attempt's id is fresh). The native client stamps this create with the same
  stable mutation id it uses for commitments (`SyncDispatch` note + highlight
  create paths), so a dropped-200 retry re-dispatching the identical journal entry
  would otherwise create a second row. Wiring it through `runIdempotent`
  (routeKey `notebook.post`) replays the first entry instead.

The client stamps the key on every durable write it dispatches; a backend route
that does not (yet) call `runIdempotent` simply ignores the header (row 1 above).

### Naturally idempotent / already-deduped (no new key-based dedupe needed)

- `PATCH /book/me/books/{bookId}/state` (progress cursor) — a set operation; a
  repeat writes the same cursor value.
- `POST /book/me/saved` — a set-to-boolean toggle; a repeat is a no-op change.
- `POST /book/me/reviews/{cardId}` — already guarded by a time-window dedupe in
  the route (a re-grade seconds later is rejected before the scheduler advances).
- `PATCH /book/me/notebook` (highlight colour/snippet/anchor update) — a
  validated last-write-wins set on an existing row (`attribute_exists(SK)`); a
  repeat re-writes identical field values, so it converges. No key dedupe needed.
- `DELETE /book/me/notebook` — removing a row is convergent: a retried delete of an
  already-removed highlight yields the same end state (no double-apply). It returns
  a benign `404 not_found` on the second attempt, never a second mutation. (The
  native client's `PATCH`/`DELETE` target the `/{entryId}` sub-path, a separate
  route; the create above is the only `/book/me/notebook` write the client stamps
  that could double-apply.)

## Storage

`BOOK_IDEMPOTENCY` items live under the requesting user's partition
(`bookUserPk(accountId)`), so a key can only ever replay **that same account's**
stored outcome. The sort key namespaces by `routeKey`, and records carry a `ttl`
(epoch seconds) so the dedupe ledger self-cleans; a crashed executor's
still-`in_progress` reservation expires and becomes reservable again (the client
outcome was never applied, so re-execution is correct).
