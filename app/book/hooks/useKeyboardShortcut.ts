"use client";

import { useEffect } from "react";

type UseKeyboardShortcutOptions = {
  ignoreWhenTyping?: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    target.isContentEditable
  );
}

export function useKeyboardShortcut(
  key: string,
  callback: (event: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions = {}
) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== key) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (options.ignoreWhenTyping && isTypingTarget(event.target)) return;
      callback(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [callback, key, options.ignoreWhenTyping]);
}

