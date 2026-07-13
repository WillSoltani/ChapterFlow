# IMP-24B pre-live freeze

Status: **FROZEN_MODEL_FREE_PRE_LIVE**

Experiment: `s16-forward-role-qualification-v3-envelope`
Freeze SHA-256: `369b4f856fe633be554fe34ed9b5e3d02494c0437b83329f00e5df8423214c20`
Certification SHA-256: `b1661f217f93d3ed8e79c2ebbe788ef01c927d35b4c530d6d73b68a2fb42f815`
Production seal SHA-256: `9f2555252102d892f08af06270ae86c70ce90699b1068b04302b4797558d145a`
Schedule SHA-256: `dd7c3c1235c86cbbaf20c954398bcb57880efd5c7629f95bc494cb4d0fa8e22c`

## Frozen state

- First live call occurred: false.
- Prompts, schemas, gold, thresholds, candidate order, and cases are frozen.
- Live calls: 0. API calls: 0.
- Implementation and evidence commit identities are truthfully null until Git creates them.

## Artifact inventory

| Artifact | Bytes SHA-256 |
| --- | --- |
| `docs/v25/reports/IMP-24B_PRE_LIVE_RUNBOOK.md` | `fdb78df339f48f66c8461d22c1846f555b82e00b5561d0520968fb7c1841b89c` |
| `docs/v25/reports/IMP-24_INSTRUMENT_CERTIFICATION.json` | `02158c087e2dc1ec65d5613e98ccbae9f4f9be5c3f8b30ece78bf612a26711f0` |
| `docs/v25/reports/IMP-24_INSTRUMENT_CERTIFICATION.md` | `228d7074da45b5e1328a01b6dcdb8a6819f7eaeefed0bdc0d061cf2c4f2c0d41` |
| `docs/v25/reports/IMP-24_PROTOCOL_DECISION.md` | `f18912b7f291ad5c22fed76d773404c2ee81a896e800ee2e320243d4ccfc0620` |
| `docs/v25/reports/implementation-report.imp-24.json` | `3bcd14e6258391646666ab041611d5f35867dafd4e8a78d2409842ed8b0de2bd` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/src/contracts/contract-manifest.json` | `e1121e423ea11e310f11fa5215b71af81e4cab60ab75e5e26b93a61bf5737091` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/candidate-availability-policy.v3-envelope.json` | `03cd7f0be8e4781eb783a055367226c98fa498f077f84957a19e25c4a9d1b5db` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/candidate-order.v3-envelope.json` | `ed8a04676436f704c25190890439766ead6e6703f529de9029fc48ee5432db3a` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpora/quiz-canary.v3-envelope.json` | `acfb76b4768bcb1a883fdae7d5b611aae2163352b89245be40484ee379648f27` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpora/quiz-holdout.v3-envelope.json` | `dc19a7ef9ef9e530bee5b8b725121b1347cb6cd03372631db9a0273874035d6a` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpora/reader-canary.v3-envelope.json` | `2f72f211ea189b5337885bb5911c4a5f01d7c115f41e455a360a164e702940d5` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpora/reader-holdout.v3-envelope.json` | `ba91b02465421a38cc1c982680cba10d3882fb4263c72c39a1dc714c38b35420` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpora/source-canary.v3-envelope.json` | `30ecff7e8e28a67ff3d2bacb0c9ba1f7a1091d48468da6aabde4753d7e588b3d` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpora/source-holdout.v3-envelope.json` | `6c0fa7771e63cf1070f87201e66eb679a1b91d234c08b5587da7eb6af8eae253` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpus-audit-pass-a.v3-envelope.json` | `c42e2b42b5b378f1c885dcdfd84064510c940bf2c24727d78fb75a8aa5d8be13` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpus-audit-pass-b.v3-envelope.json` | `94f023c7997e77f036eba4031c6f9823a13d7a2b3a1e09c909469b5b3ccf2263` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/corpus-provenance.v3-envelope.json` | `dc1f1fd33ccfa71f2ca2ec963e6a96a35b694126c126e07abdaa6b11e1e1bc97` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/forward-production-instrument-seal.json` | `a60f31764707a3ffc633cd68459abfbf001ca4d66142ff0ff552ff9af8ec7fb5` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/instrument-certification-binding.json` | `2fa4dcaa61dcc1153d958b4a1c2e924cb45f54f245d5971f0e6ca97f63cac063` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/legacy-v1-v2-evidence-closure.json` | `7d46c42b9855bf6c4284c5ba490c178f987a351136577406d48a6d4ef58fb878` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/production-qualification-parity-reference.json` | `4a37e98af4ada00abfa318aee73ffa5d7cc9fedb563e5d370922f7e8042a6ea1` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/production-qualification-parity.json` | `6bb45d02f896e28b248e39fa259183cc11d2a34e8920145825b5e4bc32ac3c60` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/prompts/quiz-prompt-bundle.v3-envelope.json` | `c2e0347a4893c1350ddc70721e84dbd6809386dd71ef041e0c3517f31b22faaa` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/prompts/reader-prompt-bundle.v3-envelope.json` | `d3bebe3eacc444ab235b8484dd4283cd6c8f8ab08e14d1a1dd95e9f99da89807` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/prompts/source-prompt-bundle.v3-envelope.json` | `aaf2fdf41ee1c67e480f8322f3faf1c311232fcd42f1adaf4191428795460bc8` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/qualification-call-budget.v3-envelope.json` | `8ea5fc5aa5a5d454fa96c1712805ab025f898629dd927f18ac03d3be08185fe5` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/qualification-schedule.v3-envelope.json` | `a70eeb960cb044d3e525ab54e9fb76cfb0534493b11abbae3e2640f677c54545` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/role-qualification-corpus-bundle.v3-envelope.json` | `666b8b55e06336f254cb7a6e0c3dc140badedc32d0d0f203c3963fcbe24ff46a` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/role-thresholds.v3-envelope.json` | `f4d08d49eabad6cfdf04561cd38917494f07ed0974f80b59279591d32c5b36be` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/v2-output-schema-inventory.json` | `23f125489449e8f324ad3b4a6e23140894bde7c77bf21a55119a6582884e2069` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/schemas/quiz-integrity-model-output-v2.schema.json` | `f391c06c17237fec98eb1a8d92e2f4c84c9329e029b9b71fdd3276fa3a03e0f4` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/schemas/reader-experience-model-output-v2.schema.json` | `63694e08162e4a0fe13b0cc511cc2d9c516fd79b4e0f60cd779132e675e32df5` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/schemas/source-integrity-model-output-v2.schema.json` | `221e031c372e7c936cce204b7f9e224695102276ab5db0289a297a79bb014313` |

This freeze authorizes no model call by itself. The exact implementation commit must be pushed, pass dedicated V25 CI, and reconcile from a clean checkout before the zero-call live preflight.
