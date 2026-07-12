import { deriveAppleTestFlightSubjectHashes } from "../../app/app/api/book/_lib/apple-testflight-subject-hash-core";

const result = deriveAppleTestFlightSubjectHashes(
  process.env.APPLE_IAP_TESTFLIGHT_QA_USER_IDS,
);
if (!result.valid) {
  process.stderr.write("E_APPLE_IAP_TESTFLIGHT_ALLOWLIST_INVALID\n");
  process.exitCode = 1;
} else {
  process.stdout.write(result.hashes.join(","));
}
