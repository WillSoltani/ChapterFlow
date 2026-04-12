# Quality Memory

Chapter passes only if:
- critic score is at least 10/12
- no chapter-quality auto-fails
- no prose-audit auto-fails
- scenario tone objects are present and distinct
- quiz exists with real questions in generate mode
- source sidecar exists and matches the frozen source bundle

Auto-fail signals:
- invented or unsupported content
- generic chapter that could fit elsewhere
- hard depth collapsing into medium
- contamination phrases or source-splice leakage
- repeated sentence, repeated paragraph role, repeated ending beat, or repeated template tail
- plain-string scenario fields in flagship mode
- identical or near-identical tone variants
- generic implementation or recap surfaces

Paragraph-role ledger:
- anchor
- mechanism
- tension
- limit
- implication
- bridge

Operating rules:
- The brief is the factual truth.
- The outline preserves the chapter logic and threshold question.
- The edited draft is the prose truth for conversion.
- The converter adapts; it does not invent.
- Validator may fix mechanics directly but must escalate prose weakness to repair.
- Repair changes the minimum surface area needed.

Wave guard:
- Never continue past a chapter with a missing or malformed artifact.
- Seal hashes only after validation passes.
- Run artifact/quality checks between waves.
