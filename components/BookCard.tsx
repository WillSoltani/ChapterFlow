"use client";

import { BookCover } from "@/app/book/components/BookCover";

interface BookCardProps {
  bookId: string;
  title: string;
  author: string;
  category: string;
  icon: string;
  coverImage?: string;
}

export function BookCard({ bookId, title, author, category, icon, coverImage }: BookCardProps) {
  return (
    <div className="flex flex-col w-[160px] flex-shrink-0 snap-start group">
      {/* Real book cover */}
      <BookCover
        bookId={bookId}
        title={title}
        icon={icon}
        coverImage={coverImage}
        className="w-[160px] h-[220px] rounded-lg border border-(--border-subtle)"
        imageClassName="object-cover"
        sizes="160px"
        interactive={false}
      />

      {/* Metadata */}
      <p className="text-[14px] font-semibold text-(--text-heading) mt-2.5 truncate">
        {title}
      </p>
      <p className="text-[12px] text-(--text-muted) mt-0.5 truncate">
        {author}
      </p>
      <span className="mt-1.5 inline-block text-[11px] text-(--text-secondary) border border-(--border-subtle) px-2.5 py-0.5 rounded-full self-start">
        {category}
      </span>
    </div>
  );
}
