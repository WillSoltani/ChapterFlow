"use client";

import { createContext, useContext, useState } from "react";

type FileCountCtxValue = {
  fileCount: number;
  setFileCount: (n: number) => void;
};

const FileCountCtx = createContext<FileCountCtxValue>({
  fileCount: 0,
  setFileCount: () => {},
});

export function FileCountProvider({
  initial,
  children,
}: {
  initial: number;
  children: React.ReactNode;
}) {
  const [fileCount, setFileCount] = useState(initial);
  return (
    <FileCountCtx.Provider value={{ fileCount, setFileCount }}>
      {children}
    </FileCountCtx.Provider>
  );
}

export function useFileCount() {
  return useContext(FileCountCtx).fileCount;
}

export function useSetFileCount() {
  return useContext(FileCountCtx).setFileCount;
}
