const popularBooks = [
  { title: "Atomic Habits", gradient: "linear-gradient(135deg, #D97706, #B45309)" },
  { title: "Deep Work", gradient: "linear-gradient(135deg, #2563EB, #1E40AF)" },
  { title: "Thinking Fast and Slow", gradient: "linear-gradient(135deg, #0D9488, #0F766E)" },
  { title: "The 48 Laws of Power", gradient: "linear-gradient(135deg, #7C3AED, #6D28D9)" },
  { title: "Never Split the Difference", gradient: "linear-gradient(135deg, #DC2626, #B91C1C)" },
];

export function PopularBooksRow() {
  return (
    <div className="mt-8">
      <p
        className="text-[12px] font-semibold uppercase text-center mb-3"
        style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
      >
        Popular right now
      </p>
      <div className="flex gap-3 justify-center overflow-x-auto hide-scrollbar px-4">
        {popularBooks.map((book) => (
          <a
            key={book.title}
            href="/auth/login?returnTo=%2Fbook"
            className="shrink-0 flex items-center justify-center rounded-md overflow-hidden transition-transform duration-200 hover:scale-105"
            style={{ width: 100, height: 140, background: book.gradient }}
          >
            <span className="text-white text-[7px] font-bold uppercase tracking-wider text-center px-2 leading-tight">
              {book.title}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
