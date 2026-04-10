# Quiz lifecycle rules

## Core rule
Core generation pipeline may end without product integration, but the chapter artifact used for chapter gate must still include a real quiz when chapterGateQuizMode = generate.

## Modes
- generate: create and validate the quiz during chapter generation
- defer: only allowed if the manifest explicitly sets defer and the validator records the defer state

## Default
For autonomous flagship runs, use generate.
An empty questions array is a hard failure in generate mode.
