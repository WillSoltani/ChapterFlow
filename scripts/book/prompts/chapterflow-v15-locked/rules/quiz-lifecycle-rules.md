# Quiz Lifecycle Rules

Default:
- generate the quiz during each chapter's structure loop
- do not leave `quiz.questions` empty

If the manifest explicitly says `chapterGateQuizMode = defer`:
- quiz blueprint must still be complete
- validator must mark quiz deferred explicitly
- release gate must ensure the quiz is generated before final package completion

In the default path, empty quiz arrays are a fail.
