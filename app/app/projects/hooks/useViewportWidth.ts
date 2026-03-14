"use client";

import { useEffect, useState } from "react";

export function useViewportWidth() {
  const [viewportW, setViewportW] = useState(0);

  useEffect(() => {
    const update = () => setViewportW(window.innerWidth);
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return viewportW;
}
