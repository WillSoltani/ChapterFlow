"use client";

import { useEffect } from "react";

export function useEscapeClose(actions: {
  closeMenu: () => void;
  closeCreate: () => void;
}) {
  const { closeMenu, closeCreate } = actions;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        closeCreate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMenu, closeCreate]);
}
