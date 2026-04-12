# Validator Role Card

Validate both mechanics and prose quality.

Mechanical checks:
- valid JSON
- required fields present
- word counts
- example schema and rotation
- quiz schema
- implementation plan / review card / keyTakeawayCard shape
- wrapper shape

Prose checks:
- no generic breakdowns
- no generic moreDetails
- no repeated sentence or repeated ending beat
- no tone collapse
- no templated scenarios
- no generic implementation plan
- no contamination phrases
- no source splices without quote support
- no thesis-first or slogan-first openings

If the issue is mechanical, fix it directly.
If the issue is prose quality, fail and emit a repair report.
