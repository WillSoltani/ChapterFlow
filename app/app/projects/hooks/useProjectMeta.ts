"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FileRow, ProjectMeta, ProjectRow } from "../_lib/types";
import { getIsoOrFallback, isFileRow } from "../_lib/ui";

export function useProjectMeta(projects: ProjectRow[]) {
  const [meta, setMeta] = useState<Record<string, ProjectMeta>>({});
  const runId = useRef(0);

  // Only refetch when the set of projectIds changes (or if you want, include updatedAt).
  const projectKey = useMemo(() => {
    return projects.map((p) => p.projectId).sort().join("|");
  }, [projects]);

  useEffect(() => {
    const myRun = ++runId.current;

    async function run() {
      if (projects.length === 0) {
        setMeta({});
        return;
      }

      const results = await Promise.all(
        projects.map(async (p) => {
          try {
            const res = await fetch(
              `/app/api/projects/${encodeURIComponent(p.projectId)}/files`,
              { cache: "no-store" }
            );

            if (!res.ok) {
              return { projectId: p.projectId, fileCount: 0, latestActivityAt: p.updatedAt };
            }

            const data = (await res.json()) as { files?: unknown };
            const filesUnknown = Array.isArray(data.files) ? data.files : [];
            const files = filesUnknown.filter(isFileRow) as FileRow[];

            let latest = p.updatedAt;
            for (const f of files) {
              const candidate = getIsoOrFallback(f.updatedAt, f.createdAt);
              if (candidate > latest) latest = candidate;
            }

            return { projectId: p.projectId, fileCount: files.length, latestActivityAt: latest };
          } catch {
            return { projectId: p.projectId, fileCount: 0, latestActivityAt: p.updatedAt };
          }
        })
      );

      // Ignore stale runs
      if (runId.current !== myRun) return;

      const next: Record<string, ProjectMeta> = {};
      for (const r of results) {
        next[r.projectId] = { fileCount: r.fileCount, latestActivityAt: r.latestActivityAt };
      }
      setMeta(next);
    }

    void run();
  }, [projectKey, projects]);

  return meta;
}
