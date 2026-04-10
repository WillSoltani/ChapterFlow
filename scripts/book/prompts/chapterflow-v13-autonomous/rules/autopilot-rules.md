# Autopilot rules

v13 removes the human Chapter 1 approval pause.

## Required behavior
- Chapter 1 must pass the chapter gate automatically before continuation.
- Chapter 2 must also pass the chapter gate automatically.
- Chapters 1 and 2 become the baseline quality floor.
- Later chapters continue in waves without human pauses.

## Stop conditions
Stop only when:
- a true blocker remains after local patching and rerouting
- source discovery cannot produce a trustworthy enough bundle
- contamination or source-splice failures keep recurring
- quality decay exceeds the configured threshold and cannot be repaired locally

## What is still allowed
- internal chapter gate validation
- internal repair loops
- automatic rerouting to premium passes
- automatic halt on true blocker

## What is removed
- manual “approve Chapter 1 to continue” stop
- manual “approve Chapter 2 to continue” stop
