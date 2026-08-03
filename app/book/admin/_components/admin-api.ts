"use client";

import { fetchBookJson } from "@/app/book/_lib/book-api";

export function adminGet<T>(path: string): Promise<T> {
  return fetchBookJson<T>(`/app/api/book/admin${path}`);
}

export function adminPost<T>(path: string, body?: unknown): Promise<T> {
  return fetchBookJson<T>(`/app/api/book/admin${path}`, {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
