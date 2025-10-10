import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useTransition,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  FileText,
  Hash,
  X,
  CornerDownLeft,
  Clock,
  Filter,
  TrendingUp,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import searchIndexData from "@/data/search-index.json";
import searchSuggestionsData from "@/data/search-suggestions.json";
import { SearchSuggestions } from "./search-suggestions";
import { SearchService, type SearchResult } from "@/lib/search-service";
import { contentTypes } from "@/lib/search-config";

interface EnhancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnhancedSearchModal({
  isOpen,
  onClose,
}: EnhancedSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestionSelectedIndex, setSuggestionSelectedIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showAdvancedHelp, setShowAdvancedHelp] = useState(false);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Initialize search service
  const searchService = useMemo(() => {
    return new SearchService(
      searchIndexData as Array<{
        id: string;
        title: string;
        description?: string;
        content: string;
        headings: string[];
        path: string;
        section?: string;
        type?: string;
        keywords?: string[];
        lastModified?: string;
        popularity?: number;
        anchor?: string;
        parentTitle?: string;
      }>
    );
  }, []);

  // Load recent searches
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(searchService.getRecentSearches());
    }
  }, [isOpen, searchService]);

  // Perform search
  useEffect(() => {
    const performSearch = () => {
      if (query.length < 2) {
        setSearchResults([]);
        setSelectedIndex(0);
        return;
      }

      startTransition(() => {
        const results = searchService.search(query, {
          type: selectedFilter,
          limit: 20,
        });
        setSearchResults(results);
        setSelectedIndex(0);
      });
    };

    // Debounce search
    const timer = setTimeout(performSearch, 150);
    return () => clearTimeout(timer);
  }, [query, selectedFilter, searchService]);

  // Show/hide suggestions based on query
  useEffect(() => {
    setShowSuggestions(query.length === 0);
  }, [query]);

  // Calculate total suggestions for keyboard navigation
  const totalSuggestions = useMemo(() => {
    if (!showSuggestions) return 0;
    return (
      searchSuggestionsData.quickLinks.length +
      searchSuggestionsData.popular.length +
      searchSuggestionsData.api.length +
      searchSuggestionsData.concepts.length +
      recentSearches.length
    );
  }, [showSuggestions, recentSearches]);

  const handleSuggestionSelect = useCallback(
    async (suggestionQuery: string, path?: string) => {
      if (path) {
        // Direct navigation for quick links
        searchService.trackResultClick(path);
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
    [navigate, onClose, searchService]
  );

  const handleResultClick = useCallback(
    async (result: SearchResult) => {
      const { path, id } = result.item;

      // Track click
      searchService.trackResultClick(id);

      // Close the modal first
      onClose();

      // Small delay to ensure modal is fully closed
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Navigate to the document
      navigate({ to: path });
    },
    [navigate, onClose, searchService]
  );

  const handleRecentSearchClick = useCallback((search: string) => {
    setQuery(search);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const clearRecentSearches = useCallback(() => {
    localStorage.removeItem("volcano-recent-searches");
    setRecentSearches([]);
  }, []);

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
      setSelectedFilter("all");
      setShowFilters(false);
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
          // Scroll up to show element at top with padding
          container.scrollTop = elementTop - 10;
        } else if (elementBottom > visibleBottom) {
          // Scroll down to show element at bottom with padding
          container.scrollTop = elementBottom - containerHeight + 10;
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

      // Account for recent searches when looking for suggestions
      const adjustedIndex = suggestionSelectedIndex - recentSearches.length;
      if (adjustedIndex >= 0) {
        const selectedElement = container.querySelector(
          `button[data-suggestion-index="${adjustedIndex}"]`
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
    }
  }, [
    suggestionSelectedIndex,
    showSuggestions,
    query.length,
    recentSearches.length,
  ]);

  const highlightText = (text: string) => {
    if (!query || query.length < 2 || !text) return text;

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

  const getIconForType = (type?: string, section?: string) => {
    const typeOrSection = type || section || "";
    if (typeOrSection.toLowerCase().includes("api")) {
      return <Hash className="h-4 w-4 text-gray-400" />;
    }
    if (typeOrSection.toLowerCase().includes("blog")) {
      return <TrendingUp className="h-4 w-4 text-gray-400" />;
    }
    if (typeOrSection.toLowerCase().includes("example")) {
      return <Code className="h-4 w-4 text-gray-400" />;
    }
    return <FileText className="h-4 w-4 text-gray-400" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/30" onClick={onClose}>
      <div
        className="fixed top-20 left-1/2 z-[310] w-full max-w-3xl -translate-x-1/2 rounded-none border-2 border-black bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input with Filters */}
        <div>
          <div className="flex items-center gap-3 border-b border-black px-4 py-3 sm:px-6 sm:py-4">
            <Search className="h-5 w-5 text-gray-600" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search documentation, blog posts, examples..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Handle keyboard navigation
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
                    case "Enter":
                      e.preventDefault();
                      // Handle enter for suggestions
                      break;
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
                // Toggle filters with Ctrl/Cmd + F
                if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  setShowFilters(!showFilters);
                }
              }}
              className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 outline-none"
            />
            {isPending && query.length >= 2 && (
              <span className="text-xs text-gray-400">Searching...</span>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "rounded-none border p-1.5 transition-colors",
                showFilters
                  ? "border-gray-400 bg-gray-100"
                  : "border-transparent hover:bg-gray-100"
              )}
              title="Filter results (Ctrl+F)"
            >
              <Filter className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="rounded-none p-1 hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Filter Bar */}
          {showFilters && (
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2">
              <span className="text-xs text-gray-500">Filter:</span>
              {Object.entries(contentTypes).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedFilter(key)}
                  className={cn(
                    "rounded-none border px-2 py-1 text-xs transition-colors",
                    selectedFilter === key
                      ? "border-[#FF572D] bg-[#FF572D] text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Suggestions, Recent Searches, or Search Results */}
        {showSuggestions && query.length === 0 ? (
          <div ref={suggestionsRef} className="max-h-[450px] overflow-y-auto">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>Recent searches</span>
                  </div>
                  <button
                    onClick={clearRecentSearches}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.slice(0, 5).map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentSearchClick(search)}
                      className="rounded-none border border-gray-300 bg-gray-100 px-2 py-1 text-xs transition-colors hover:bg-gray-200"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            <SearchSuggestions
              onSelectSuggestion={handleSuggestionSelect}
              selectedIndex={suggestionSelectedIndex - recentSearches.length}
              onUpdateSelectedIndex={(index) =>
                setSuggestionSelectedIndex(index + recentSearches.length)
              }
            />
          </div>
        ) : query.length >= 2 ? (
          <div ref={resultsRef} className="max-h-[450px] overflow-y-auto">
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
                      {getIconForType(result.item.type, result.item.section)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {highlightText(result.item.title)}
                        </span>
                        {result.item.type && (
                          <span className="rounded-none border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {result.item.type}
                          </span>
                        )}
                        {result.adjustedScore && result.adjustedScore < 0.1 && (
                          <span className="rounded-none bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                            Best match
                          </span>
                        )}
                      </div>
                      {result.item.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                          {highlightText(result.item.description)}
                        </p>
                      )}
                      {result.item.content && query.length >= 2 && (
                        <div className="mt-1 line-clamp-2 text-sm text-gray-500">
                          {(() => {
                            // Extract a snippet around the first match
                            const content = result.item.content;
                            const searchTerms = query
                              .toLowerCase()
                              .split(/\s+/)
                              .filter((term) => term.length > 0);

                            // Find the first matching term in content
                            let firstMatchIndex = -1;
                            let matchedTerm = "";
                            for (const term of searchTerms) {
                              const index = content
                                .toLowerCase()
                                .indexOf(term.toLowerCase());
                              if (
                                index !== -1 &&
                                (firstMatchIndex === -1 ||
                                  index < firstMatchIndex)
                              ) {
                                firstMatchIndex = index;
                                matchedTerm = term;
                              }
                            }

                            if (firstMatchIndex === -1) {
                              // If no exact match, show beginning of content
                              const snippet = content.substring(0, 150);
                              return (
                                <>
                                  {highlightText(snippet)}
                                  {content.length > 150 && "..."}
                                </>
                              );
                            }

                            // Show context around the match
                            const contextBefore = 50;
                            const contextAfter = 100;
                            const start = Math.max(
                              0,
                              firstMatchIndex - contextBefore
                            );
                            const end = Math.min(
                              content.length,
                              firstMatchIndex +
                                matchedTerm.length +
                                contextAfter
                            );
                            const snippet = content.substring(start, end);

                            return (
                              <>
                                {start > 0 && "..."}
                                {highlightText(snippet)}
                                {end < content.length && "..."}
                              </>
                            );
                          })()}
                        </div>
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
              <div className="px-4 py-8 text-center">
                <p className="mb-4 text-gray-500">
                  No results found for "{query}"
                </p>
                <p className="text-sm text-gray-400">
                  Try using different keywords or check the spelling
                </p>
                {!showAdvancedHelp && (
                  <button
                    onClick={() => setShowAdvancedHelp(true)}
                    className="mt-3 text-sm text-[#FF572D] hover:underline"
                  >
                    Show search tips
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Advanced Search Help */}
        {showAdvancedHelp && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-gray-700">
              Search Tips:
            </p>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>
                • Use <code className="border bg-white px-1">"quotes"</code> for
                exact phrases
              </li>
              <li>
                • Prefix with <code className="border bg-white px-1">-</code> to
                exclude terms
              </li>
              <li>
                • Prefix with <code className="border bg-white px-1">+</code> to
                require terms
              </li>
              <li>• Use filters to narrow down results by type</li>
            </ul>
          </div>
        )}

        {/* Footer */}
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
                  ⌘F
                </kbd>
                Filter
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded-none border border-gray-300 bg-gray-100 px-1.5 py-0.5">
                  Esc
                </kbd>
                Close
              </span>
            </div>
            {searchResults.length > 0 && query.length >= 2 && (
              <span>{searchResults.length} results</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
