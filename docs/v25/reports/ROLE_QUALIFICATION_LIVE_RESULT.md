# IMP-23 role qualification live result

Status: `NOT_RUN_BLOCKED_CALIBRATION_INVALID`

The corrected v2 calibration seal is invalid, so no calibration attestation was written and the frozen holdout was not started. No profile was qualified or disqualified from holdout evidence, and no role set exists.

- Qualification experiment: `s16-forward-role-qualification-v2`
- Calibration SHA-256: `f52c247feaeb67864e5dbcb3e2ac396ec359b01811bc11578f55c5a84ec5b9d5`
- Calibration valid: false
- Holdout started: false
- Holdout calls: 0
- Role set ready: false
- Reader primary / audit: null / null
- Source primary / adjudicator: null / null
- Quiz semantic adjudicator: null

This is the required IMP-23 stop outcome, not `BLOCKED_ROLE_SET_NOT_READY`; the workflow stopped one gate earlier at `BLOCKED_CALIBRATION_INVALID`.
