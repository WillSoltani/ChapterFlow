import { BookDetailLoading } from "./components/BookDetailSkeleton";

/**
 * Route-level loading UI. Renders instantly while the server resolves the
 * book detail from DynamoDB + S3, so navigating from the library paints a
 * hero + chapter-row skeleton instead of blocking with no feedback. Shares
 * markup with the client hydration gate (BookDetailLoading) for one loading
 * language across cold load and hydration.
 */
export default function Loading() {
  return <BookDetailLoading />;
}
