# Quality Memory — compact

## Writer / editor floor
- Every paragraph needs one primary role: anchor, mechanism, tension, limit, implication, or bridge.
- Once a paragraph lands its claim, do not reland it in a new paragraph.
- Use fewer anchors rather than fake-rich anchors if support is thin.
- The chapter must feel unmistakably like this book-level section, not generic creativity advice.

## Converter floor
- Easy: 140-175 words per tone, exactly 3 point-only takeaways, flat recap.
- Medium: 330-420 words per tone, 5-6 takeaways with distinct `moreDetails`, activation prompt, singular `selfCheckPrompt`, recap with `retrieve/connect/preview`.
- Hard: 490-600 words per tone, 5-7 takeaways with genuinely new `moreDetails`, activation prompt, exactly 2 `selfCheckPrompts`, prediction prompt, recap with `retrieve/connect/preview`.
- Six examples exactly once across the six canonical formats, with 2 work / 2 school / 2 personal and unique ending types.
- Five review cards with 2 easy / 2 medium / 1 hard.
- No tone collapse, no plain-string scenarios, no review-card echo of the key takeaway card.

## Validator / gate floor
- Critic score must be at least 10/12.
- Empty quiz is an auto-fail in generate mode.
- Review wrapper must contain the full validated chapter JSON, not a partial wrapper.
- Run prose audit before passing chapter gate.
- If prose quality is weak, reroute or repair. Do not silently flatten it into a pass.
