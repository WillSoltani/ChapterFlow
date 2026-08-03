import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateParameterNames,
  classifySsmCandidateError,
  loadSsmParameterValue,
  type SsmCandidate,
  type SsmErrorDisposition,
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
  assert.equal(got[0]!.name, "/chapterflow/prod/SES_SENDER_EMAIL");
  assert.equal(got[0]!.prefixScoped, true);
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

test("REGRESSION (F7): AccessDenied on the PREFIX-SCOPED candidate is fail-fast, NOT skipped", () => {
  // The prefixed name is the one the IAM role is supposed to be able to read. A
  // denial there is a real misconfiguration (prefix typo, region/account
  // mismatch, KMS-decrypt denial) and MUST propagate immediately instead of
  // returning undefined → which would poison missingCache and leave SSM-only
  // config (VAPID_*, SES_SENDER_EMAIL) absent for the process lifetime.
  assert.equal(classifySsmCandidateError(awsError("AccessDeniedException"), true), "throw");
  assert.equal(classifySsmCandidateError(awsError("AccessDenied"), true), "throw");
});

test("AccessDenied is matched on Code and __type fields too, not just name", () => {
  assert.equal(classifySsmCandidateError({ Code: "AccessDenied" }, true), "throw");
  assert.equal(classifySsmCandidateError({ __type: "AccessDeniedException" }, true), "throw");
  assert.equal(classifySsmCandidateError({ Code: "AccessDenied" }, false), "skip");
});

test("a transient/credential error (e.g. throttling, network) is fail-fast on any candidate", () => {
  for (const prefixScoped of [true, false]) {
    assert.equal(
      classifySsmCandidateError(awsError("ThrottlingException"), prefixScoped),
      "throw",
      `ThrottlingException prefixScoped=${prefixScoped}`,
    );
    assert.equal(
      classifySsmCandidateError(awsError("TimeoutError"), prefixScoped),
      "throw",
    );
    assert.equal(
      classifySsmCandidateError(new Error("socket hang up"), prefixScoped),
      "throw",
    );
  }
});

test("a non-object error is fail-fast (never silently skipped)", () => {
  assert.equal(classifySsmCandidateError(null, true), "throw");
  assert.equal(classifySsmCandidateError("boom", false), "throw");
  assert.equal(classifySsmCandidateError(undefined, true), "throw");
});

// ─── End-to-end of the candidate walk: the F7 scenario ───────────────────────
//
// Exercise the classifier over the real candidate list to prove a prefixed
// AccessDenied is fail-fast rather than skipped to a bare-name fallback.

test("F7 classification: AccessDenied on the prefixed name is fail-fast", () => {
  const candidates = candidateParameterNames("VAPID_PUBLIC_KEY", "/chapterflow/prod", {});
  const accessDenied = awsError("AccessDeniedException");

  const prefixed = candidates.find((candidate) => candidate.prefixScoped);
  assert.ok(prefixed, "a prefixed candidate must exist");
  assert.equal(classifySsmCandidateError(accessDenied, true), "throw");
});

test("non-regression: a missing prefixed name plus denied UNSCOPED fallbacks is fully skippable", () => {
  // Healthy prefix-scoped role, param genuinely absent: prefixed → ParameterNotFound,
  // unscoped → AccessDenied. Everything is skippable → undefined (cacheable miss). OK.
  const candidates = candidateParameterNames("OPTIONAL_THING", "/chapterflow/prod", {});
  const dispositions: SsmErrorDisposition[] = [];
  for (const candidate of candidates) {
    const err = candidate.prefixScoped
      ? awsError("ParameterNotFound")
      : awsError("AccessDeniedException");
    dispositions.push(classifySsmCandidateError(err, candidate.prefixScoped));
  }
  assert.ok(dispositions.every((disposition) => disposition === "skip"));
});

test("runtime SSM resolution requests decryption and returns the first nonblank value", async () => {
  const requests: Array<{ name: string; withDecryption: true }> = [];
  const value = await loadSsmParameterValue(
    "AUTH_STATE_SECRET",
    "/chapterflow/prod",
    {},
    async (request) => {
      requests.push(request);
      return request.name.endsWith("/AUTH_STATE_SECRET")
        ? "synthetic-runtime-value"
        : undefined;
    },
  );

  assert.equal(value, "synthetic-runtime-value");
  assert.deepEqual(requests, [
    {
      name: "/chapterflow/prod/AUTH_STATE_SECRET",
      withDecryption: true,
    },
  ]);
});

test("missing and blank SSM values resolve as absent rather than becoming cached config", async () => {
  for (const returned of [undefined, "", "   "] as const) {
    const value = await loadSsmParameterValue(
      "BOOK_STRIPE_SECRET_KEY",
      "/chapterflow/prod",
      {},
      async () => returned,
    );
    assert.equal(value, undefined);
  }
});

test("prefix-scoped access denial and KMS decryption failure reject fail closed", async () => {
  for (const name of ["AccessDeniedException", "KMSInvalidStateException"] as const) {
    await assert.rejects(
      () =>
        loadSsmParameterValue(
          "ANTHROPIC_API_KEY",
          "/chapterflow/prod",
          {},
          async () => {
            throw Object.assign(new Error("nonsecret failure metadata"), { name });
          },
        ),
      (error: unknown) =>
        error instanceof Error &&
        (error.name === name || error.message === "nonsecret failure metadata"),
    );
  }
});

test("a prefix-scoped failure cannot fall through to an unscoped secret value", async () => {
  const requests: string[] = [];
  const scopedError = Object.assign(new Error("prefixed parameter denied"), {
    name: "AccessDeniedException",
  });

  await assert.rejects(
    () =>
      loadSsmParameterValue(
        "AUTH_STATE_SECRET",
        "/chapterflow/prod",
        {},
        async ({ name }) => {
          requests.push(name);
          if (name.startsWith("/chapterflow/prod/")) throw scopedError;
          return "wrong-environment-secret";
        },
      ),
    (error: unknown) => error === scopedError,
  );

  assert.deepEqual(requests, ["/chapterflow/prod/AUTH_STATE_SECRET"]);
});
