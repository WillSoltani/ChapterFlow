import type { Project } from "@/types/project";
import { bookAccelerator } from "./book-accelerator";

export const projects: Project[] = [bookAccelerator];

// Optional safety check (catches duplicates + empty)
(function assertProjects(list: Project[]) {
  if (list.length === 0) throw new Error("No projects exported from content/projects");
  const seen = new Set<string>();
  for (const p of list) {
    if (!p.slug) throw new Error("Project missing slug");
    if (seen.has(p.slug)) throw new Error(`Duplicate project slug: ${p.slug}`);
    seen.add(p.slug);
  }
})(projects);
