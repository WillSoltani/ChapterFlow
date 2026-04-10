Chapter review package wrapper

The review wrapper must contain:
- schemaVersion
- packageId
- createdAt
- contentOwner
- full `book` object
- `chapters` array containing exactly one chapter

Purpose:
- chapter review should happen against a real wrapper, not a loose chapter blob
