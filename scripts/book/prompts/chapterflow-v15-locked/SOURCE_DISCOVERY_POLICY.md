# Source Discovery Policy

The pipeline is web-first.

The user does not need to provide a source folder.

## Source selection priority

1. official or authorized full text
2. public-domain full text
3. reliable edition scans / archives
4. publisher TOC + chapter headings + trusted summaries / reviews / excerpts
5. other reputable secondary sources only when full text is unavailable

## Auto-resolution
Auto-resolve edition or translation when:
- one version is clearly standard
- one version is clearly the public-domain source used by most citations
- differences do not materially change chapter boundaries or meaning for the learning contract

Ask once only when:
- multiple editions or translations have materially different chapter structure, wording, or framing
- and the difference cannot be resolved safely from source quality signals

## Required outputs
- `source-freeze/edition-lock.json`
- `source-freeze/source-ledger.json`
- `source-freeze/source-bundle/`
- `sidecars/source-heading-index.json`
- `sidecars/chXX.source.txt` or `.md` for each chapter

## Coverage policy
If the pipeline only has partial coverage:
- mark the chapter or book as partial in the source ledger
- narrow the brief and outline
- do not imitate certainty the source does not support

If the pipeline cannot reach enough reliable coverage to produce a non-invented chapter:
- treat that as a true blocker
- stop with a precise source-coverage report
