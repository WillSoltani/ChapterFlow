
# Post-Pipeline Integration

Core generation ends when:
- all chapter tickets are committed
- release package is assembled
- release guard passes

Optional repo integration can happen afterward.

Default safe action:
- copy `release/{bookId}.modern.json` to `book-packages/{bookId}.modern.json`

Cover generation is out of scope by default.
