import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateParameterNames,
  classifySsmCandidateError,
  type SsmCandidate,
} from "./server-env-core";

// ─── candidateParameterNames (ordering + prefix-scope tagging) ───────────────

test("with a prefix, the prefix-scoped names come first and are tagged prefixScoped", () => {
  const got = candidateParameterNames("VAPID_PUBLIC_KEY", "/chapterflow/prod", {});
  assert.deepEqual(got, [
    { name: "/chapterflow/prod/VAPID_PUBLIC_KEY", prefixScoped: true },
    { name: "/chapterflow/prod/vapid_public_key", prefixScoped: true },
    { name: "VAPID_PUBLIC_KEY", prefixScoped: false },
    { name: "vapid_public_key", prefixScoped: false },
    { name: "/VAPID_PUBLIC_KEY", prefixScoped: false },
    { name: "/vapid_public_key", prefixScoped: false },
  ] satisfies SsmCandidate[]);
});

test("a trailing slash on the prefix is normalized away", () => {
  const got = candidateParameterNames("SES_SENDER_EMAIL", "/chapterflow/prod/", {});
  assert.equal(got[0].name, "/chapterflow/prod/SES_SENDER_EMAIL");
  assert.equal(got[0].prefixScoped, true);
});

test("with no prefix there are no prefix-scoped candidates — only bare-name fallbacks", () => {
  const got = candidateParameterNames("SES_SENDER_EMAIL", "", {});
  assert.deepEqual(got, [
    { name: "SES_SENDER_EMAIL", prefixScoped: false },
    { name: "ses_sender_email", prefixScoped: false },
    { name: "/SES_SENDER_EMAIL", prefixScoped: false },
    { name: "/ses_sender_email", prefixScoped: false },
  ]);
  assert.equal(
    got.some((c) => c.prefixScoped),
    false,
    "no candidate should be prefix-scoped when prefix is empty",
  );
});

test("an explicit override is tried first and is treated as prefix-scoped (intentional in-scope pin)", () => {
  const got = candidateParameterNames("SES_SENDER_EMAIL", "/chapterflow/prod", {
    SSM_PARAM_SES_SENDER_EMAIL: "/custom/path/sender",
  });
  assert.deepEqual(got[0], { name: "/custom/path/sender", prefixScoped: true });
});

test("duplicate names are deduped (first occurrence + its scope wins)", () => {
  // When key === lower (already lowercase) the lower variant collapses into the key.
  const got = candidateParameterNames("vapid", "/p", {});
  const names = got.map((c) => c.name);
  assert.deepEqual(new Set(names).size, names.length, "no duplicate names");
});

// ─── classifySsmCandidateError (the F7 regression seam) ──────────────────────

function awsError(name: string): { name: string } {
  return { name };
}

test("ParameterNotFound is always skippable (prefixed or not)", () => {
  const err = awsError("ParameterNotFound");
  assert.equal(classifySsmCandidateError(err, true), "skip");
  assert.equal(classifySsmCandidateError(err, false), "skip");
});

test("AccessDenied on an UNSCOPED bare-name fallback is skippable (prefix-scoped-role tolerance preserved)", () => {
  // This is the legitimate case: the Lambda role is scoped to the env prefix, so
  // the unscoped bare-name fallbacks are denied — expected, skip past them.
  assert.equal(classifySsmCandidateError(awsError("AccessDeniedException"), false), "skip");
  assert.equal(classifySsmCandidateError(awsError("AccessDenied"), false), "skip");
});

test("REGRESSION (F7): AccessDenied on the PREFIX-SCOPED candidate is recorded, NOT skipped", () => {
  // The prefixed name is the one the IAM role is supposed to be able to read. A
  // denial there is a real misconfiguration (prefix typo, region/account
  // mismatch, KMS-decrypt denial) and MUST be recorded so loadFromSsm propagates
  // it instead of returning undefined → which would poison missingCache and leave
  // SSM-only config (VAPID_*, SES_SENDER_EMAIL) absent for the process lifetime.
  assert.equal(classifySsmCandidateError(awsError("AccessDeniedException"), true), "record");
  assert.equal(classifySsmCandidateError(awsError("AccessDenied"), true), "record");
});

test("AccessDenied is matched on Code and __type fields too, not just name", () => {
  assert.equal(classifySsmCandidateError({ Code: "AccessDenied" }, true), "record");
  assert.equal(classifySsmCandidateError({ __type: "AccessDeniedException" }, true), "record");
  assert.equal(classifySsmCandidateError({ Code: "AccessDenied" }, false), "skip");
});

test("a transient/credential error (e.g. throttling, network) is recorded on any candidate", () => {
  for (const prefixScoped of [true, false]) {
    assert.equal(
      classifySsmCandidateError(awsError("ThrottlingException"), prefixScoped),
      "record",
      `ThrottlingException prefixScoped=${prefixScoped}`,
    );
    assert.equal(
      classifySsmCandidateError(awsError("TimeoutError"), prefixScoped),
      "record",
    );
    assert.equal(
      classifySsmCandidateError(new Error("socket hang up"), prefixScoped),
      "record",
    );
  }
});

test("a non-object error is recorded (never silently skipped)", () => {
  assert.equal(classifySsmCandidateError(null, true), "record");
  assert.equal(classifySsmCandidateError("boom", false), "record");
  assert.equal(classifySsmCandidateError(undefined, true), "record");
});

// ─── End-to-end of the candidate walk: the F7 scenario ───────────────────────
//
// Simulate loadFromSsm's classification loop over the real candidate list to
// prove the prefixed-AccessDenied now surfaces a recorded error rather than
// being skipped to an undefined (→ poison-cached) result.

test("F7 end-to-end: AccessDenied on the prefixed name surfaces a recorded error (would poison-cache before the fix)", () => {
  const candidates = candidateParameterNames("VAPID_PUBLIC_KEY", "/chapterflow/prod", {});
  // The role is mis-scoped: the prefixed reads are denied; the unscoped fallbacks
  // are denied too (role scoped away from them).
  const accessDenied = awsError("AccessDeniedException");

  let lastError: unknown;
  let skippedAll = true;
  for (const candidate of candidates) {
    const disp = classifySsmCandidateError(accessDenied, candidate.prefixScoped);
    if (disp === "skip") continue;
    skippedAll = false;
    lastError = accessDenied;
  }

  assert.equal(skippedAll, false, "the prefixed AccessDenied must NOT be skipped");
  assert.ok(lastError, "an error must be recorded so loadFromSsm can throw under SSM_PREFIX");
});

test("non-regression: when only the UNSCOPED fallbacks are denied (prefixed name not found), nothing is recorded", () => {
  // Healthy prefix-scoped role, param genuinely absent: prefixed → ParameterNotFound,
  // unscoped → AccessDenied. Everything is skippable → undefined (cacheable miss). OK.
  const candidates = candidateParameterNames("OPTIONAL_THING", "/chapterflow/prod", {});
  let lastError: unknown;
  for (const candidate of candidates) {
    const err = candidate.prefixScoped
      ? awsError("ParameterNotFound")
      : awsError("AccessDeniedException");
    if (classifySsmCandidateError(err, candidate.prefixScoped) === "skip") continue;
    lastError = err;
  }
  assert.equal(lastError, undefined, "an honest absence must not record an error");
});
