# Architecture

## Roles
- Director: orchestration only
- Writer: canonical prose only
- Editor: editorial tightening only
- Critic: prose gate only
- Structure worker: contentVariants / implementation / review cards / keyTakeawayCard
- Scenario worker: examples only
- Assembler: canonical chapter JSON assembly only
- Quiz worker: quiz only
- Validator: validation and local mechanical fixes only
- Patch/Repair: only flagged local fixes

## Memory model
- long-lived Director
- persistent run state on disk
- fresh worker session per stage
- chapter ticket reloaded from disk each chapter
