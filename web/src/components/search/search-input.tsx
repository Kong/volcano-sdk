import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { SearchModal } from "./search-modal";

export function SearchInput() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsSearchOpen(true)}
        className="flex w-full items-center gap-2 rounded-none px-3 py-3 text-sm transition-all hover:bg-[#FF572D]/10"
        aria-label="Search documentation"
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden items-center gap-0.5 px-1.5 py-0.5 text-xs sm:inline-flex">
          {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}K
        </kbd>
      </button>

      {isSearchOpen &&
        createPortal(
          <SearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
          />,
          document.body
        )}
    </>
  );
}
