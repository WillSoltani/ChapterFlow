# Book Cover Uploads

Drop book cover images in this folder to override emoji placeholders across the Book Accelerator UI.

## Naming rule
Use the exact `bookId` filename, with one of these extensions:

- `.svg`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.avif`

Examples:

- `crucial-conversations.svg`
- `deep-work.png`
- `the-power-of-habit.jpg`
- `zero-to-one.webp`

## Where covers are used
These covers are automatically used in:

- onboarding book cards
- home dashboard cards
- library cards
- book detail overview

If no cover file is found, the UI falls back to the existing emoji icon.

## Optional explicit path
If you want a non-standard filename, set `coverImage` in:

- `app/book/data/booksCatalog.ts`

Example:

```ts
{
  id: "crucial-conversations",
  coverImage: "/book-covers/crucial-conversations-special-edition.png",
  // ...
}
```
