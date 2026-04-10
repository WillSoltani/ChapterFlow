Scenario tone policy

If `scenarioTonePolicy = required`:
- every `examples[].scenario` must be a tone object
- every `examples[].whatToDo` must be a tone object
- every `examples[].whyItMatters` must be a tone object

Tone behavior inside scenarios:
- gentle: lower resistance, warmer framing, softer entry
- direct: clearest mechanics and decision line
- competitive: sharper stakes and consequence

Hard fail:
- any scenario is a plain string
- any two scenario tone variants are identical
- tone variants differ only by one adjective swap
