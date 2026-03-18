export function slugify(input: string, fallback = "untitled"): string {
  const s = (input || "").trim().toLowerCase();
  const cleaned = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}
