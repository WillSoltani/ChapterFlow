# Chapter review artifact rules

Every chapter gate should write:
- validated/chXX.chapter.json
- validated/chXX.review-package.json
- reports/chXX.validation.md
- reports/chXX.critic.md
- sidecars/chXX.reading-metrics.json

The review package exists to make chapter review consistent even in autonomous mode.
It should contain book metadata and the single validated chapter packaged in reader-facing form.
