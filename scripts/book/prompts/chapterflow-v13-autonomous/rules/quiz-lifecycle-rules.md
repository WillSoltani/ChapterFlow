Quiz lifecycle

Chapter gate:
- default is `generate`
- chapter-gate artifact should contain a real chapter quiz unless explicitly deferred in manifest
- empty `questions` array is a fail in default mode

Release gate:
- full book must contain real quizzes for all chapters

Never treat a null or empty quiz as acceptable just because structure exists elsewhere.
