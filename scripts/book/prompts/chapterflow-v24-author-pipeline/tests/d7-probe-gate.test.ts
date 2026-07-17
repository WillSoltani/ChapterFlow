/**
 * rt FINDING B — the ultra-acceptance PROBE GATE is validated, not trusted.
 *
 * `assertUltraProbeAccepted` / `isValidUltraProbe` (src/bakeoff/d7WorkerDispatch.ts)
 * must HONOR a probe sidecar only when it is a trustworthy proof for THIS D7 ultra
 * route: schemaVersion "ultra-acceptance-probe-v1", effort "ultra", model equal to
 * resolveD7RaterRoute().model, AND a self-hash that recomputes over the semantic
 * fields (the EXACT `hashCanonical` fingerprint `ultraSession.writeUltraProbeSidecar`
 * stamps). A hand-planted `{"accepted":true}` sidecar (bogus self-hash) and a
 * stale-model sidecar (self-consistent, but the wrong campaign winner) are both
 * treated as ABSENT — the campaign halts rather than spawn every rating at an
 * unproven effort.
 *
 * Pure + hermetic: no process, no filesystem — the sidecars are built in memory
 * with the same hashing the writer uses.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import { resolveD7RaterRoute } from "../src/orchestrator/modelPolicy.js";
import { D7JudgeError } from "../src/bakeoff/d7Judge.js";
import { assertUltraProbeAccepted, isValidUltraProbe } from "../src/bakeoff/d7WorkerDispatch.js";
import { ULTRA_EFFORT, type UltraAcceptanceProbeV1 } from "../src/exec/ultraSession.js";

/** The semantic content `writeUltraProbeSidecar` hashes (EXCLUDING sidecarPath /
 *  sidecarSha256). Kept byte-identical here so a self-consistent sidecar recomputes. */
type ProbeContent = {
  schemaVersion: "ultra-acceptance-probe-v1";
  probedAt: string;
  model: string;
  effort: typeof ULTRA_EFFORT;
  accepted: boolean;
  detail: string;
  manifestPath: string | null;
};

/** Build a SELF-CONSISTENT probe sidecar (its sidecarSha256 recomputes) from the
 *  given semantic content — the honest writer's exact shape. */
function selfConsistentProbe(content: ProbeContent): UltraAcceptanceProbeV1 {
  return { ...content, sidecarPath: "/tmp/probe/ultra-acceptance-probe.json", sidecarSha256: hashCanonical(content) };
}

function acceptedContent(over: Partial<ProbeContent> = {}): ProbeContent {
  return {
    schemaVersion: "ultra-acceptance-probe-v1",
    probedAt: "2026-07-17T00:00:00.000Z",
    model: resolveD7RaterRoute().model,
    effort: ULTRA_EFFORT,
    accepted: true,
    detail: "codex exec accepted -c model_reasoning_effort=ultra",
    manifestPath: null,
    ...over,
  };
}

test("a genuine, self-consistent accepted probe for the current route is honored (isValidUltraProbe true; assertUltraProbeAccepted does not throw)", () => {
  const probe = selfConsistentProbe(acceptedContent());
  assert.equal(isValidUltraProbe(probe), true);
  assert.doesNotThrow(() => assertUltraProbeAccepted(probe));
});

test("a valid-but-accepted:false probe is a DISTINCT honest halt (valid shape, but the CLI did not accept ultra)", () => {
  const probe = selfConsistentProbe(acceptedContent({ accepted: false, detail: "codex exec rejected the ultra reasoning-effort token" }));
  assert.equal(isValidUltraProbe(probe), true, "the shape/self-hash are valid — accepted:false is a separate axis");
  assert.throws(() => assertUltraProbeAccepted(probe), (err) => err instanceof D7JudgeError && /accepted:false/.test((err as Error).message));
});

test("hand-planted {\"accepted\":true} sidecar: correct schema/model/effort but a BOGUS self-hash is treated as absent (halt) — a self-hash the attacker did not recompute", () => {
  // Everything an attacker can fake by editing the file — accepted:true, the right
  // model/effort/schema — but they did not (or could not) recompute the self-hash.
  const planted: UltraAcceptanceProbeV1 = {
    ...acceptedContent({ detail: "hand-planted" }),
    sidecarPath: "/tmp/probe/ultra-acceptance-probe.json",
    sidecarSha256: "0".repeat(64),
  };
  assert.equal(isValidUltraProbe(planted), false, "a bogus self-hash fails validation");
  assert.throws(() => assertUltraProbeAccepted(planted), (err) => err instanceof D7JudgeError && /not a trustworthy proof/.test((err as Error).message));
});

test("stale-model sidecar: self-consistent (its self-hash recomputes) but the model is NOT the current campaign winner → treated as absent (halt)", () => {
  const stale = selfConsistentProbe(acceptedContent({ model: `${resolveD7RaterRoute().model}-PRIOR-WINNER` }));
  // Prove the self-hash IS internally consistent — so it is the MODEL check, not a
  // hash mismatch, that catches this stale proof.
  assert.equal(stale.sidecarSha256, hashCanonical({
    schemaVersion: stale.schemaVersion, probedAt: stale.probedAt, model: stale.model, effort: stale.effort,
    accepted: stale.accepted, detail: stale.detail, manifestPath: stale.manifestPath,
  }), "the stale sidecar is self-consistent");
  assert.equal(isValidUltraProbe(stale), false, "a stale-model proof is not THIS campaign's proof");
  assert.throws(() => assertUltraProbeAccepted(stale), (err) => err instanceof D7JudgeError && /not a trustworthy proof/.test((err as Error).message));
});

test("wrong-schema sidecar is treated as absent (halt) even with accepted:true and a self-consistent hash", () => {
  const content = { ...acceptedContent(), schemaVersion: "some-other-schema-v9" } as unknown as ProbeContent;
  const wrong = selfConsistentProbe(content);
  assert.equal(isValidUltraProbe(wrong), false);
  assert.throws(() => assertUltraProbeAccepted(wrong), D7JudgeError);
});

test("a null probe (absent sidecar) still halts with the missing-probe message", () => {
  assert.equal(isValidUltraProbe(null), false);
  assert.throws(() => assertUltraProbeAccepted(null), (err) => err instanceof D7JudgeError && /probe missing/.test((err as Error).message));
});
