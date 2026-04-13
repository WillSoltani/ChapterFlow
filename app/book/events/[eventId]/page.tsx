import { EventDetailClient } from "./EventDetailClient";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props) {
  const { eventId } = await params;
  return { title: `Event — ${eventId} — ChapterFlow` };
}

export default async function EventDetailPage({ params }: Props) {
  const { eventId } = await params;
  return <EventDetailClient eventId={eventId} />;
}
