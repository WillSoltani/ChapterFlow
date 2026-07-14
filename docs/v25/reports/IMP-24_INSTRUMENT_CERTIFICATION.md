# IMP-24 Instrument Certification

Status: **CERTIFIED_MODEL_FREE**

Experiment: `s16-forward-role-qualification-v3-envelope`
Certification binding: `5fdfd2ef484e53c3b374a779c9307b1b847ff694318290f41b6f0686a928e191`
Production instrument seal: `8b17efb09704f86edc64193a45a789fc4de72696dc70440af6fef825cef4ab63`
Production/qualification parity: `075d4e0ca149a88ca4867832d65b2eb40afc2eb6f6b330975dea58655465c546`
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
- Frozen 464-entry schedule: `dd7c3c1235c86cbbaf20c954398bcb57880efd5c7629f95bc494cb4d0fa8e22c`.
- Frozen 464/928 call budget: `6251236d264e79f38b2d418d82d3448ac0aabfca805f2d213c439e480c87ccb5`.
- Model calls: 0. API calls: 0.

This certificate authorizes no live call by itself. The exact implementation must still be committed, pushed, and pass the dedicated V25 CI gate before the first V3 canary.
