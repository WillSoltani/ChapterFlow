# Troubleshooting

## Symptom: The run asks for too much upfront

Cause:
- manifest is underfilled or launch prompt not used

Fix:
- use `launch.sh` and paste only `launch-prompt.txt`
- keep edition selection mode at `ask_if_ambiguous`

## Symptom: The agent asks for a source file

Cause:
- old prompt pack or stale prompt starter

Fix:
- confirm `PACK_ROOT` points to `chapterflow-v13-autonomous`
- confirm the launch prompt says `sourceDiscoveryMode = web_bundle`
- confirm `sourceFreezeRequired = true`

## Symptom: Chapter 1 is strong, later chapters collapse

Cause:
- bulk generation path
- chapter loop bypass
- release built from regenerated objects
- source contamination or tone collapse

Fix:
- run `tools/chapterflow_v13_artifact_guard.py`
- confirm no script is authoring content
- confirm later chapters still show a full artifact trail
- confirm release is assembled from validated chapters only

## Symptom: The agent keeps asking edition questions

Cause:
- edition ambiguity rules are too sensitive

Fix:
- set `editionSelectionMode = auto_if_clear`
- keep user question only when translation materially changes structure or interpretation

## Symptom: Full text is not available online

Cause:
- the book is copyrighted or poorly digitized

Fix:
- let the run build a source bundle from authorized previews + TOC + reputable secondary sources
- keep quote policy paraphrase-first
- narrow the chapter claims to supported evidence only

## Symptom: The run continues but later quality drops

Cause:
- baseline floor not enforced tightly enough

Fix:
- lower `qualityDecayStopDelta`
- route morally dense or thin-source chapters as solo waves
- reroute weak waves through premium critic / editor passes
