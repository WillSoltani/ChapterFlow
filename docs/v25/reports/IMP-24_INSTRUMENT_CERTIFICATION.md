# IMP-24 Instrument Certification

Status: **CERTIFIED_MODEL_FREE**

Experiment: `s16-forward-role-qualification-v3-envelope`
Certification binding: `ff4e1242fef13998196dbcba6ba92b3263fae44a36628d68fac88f9ded8b46b5`
Production instrument seal: `ca93638dd9594e0f0463fd03d7b2a67acf5b751c94548e778bdba5b1be17b310`
Production/qualification parity: `b710a85d0865a7903da1719ab6fd9b67cf1eb437ece20d2b66bbafb27f149959`
Corpus bundle: `sha256:4501809686161a541ad776bdbfea9c716ec402d89ef397a072f93143ce28fcac`
Corpus audit agreement: `sha256:3e3b582d440f4d22ce1c177136831b5f6c9bee096e9f9e51cbefd9f987ed4269`

## Model-free checks

- Compiled cases: 116 (reader 32, source 42, quiz 42).
- Canary cases are separate from the 30/40/40 holdouts.
- Every exact envelope is inline, hash-valid, and reference-resolvable.
- Every deterministic fixture passes strict V2 parsing and conductor assembly.
- Missing required source evidence deterministically yields INCONCLUSIVE.
- V1 and V2 evidence is preserved, closed, and cannot satisfy V3 freshness.
- Production and qualification bind the same shared envelope compiler and V2 assemblers.
- Frozen candidate order: `b688f64ae66f211b2c62270a79157d997bd4dee269dcacd969f7cd9741b44190`.
- Frozen 464-entry schedule: `56dfe414639ead6330478adbf4eb4c996e47e40a4de7df9d5ee720dce84a4bcd`.
- Frozen 464/928 call budget: `6251236d264e79f38b2d418d82d3448ac0aabfca805f2d213c439e480c87ccb5`.
- Model calls: 0. API calls: 0.

This certificate authorizes no live call by itself. The exact implementation must still be committed, pushed, and pass the dedicated V25 CI gate before the first V3 canary.
