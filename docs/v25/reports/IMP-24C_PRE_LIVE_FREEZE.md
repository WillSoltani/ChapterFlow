# IMP-24C pre-live freeze

Status: **FROZEN_MODEL_FREE_PRE_LIVE**

Experiment: `s16-forward-role-qualification-v3-envelope-r1`
Freeze SHA-256: `0155f4753c92cdabf66d975c95eda9e69c212367c4485769ead1b6ed06b56aa9`
Certification SHA-256: `cd3c6450337a3c29be5812c52608f9805cb50606d8de066c6ac1e8f94ca2bc4f`
Production seal SHA-256: `22bda57b70062160cc560adb46b9ab32b2ba316c901898727cafba10faaabab5`
Schedule SHA-256: `dd7c3c1235c86cbbaf20c954398bcb57880efd5c7629f95bc494cb4d0fa8e22c`

## Frozen state

- First live call occurred: false.
- Prompts, schemas, gold, thresholds, candidate order, and cases are frozen.
- Live calls: 0. API calls: 0.
- Implementation and evidence commit identities are truthfully null until Git creates them.
- The terminal implementation report is excluded and cannot be overwritten by this freeze.

## Artifact inventory

| Artifact | Bytes SHA-256 |
| --- | --- |
| `.github/workflows/chapterflow-v25-pipeline.yml` | `00f3c0a33c43fe01073c271e66374e70b87de18edd79e78ad496478ab834523b` |
| `docs/v25/reports/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.json` | `41ec1c8c1159a857bedd96af5d307694c81047f82d742ab759d5578a5a92e8a1` |
| `docs/v25/reports/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.md` | `84c9bfd8c88e313f669b2fafb95c08852e42824c34134118aec00fe93ca4bb78` |
| `docs/v25/reports/IMP-24C_CONTROL_PLANE_CORRECTION.md` | `dd327eed37c22b84e4b9de207134e0b4257024a5df5623e7ef439becf20805e3` |
| `docs/v25/reports/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.json` | `7f5dfba38f8f8b5ca95a3c432af0f7f31dc0c29acbc5c8cb9197dd24b3dc0ac6` |
| `docs/v25/reports/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.md` | `4a9c8dae957460003fa966520a7b10c792692f190a3a1474f9f96b8592e34666` |
| `docs/v25/reports/IMP-24C_PRE_LIVE_RUNBOOK.md` | `848ab61b53e781dbae524f9e96d16c52057b975525074f2b232b1f7229971083` |
| `docs/v25/reports/IMP-24C_PROTOCOL_NOTE.md` | `bb6e7fa3abd9577a7d0fb7d5fa66f3fad21268e79c1286dabfedbca97e55134a` |
| `docs/v25/reports/IMP-24_INSTRUMENT_CERTIFICATION.json` | `b598be114ca6dceeefe2d4fb7c43913c569e17069fe2a069335491f3b376e280` |
| `docs/v25/reports/IMP-24_INSTRUMENT_CERTIFICATION.md` | `bea6620cd6db15e36addf5fddac4804afb55de8ef12ba99874d5420e9ed41f74` |
| `docs/v25/reports/IMP-24_PROTOCOL_DECISION.md` | `f18912b7f291ad5c22fed76d773404c2ee81a896e800ee2e320243d4ccfc0620` |
| `docs/v25/reports/implementation-report.imp-24.pre-live.json` | `7cde3f57fc246e9a323a7ba7d1501cb47f9ef9cf74c6164965d8cb0e571191a2` |
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
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/forward-production-instrument-seal.json` | `59270d3e58945cd68365d820935520255c67f5aff6191979ac9e1f61c4556e25` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/instrument-certification-binding.json` | `2c3f6c9598c8abd0deba71e6e0a94e0a846bfcb6912611e0df08e43af88c3984` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/legacy-v1-v2-evidence-closure.json` | `7d46c42b9855bf6c4284c5ba490c178f987a351136577406d48a6d4ef58fb878` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/production-qualification-parity-reference.json` | `b61d40aa4deceeaccdff8aed3e65359be627d653bb33568f03a26dddfd72b3dd` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/production-qualification-parity.json` | `11079ddeb11d5fe8173b7471156e887172bd0644086cf9e5423fc379146506e5` |
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
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-r1/execution-spec.json` | `1396924c5f18134531ec8999365dab44258cc340a799497086f3f89f9772ff76` |

This freeze authorizes no model call by itself. The exact implementation commit must be pushed, pass dedicated V25 CI, and reconcile from a clean checkout before the zero-call live preflight.
