# Ticket Spec

Each chapter gets one primary ticket:

`RUN_ROOT/tickets/chXX.ticket.md`

The Director rewrites this file before the chapter starts and never reuses a stale ticket.

## Required sections

- Ticket ID
- Book metadata
- Chapter number and title
- Wave number
- Source sidecar path
- Source richness tier
- Concept budget
- Required anchors
- Allowed quotes / near-quotes
- Common misreadings
- Limits / moral complexity
- Previous / next chapter bridge
- Assigned example map
- Assigned names
- Assigned school setting
- Banned names
- Banned opener patterns
- Vocabulary watchlist
- Grade-band targets
- Hard-edge requirement
- Scenario lesson map
- Acceptance checks
- Output paths

## Work orders

From each ticket, the Director writes one work order per worker:

- `work-orders/chXX.research.md`
- `work-orders/chXX.writer.md`
- `work-orders/chXX.editor.md`
- `work-orders/chXX.critic.md`
- `work-orders/chXX.converter.md`
- `work-orders/chXX.quiz.md`
- `work-orders/chXX.validator.md`
- `work-orders/chXX.patch.md`

Every work order must include:
- role
- exact input files
- exact output files
- allowed scope
- forbidden actions
- done criteria

The worker should be able to complete its job by reading only:
- the work order
- the listed files
