import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useTransition,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import Fuse, { type FuseResult } from "fuse.js";
import { Search, FileText, Hash, X, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import searchIndexData from "@/data/search-index.json";
import searchSuggestionsData from "@/data/search-suggestions.json";
import { SearchSuggestions } from "./search-suggestions";

type SearchDocument = {
  id: string;
  title: string;
  description?: string;
  content: string;
  headings: string[];
  path: string;
  section?: string;
  anchor?: string;
  parentTitle?: string;
};

type SearchResult = FuseResult<SearchDocument>;

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestionSelectedIndex, setSuggestionSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Initialize Fuse.js with search index
  const fuse = useMemo(() => {
    return new Fuse<SearchDocument>(searchIndexData as SearchDocument[], {
      keys: [
        { name: "title", weight: 0.4 },
        { name: "headings", weight: 0.3 },
        { name: "content", weight: 0.2 },
        { name: "description", weight: 0.1 },
      ],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      shouldSort: true,
    });
  }, []);

  // Debounce query
  useEffect(() => {
    // Show/hide suggestions based on query
    setShowSuggestions(query.length === 0);

    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150); // 150ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }

    startTransition(() => {
      const results = fuse.search(debouncedQuery).slice(0, 10);
      setSearchResults(results);
      setSelectedIndex(0);
    });
  }, [debouncedQuery, fuse]);

  // Calculate total suggestions for keyboard navigation
  const totalSuggestions = useMemo(() => {
    if (!showSuggestions) return 0;
    return (
      searchSuggestionsData.quickLinks.length +
      searchSuggestionsData.popular.length +
      searchSuggestionsData.api.length +
      searchSuggestionsData.concepts.length
    );
  }, [showSuggestions]);

  const handleSuggestionSelect = useCallback(
    async (suggestionQuery: string, path?: string) => {
      if (path) {
        // Direct navigation for quick links
        onClose();

        // Small delay to ensure modal is fully closed
        await new Promise((resolve) => setTimeout(resolve, 50));

        navigate({ to: path });
      } else {
        // Populate search query for other suggestions
        setQuery(suggestionQuery);
        setShowSuggestions(false);
        inputRef.current?.focus();
      }
    },
    [navigate, onClose]
  );

  const handleResultClick = useCallback(
    async (result: SearchResult) => {
      const { path } = result.item;

      // Close the modal first to prevent any interference
      onClose();

      // Small delay to ensure modal is fully closed
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Navigate to the document
      navigate({ to: path });
    },
    [navigate, onClose]
  );

  // Handle Escape key globally when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setSearchResults([]);
      setSelectedIndex(0);
      setSuggestionSelectedIndex(0);
      setShowSuggestions(true);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && searchResults.length > 0 && selectedIndex >= 0) {
      const container = resultsRef.current;
      const selectedElement = container.querySelector(
        `button[data-index="${selectedIndex}"]`
      ) as HTMLElement;

      if (selectedElement) {
        // Get the wrapper div that contains all results
        const wrapper = container.querySelector(".py-2") as HTMLElement;
        if (!wrapper) return;

        // Calculate element position relative to the wrapper (accounting for padding)
        const elementOffsetTop = selectedElement.offsetTop - wrapper.offsetTop;
        const elementHeight = selectedElement.offsetHeight;

        // Get container dimensions and scroll position
        const containerHeight = container.clientHeight;
        const scrollTop = container.scrollTop;

        // Calculate if element is in view
        const elementTop = elementOffsetTop;
        const elementBottom = elementTop + elementHeight;
        const visibleTop = scrollTop;
        const visibleBottom = scrollTop + containerHeight;

        // Scroll if element is not fully visible
        if (elementTop < visibleTop) {
          // Scroll up to show element at top with more padding to ensure full visibility
          container.scrollTop = Math.max(0, elementTop - 40);
        } else if (elementBottom > visibleBottom) {
          // Scroll down to show element at bottom with padding
          container.scrollTop = elementBottom - containerHeight + 20;
        }
      }
    }
  }, [selectedIndex, searchResults.length]);

  // Scroll selected suggestion into view
  useEffect(() => {
    if (
      suggestionsRef.current &&
      showSuggestions &&
      query.length === 0 &&
      suggestionSelectedIndex >= 0
    ) {
      const container = suggestionsRef.current;
      const selectedElement = container.querySelector(
        `button[data-suggestion-index="${suggestionSelectedIndex}"]`
      ) as HTMLElement;

      if (selectedElement) {
        // Get container dimensions and scroll position
        const containerHeight = container.clientHeight;
        const scrollTop = container.scrollTop;

        // Calculate element position
        const elementTop = selectedElement.offsetTop;
        const elementBottom = elementTop + selectedElement.offsetHeight;

        // Calculate visible area
        const visibleTop = scrollTop;
        const visibleBottom = scrollTop + containerHeight;

        // Scroll if element is not fully visible
        if (elementTop < visibleTop) {
          // Scroll up to show element at top with more padding to ensure full visibility
          container.scrollTop = Math.max(0, elementTop - 40);
        } else if (elementBottom > visibleBottom) {
          // Scroll down to show element at bottom with padding
          container.scrollTop = elementBottom - containerHeight + 20;
        }
      }
    }
  }, [suggestionSelectedIndex, showSuggestions, query.length]);

  const highlightMatch = (text: string) => {
    if (!query || query.length < 2) return text;

    // Get all search terms from the query
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    // Create a regex pattern that matches any of the search terms
    const pattern = searchTerms
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // Escape special chars
      .join("|");

    if (!pattern) return text;

    const regex = new RegExp(`(${pattern})`, "gi");

    // Split text by the pattern and rebuild with highlights
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          // Check if this part matches any search term (case-insensitive)
          const isMatch = searchTerms.some(
            (term) => part.toLowerCase() === term.toLowerCase()
          );

          if (isMatch) {
            return (
              <mark
                key={index}
                className="rounded-sm border-b-2 border-yellow-500/30 bg-yellow-300/70 px-0.5 font-semibold text-inherit"
                style={{
                  textDecorationSkipInk: "none",
                  WebkitBoxDecorationBreak: "clone",
                  boxDecorationBreak: "clone",
                }}
              >
                {part}
              </mark>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/30" onClick={onClose}>
      <div
        className="fixed inset-0 z-[310] w-full rounded-none border-2 border-black bg-white shadow-2xl md:inset-auto md:top-20 md:left-1/2 md:max-w-2xl md:-translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-black px-4 py-3 sm:px-6 sm:py-4">
          <Search className="h-5 w-5 text-gray-600" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Handle keyboard navigation directly on input
              if (showSuggestions && query.length === 0) {
                switch (e.key) {
                  case "ArrowDown":
                    e.preventDefault();
                    setSuggestionSelectedIndex((prev) =>
                      prev < totalSuggestions - 1 ? prev + 1 : 0
                    );
                    break;
                  case "ArrowUp":
                    e.preventDefault();
                    setSuggestionSelectedIndex((prev) =>
                      prev > 0 ? prev - 1 : totalSuggestions - 1
                    );
                    break;
                  case "Enter": {
                    e.preventDefault();
                    const allSuggestions = [
                      ...searchSuggestionsData.quickLinks,
                      ...searchSuggestionsData.popular,
                      ...searchSuggestionsData.api,
                      ...searchSuggestionsData.concepts,
                    ];
                    const selected = allSuggestions[suggestionSelectedIndex];
                    if (selected) {
                      handleSuggestionSelect(
                        selected.query,
                        "path" in selected
                          ? (selected.path as string)
                          : undefined
                      );
                    }
                    break;
                  }
                }
              } else if (searchResults.length > 0 && query.length >= 2) {
                switch (e.key) {
                  case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                      prev < searchResults.length - 1 ? prev + 1 : 0
                    );
                    break;
                  case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                      prev > 0 ? prev - 1 : searchResults.length - 1
                    );
                    break;
                  case "Enter":
                    e.preventDefault();
                    if (searchResults[selectedIndex]) {
                      handleResultClick(searchResults[selectedIndex]);
                    }
                    break;
                }
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 outline-none"
          />
          {isPending && query.length >= 2 && (
            <span className="text-xs text-gray-400">Searching...</span>
          )}
          <button
            onClick={onClose}
            className="rounded-none p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Suggestions or Search Results */}
        {showSuggestions && query.length === 0 ? (
          <div
            ref={suggestionsRef}
            className="max-h-[calc(100vh-200px)] overflow-y-auto md:max-h-[400px]"
          >
            <SearchSuggestions
              onSelectSuggestion={handleSuggestionSelect}
              selectedIndex={suggestionSelectedIndex}
              onUpdateSelectedIndex={setSuggestionSelectedIndex}
            />
          </div>
        ) : query.length >= 2 ? (
          <div
            ref={resultsRef}
            className="max-h-[calc(100vh-200px)] overflow-y-auto md:max-h-[400px]"
          >
            {searchResults.length > 0 ? (
              <div className="py-2">
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.item.id}-${index}`}
                    data-index={index}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FF572D]/10",
                      index === selectedIndex && "bg-[#FF572D]/20"
                    )}
                  >
                    <div className="mt-1">
                      {result.item.section === "API" ? (
                        <Hash className="h-4 w-4 text-gray-400" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {highlightMatch(result.item.title)}
                        </span>
                        {result.item.section && (
                          <span className="rounded-none border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {result.item.section}
                          </span>
                        )}
                      </div>
                      {result.item.parentTitle && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          in {result.item.parentTitle}
                        </p>
                      )}
                      {result.item.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                          {highlightMatch(result.item.description)}
                        </p>
                      )}
                      {result.item.content && query.length >= 2 && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                          {(() => {
                            // Extract a snippet around the first match
                            const content = result.item.content;
                            const searchTerm = query.toLowerCase();
                            const index = content
                              .toLowerCase()
                              .indexOf(searchTerm);

                            if (index === -1) {
                              // If no exact match, show beginning of content
                              return highlightMatch(
                                content.substring(0, 150) + "..."
                              );
                            }

                            // Show context around the match
                            const start = Math.max(0, index - 50);
                            const end = Math.min(
                              content.length,
                              index + searchTerm.length + 100
                            );
                            const snippet = content.substring(start, end);

                            return (
                              <>
                                {start > 0 && "..."}
                                {highlightMatch(snippet)}
                                {end < content.length && "..."}
                              </>
                            );
                          })()}
                        </p>
                      )}
                    </div>
                    {index === selectedIndex && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <CornerDownLeft className="h-3 w-3" />
                        <span>Enter</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                No results found for "{query}"
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        {query.length < 2 && (
          <div className="border-t border-black px-4 py-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="rounded-none border border-gray-300 bg-gray-100 px-1.5 py-0.5">
                    ↑
                  </kbd>
                  <kbd className="rounded-none border border-gray-300 bg-gray-100 px-1.5 py-0.5">
                    ↓
                  </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded-none border border-gray-300 bg-gray-100 px-1.5 py-0.5">
                    ↵
                  </kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded-none border border-gray-300 bg-gray-100 px-1.5 py-0.5">
                    Esc
                  </kbd>
                  Close
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
