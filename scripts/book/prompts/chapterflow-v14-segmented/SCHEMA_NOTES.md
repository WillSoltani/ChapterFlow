# Schema notes

## Core principle
The public shipping contract may remain flagship_v4_compatible while the internal concept budget stays smaller and research-native.

## Important distinctions
- easy is intentionally lean
- medium uses singular selfCheckPrompt
- hard uses selfCheckPrompts as an array of 2 tone objects
- examples[].scenario, whatToDo, and whyItMatters are tone objects when scenarioTonePolicy = required
- chapter gate and release gate are different validation modes
- core pipeline end state is the final validated book JSON package, not repo wiring

## Reading time
Compute readingTimeMinutes from the final reader-facing word count, then round reasonably.
Do not guess.
