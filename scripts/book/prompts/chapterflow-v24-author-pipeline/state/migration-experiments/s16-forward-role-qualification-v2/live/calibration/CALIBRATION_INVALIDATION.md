# Corrected v2 calibration invalidation

Decision: `BLOCKED_CALIBRATION_INVALID`

The one permitted corrected calibration run completed its 24-case frozen schedule with 25 ChatGPT-authenticated Codex invocations, including one allowed provider-capacity replay. It made zero API calls and did not start holdout.

The sealed result is invalid for all three roles:

- Reader: 6 / 6 completed outputs were protocol-valid but 0 / 6 had valid exact evidence spans.
- Source: 8 / 10 completed outputs were protocol-valid and 3 / 10 had valid exact evidence spans.
- Quiz: 0 / 8 completed outputs were protocol-valid.

No calibration attestation may be written. No holdout, role freeze, pilot, gold, or local activation may run. The prompt permits no further corrected calibration identity or rerun.

See `calibration-seal.json` for every retained evaluation and `call-ledger.json` plus `attempts/` and `exec/logs/` for complete call, route, output, and receipt evidence.
