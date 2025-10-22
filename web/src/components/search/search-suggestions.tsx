import { FileText, Zap, Code, Lightbulb, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import searchSuggestions from "@/data/search-suggestions.json";

interface SearchSuggestionsProps {
  onSelectSuggestion: (query: string, path?: string) => void;
  selectedIndex?: number;
  onUpdateSelectedIndex?: (index: number) => void;
}

export function SearchSuggestions({
  onSelectSuggestion,
  selectedIndex = -1,
  onUpdateSelectedIndex,
}: SearchSuggestionsProps) {
  // Flatten all suggestions with their category for keyboard navigation
  const allSuggestions = [
    ...searchSuggestions.quickLinks.map((s) => ({
      ...s,
      category: "quickLinks",
    })),
    ...searchSuggestions.popular.map((s) => ({ ...s, category: "popular" })),
    ...searchSuggestions.api.map((s) => ({ ...s, category: "api" })),
    ...searchSuggestions.concepts.map((s) => ({ ...s, category: "concepts" })),
  ];

  const handleClick = (query: string, path?: string) => {
    if (path) {
      // Direct navigation for quick links
      onSelectSuggestion(query, path);
    } else {
      // Populate search for other suggestions
      onSelectSuggestion(query);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-3 text-xs font-medium text-gray-500">
        SUGGESTIONS{" "}
        {selectedIndex >= 0 &&
          `(${selectedIndex + 1}/${allSuggestions.length} selected)`}
      </div>

      {/* Quick Links */}
      {searchSuggestions.quickLinks.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-600">
            <FileText className="h-3 w-3" />
            <span className="font-medium">QUICK LINKS</span>
          </div>
          <div className="space-y-1">
            {searchSuggestions.quickLinks.map((suggestion, idx) => {
              const thisIndex = idx;
              const isSelected = thisIndex === selectedIndex;
              return (
                <button
                  key={suggestion.path}
                  data-suggestion-index={thisIndex}
                  onClick={() => handleClick(suggestion.query, suggestion.path)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-none border px-3 py-2 text-left transition-colors hover:bg-[#FF572D]/10",
                    isSelected
                      ? "border-[#FF572D] bg-[#FF572D]/20"
                      : "border-transparent"
                  )}
                  onMouseEnter={() => onUpdateSelectedIndex?.(thisIndex)}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {suggestion.label}
                    </div>
                    {suggestion.description && (
                      <div className="line-clamp-1 text-xs text-gray-500">
                        {suggestion.description}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Popular Searches */}
      {searchSuggestions.popular.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-600">
            <Zap className="h-3 w-3" />
            <span className="font-medium">POPULAR</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchSuggestions.popular.map((suggestion, idx) => {
              const thisIndex = searchSuggestions.quickLinks.length + idx;
              const isSelected = thisIndex === selectedIndex;
              return (
                <button
                  key={suggestion.query}
                  data-suggestion-index={thisIndex}
                  onClick={() => handleClick(suggestion.query)}
                  className={cn(
                    "rounded-none border px-3 py-1.5 text-sm transition-colors hover:bg-[#FF572D]/10",
                    isSelected
                      ? "border-[#FF572D] bg-[#FF572D]/20"
                      : "border-gray-300"
                  )}
                  onMouseEnter={() => onUpdateSelectedIndex?.(thisIndex)}
                >
                  {suggestion.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* API Methods */}
      {searchSuggestions.api.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-600">
            <Code className="h-3 w-3" />
            <span className="font-medium">API METHODS</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchSuggestions.api.map((suggestion, idx) => {
              const thisIndex =
                searchSuggestions.quickLinks.length +
                searchSuggestions.popular.length +
                idx;
              const isSelected = thisIndex === selectedIndex;
              return (
                <button
                  key={suggestion.query}
                  data-suggestion-index={thisIndex}
                  onClick={() => handleClick(suggestion.query)}
                  className={cn(
                    "rounded-none border px-3 py-1.5 font-mono text-sm text-gray-700 transition-colors hover:bg-[#FF572D]/10",
                    isSelected
                      ? "border-[#FF572D] bg-[#FF572D]/20"
                      : "border-gray-300 bg-gray-50"
                  )}
                  onMouseEnter={() => onUpdateSelectedIndex?.(thisIndex)}
                >
                  {suggestion.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Concepts */}
      {searchSuggestions.concepts.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-600">
            <Lightbulb className="h-3 w-3" />
            <span className="font-medium">KEY CONCEPTS</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchSuggestions.concepts.map((suggestion, idx) => {
              const thisIndex =
                searchSuggestions.quickLinks.length +
                searchSuggestions.popular.length +
                searchSuggestions.api.length +
                idx;
              const isSelected = thisIndex === selectedIndex;
              return (
                <button
                  key={suggestion.query}
                  data-suggestion-index={thisIndex}
                  onClick={() => handleClick(suggestion.query)}
                  className={cn(
                    "rounded-none border px-3 py-1.5 text-sm transition-colors hover:bg-[#FF572D]/10",
                    isSelected
                      ? "border-[#FF572D] bg-[#FF572D]/20"
                      : "border-gray-300"
                  )}
                  onMouseEnter={() => onUpdateSelectedIndex?.(thisIndex)}
                >
                  {suggestion.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
