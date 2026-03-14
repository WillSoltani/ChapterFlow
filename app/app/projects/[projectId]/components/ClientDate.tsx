"use client";

import { useEffect, useState } from "react";

function formatRelative(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "—";
    const diffMs = now - then;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const timeStr = new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 0) return `Today at ${timeStr}`;
    if (diffDays === 1) return `Yesterday at ${timeStr}`;
    return `${diffDays} days ago at ${timeStr}`;
  } catch {
    return "—";
  }
}

export function ClientDate({ iso }: { iso: string }) {
  const [text, setText] = useState<string>("—");
  useEffect(() => {
    setText(formatRelative(iso));
  }, [iso]);
  return <span>{text}</span>;
}
