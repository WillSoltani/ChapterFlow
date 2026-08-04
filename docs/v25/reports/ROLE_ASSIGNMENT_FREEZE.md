# IMP-22 Role Assignment Freeze

**Recorded:** 2026-07-12  
**Status:** `NOT_CREATED_QUALIFICATION_INCOMPLETE`

The fixed-assignment builder and validation policy are implemented and tested, but no assignment artifact has been created because no live role qualification exists.

| Role | Frozen profile |
|---|---|
| Reader primary | Not selected |
| Reader audit | Not selected |
| Source primary | Not selected |
| Source adjudicator | Not selected |
| Quiz semantic adjudicator | Not selected |
| Deterministic quiz checker | Required by code; not a model role |

The future freeze is constrained to:

- one fixed profile per required role;
- reader bar exactly 80;
- output-independent reader audit subset;
- prompt, schema, route, thresholds, and model/effort hashes;
- source disagreement adjudication by the frozen source adjudicator;
- no candidate-order rotation and no model-family preference;
- explicit limitation evidence if the same exact profile must occupy related roles.

The central future author route is implemented as `gpt-5.6-sol@high`, with `gpt-5.6-sol@xhigh` only for the frozen high-risk classification. It remains dormant until qualification, pilot, and gold evidence all pass.

