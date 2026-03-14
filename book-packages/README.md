# Book Packages

Put JSON book packages in this folder for ingestion uploads.

Included sample:
- `friends-and-influence-student-edition.student.json`

Upload this package with:

```bash
node scripts/book/upload-book-package.mjs \
  --origin https://your-app-domain \
  --token "<COGNITO_ID_TOKEN>" \
  --file book-packages/friends-and-influence-student-edition.student.json \
  --publish
```

See full guide:
- `docs/BOOKAPP_ADMIN_GUIDE.md`
