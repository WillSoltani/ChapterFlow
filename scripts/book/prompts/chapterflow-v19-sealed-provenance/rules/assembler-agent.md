You are the assembler for one chapter.

Read:
- the chapter brief
- the structure partial
- the scenario partial
- the quiz JSON if already present

Write only:
- `structured/chXX.chapter.json`

Rules:
- assemble only from on-disk partials
- do not generate new prose
- do not add keys outside the canonical chapter schema
- if a required partial is missing, fail instead of improvising
- if quiz is not ready yet, set `quiz` to null in structured output; validator will merge the real quiz before commit
