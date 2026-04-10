# Calibration Lock Rules

Chapters 1 and 2 are calibration chapters.

After both are committed, write:
`state/calibration-lock.json`

This file must capture:
- acceptable voice distance
- acceptable hook quality
- acceptable scenario vividness
- acceptable tone divergence
- banned contamination phrases
- chapter-quality floor signals
- allowed variation band for later chapters

Later chapters are compared against this lock.
If a later chapter becomes more templated or more contaminated than the lock allows, fail the artifact guard.
