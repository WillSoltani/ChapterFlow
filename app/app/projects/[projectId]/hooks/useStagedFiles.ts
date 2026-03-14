"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StagedFile, StagedListItem } from "../_lib/local-types";
import { isSupportedUploadFile } from "@/app/app/_lib/conversion-support";
import { extFromName, fingerprintFile, fmtBytes, formatFromFilenameOrContentType } from "../_lib/format";

type PickFilesResult = {
  unsupportedFileNames: string[];
};

export function useStagedFiles() {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const stagedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const stagedUrls = stagedUrlsRef.current;
    return () => {
      for (const url of stagedUrls) URL.revokeObjectURL(url);
      stagedUrls.clear();
    };
  }, []);

  const onPickFiles = useCallback((list: FileList): PickFilesResult => {
    const incoming = Array.from(list);
    const unsupportedFileNames = incoming.filter((f) => !isSupportedUploadFile(f)).map((f) => f.name);
    const accepted = incoming.filter((f) => isSupportedUploadFile(f));

    setStaged((prev) => {
      const existing = new Set(prev.map((p) => p.fingerprint));
      const next = [...prev];

      for (const file of accepted) {
        const fp = fingerprintFile(file);
        if (existing.has(fp)) continue;
        existing.add(fp);

        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);
        stagedUrlsRef.current.add(previewUrl);

        next.push({
          id,
          file,
          previewUrl,
          fromLabel: formatFromFilenameOrContentType(file.name, file.type),
          sizeLabel: fmtBytes(file.size),
          fingerprint: fp,
        });
      }

      return next;
    });
    return { unsupportedFileNames };
  }, []);

  const removeStaged = useCallback((id: string) => {
    setStaged((prev) => {
      const keep: StagedFile[] = [];
      for (const f of prev) {
        if (f.id === id) {
          URL.revokeObjectURL(f.previewUrl);
          stagedUrlsRef.current.delete(f.previewUrl);
          continue;
        }
        keep.push(f);
      }
      return keep;
    });
  }, []);

  const stagedItems: StagedListItem[] = useMemo(
    () =>
      staged.map((s) => ({
        id: s.id,
        name: s.file.name,
        sizeLabel: s.sizeLabel,
        detectedType: s.fromLabel,
        extension: extFromName(s.file.name).toUpperCase() || "—",
      })),
    [staged]
  );

  const uploadDisabled = useMemo(() => staged.length === 0, [staged]);

  const consumeSelected = useCallback(() => {
    // Remove all staged items after a successful upload and revoke URLs.
    setStaged((prev) => {
      for (const f of prev) {
        URL.revokeObjectURL(f.previewUrl);
        stagedUrlsRef.current.delete(f.previewUrl);
      }
      return [];
    });
  }, []);

  const selectedFiles = useMemo(() => staged, [staged]);

  return {
    staged,
    stagedItems,
    uploadDisabled,
    selectedFiles,
    onPickFiles,
    removeStaged,
    consumeSelected,
  };
}
