import { useState, useCallback, useEffect } from "react";

interface UseSearchOptions {
  hotkey?: string; // e.g., 'cmd+k' or 'ctrl+k'
}

export function useSearch(options: UseSearchOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    if (!options.hotkey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Parse hotkey
      const parts = options.hotkey!.toLowerCase().split("+");
      const key = parts[parts.length - 1];
      const needsCmd = parts.includes("cmd") || parts.includes("ctrl");
      const needsShift = parts.includes("shift");
      const needsAlt = parts.includes("alt");

      if (
        e.key.toLowerCase() === key &&
        (!needsCmd || modKey) &&
        (!needsShift || e.shiftKey) &&
        (!needsAlt || e.altKey)
      ) {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options.hotkey, toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
