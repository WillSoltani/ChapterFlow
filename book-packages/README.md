# Book Packages

Put JSON book packages in this folder for ingestion uploads.

Included sample:
- `crucial-conversations.modern.json`

Upload this package with:

```bash
node scripts/book/upload-book-package.mjs \
  --origin https://your-app-domain \
  --token "<COGNITO_ID_TOKEN>" \
  --file book-packages/crucial-conversations.modern.json \
  --publish
```

See full guide:
- `docs/BOOKAPP_ADMIN_GUIDE.md`
