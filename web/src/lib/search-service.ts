import Fuse from "fuse.js";
import type { FuseResult } from "fuse.js";
import {
  searchConfig,
  expandQueryWithSynonyms,
  parseSearchQuery,
  scoreBoosts,
  searchLimits,
} from "./search-config";

export interface SearchDocument {
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
}

export interface SearchResult extends FuseResult<SearchDocument> {
  adjustedScore?: number;
  highlights?: {
    title?: string;
    description?: string;
    content?: string;
  };
}

// Cache for search results
const searchCache = new Map<
  string,
  {
    results: SearchResult[];
    timestamp: number;
  }
>();

// Recent searches (stored in localStorage)
const RECENT_SEARCHES_KEY = "volcano-recent-searches";
const MAX_RECENT_SEARCHES = 10;

export class SearchService {
  private fuse: Fuse<SearchDocument>;
  private popularityScores: Map<string, number> = new Map();

  constructor(documents: SearchDocument[]) {
    this.fuse = new Fuse(documents, searchConfig);
    this.loadPopularityScores();
  }

  /**
   * Perform an enhanced search with caching, synonyms, and advanced scoring
   */
  search(
    query: string,
    options?: {
      type?: string;
      limit?: number;
      useCache?: boolean;
    }
  ): SearchResult[] {
    const {
      type = "all",
      limit = searchLimits.expanded,
      useCache = true,
    } = options || {};

    // Check cache first
    const cacheKey = `${query}-${type}-${limit}`;
    if (useCache) {
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < searchLimits.cache) {
        return cached.results;
      }
    }

    // Parse advanced query
    const parsedQuery = parseSearchQuery(query);

    // Expand query with synonyms
    const expandedQueries = expandQueryWithSynonyms(parsedQuery.main);

    // Perform searches
    const allResults: SearchResult[] = [];

    for (const expandedQuery of expandedQueries) {
      const results = this.fuse.search(expandedQuery, {
        limit: searchLimits.max,
      });
      allResults.push(...results);
    }

    // Remove duplicates and filter by type
    const uniqueResults = this.deduplicateResults(allResults);
    const filteredResults = this.filterByType(uniqueResults, type);

    // Apply advanced filtering (exact, include, exclude)
    const advancedFiltered = this.applyAdvancedFilters(
      filteredResults,
      parsedQuery
    );

    // Adjust scores based on various factors
    const scoredResults = this.adjustScores(advancedFiltered, query);

    // Sort by adjusted score
    scoredResults.sort(
      (a, b) => (a.adjustedScore || 0) - (b.adjustedScore || 0)
    );

    // Limit results
    const limitedResults = scoredResults.slice(0, limit);

    // Add highlights
    const highlightedResults = this.addHighlights(limitedResults, query);

    // Cache results
    if (useCache) {
      searchCache.set(cacheKey, {
        results: highlightedResults,
        timestamp: Date.now(),
      });
    }

    // Save to recent searches
    this.saveRecentSearch(query);

    return highlightedResults;
  }

  /**
   * Get recent searches from localStorage
   */
  getRecentSearches(): string[] {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    searchCache.clear();
  }

  /**
   * Track click on search result to improve popularity scoring
   */
  trackResultClick(documentId: string): void {
    const current = this.popularityScores.get(documentId) || 0;
    this.popularityScores.set(documentId, current + 1);
    this.savePopularityScores();
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      if (seen.has(result.item.id)) {
        return false;
      }
      seen.add(result.item.id);
      return true;
    });
  }

  private filterByType(results: SearchResult[], type: string): SearchResult[] {
    if (type === "all") return results;

    return results.filter((result) => {
      const docType = result.item.type || result.item.section || "docs";
      return docType.toLowerCase() === type.toLowerCase();
    });
  }

  private applyAdvancedFilters(
    results: SearchResult[],
    parsed: ReturnType<typeof parseSearchQuery>
  ): SearchResult[] {
    return results.filter((result) => {
      const text =
        `${result.item.title} ${result.item.description || ""} ${result.item.content}`.toLowerCase();

      // Check exact phrases
      for (const exact of parsed.exact) {
        if (!text.includes(exact.toLowerCase())) {
          return false;
        }
      }

      // Check required inclusions
      for (const include of parsed.include) {
        if (!text.includes(include.toLowerCase())) {
          return false;
        }
      }

      // Check exclusions
      for (const exclude of parsed.exclude) {
        if (text.includes(exclude.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }

  private adjustScores(
    results: SearchResult[],
    originalQuery: string
  ): SearchResult[] {
    const query = originalQuery.toLowerCase();

    return results.map((result) => {
      let adjustedScore = result.score || 0;

      // Exact match boost
      if (result.item.title.toLowerCase() === query) {
        adjustedScore *= scoreBoosts.exactMatch;
      }

      // Title match boost
      if (result.item.title.toLowerCase().includes(query)) {
        adjustedScore *= scoreBoosts.titleMatch;
      }

      // Heading match boost
      if (result.item.headings.some((h) => h.toLowerCase().includes(query))) {
        adjustedScore *= scoreBoosts.headingMatch;
      }

      // Recency boost (if lastModified is available)
      if (result.item.lastModified) {
        const daysSinceModified =
          (Date.now() - new Date(result.item.lastModified).getTime()) /
          (1000 * 60 * 60 * 24);
        if (daysSinceModified < 30) {
          adjustedScore *= scoreBoosts.recentContent;
        }
      }

      // Popularity boost
      const popularity = this.popularityScores.get(result.item.id) || 0;
      if (popularity > 0) {
        adjustedScore *= 1 + popularity * 0.01; // Small boost based on popularity
      }

      return {
        ...result,
        adjustedScore,
      };
    });
  }

  private addHighlights(
    results: SearchResult[],
    query: string
  ): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    return results.map((result) => {
      const highlights: SearchResult["highlights"] = {};

      // Highlight title
      if (result.item.title) {
        highlights.title = this.highlightText(result.item.title, queryWords);
      }

      // Highlight description
      if (result.item.description) {
        highlights.description = this.highlightText(
          result.item.description,
          queryWords
        );
      }

      // Highlight content snippet
      if (result.item.content) {
        const snippet = this.extractSnippet(result.item.content, queryWords);
        highlights.content = this.highlightText(snippet, queryWords);
      }

      return {
        ...result,
        highlights,
      };
    });
  }

  private highlightText(text: string, queryWords: string[]): string {
    let highlighted = text;

    for (const word of queryWords) {
      if (word.length < 2) continue;

      const regex = new RegExp(`(${word})`, "gi");
      highlighted = highlighted.replace(regex, "<mark>$1</mark>");
    }

    return highlighted;
  }

  private extractSnippet(
    content: string,
    queryWords: string[],
    maxLength: number = 150
  ): string {
    const contentLower = content.toLowerCase();

    // Find the best position to start the snippet
    let bestPosition = 0;
    let maxMatches = 0;

    for (let i = 0; i < content.length - maxLength; i += 10) {
      const snippet = contentLower.substring(i, i + maxLength);
      const matches = queryWords.filter((word) =>
        snippet.includes(word)
      ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestPosition = i;
      }
    }

    // Extract snippet with ellipsis
    const snippet = content.substring(bestPosition, bestPosition + maxLength);
    const trimmed = snippet.trim();

    if (bestPosition > 0) {
      return "..." + trimmed + "...";
    }

    return trimmed + "...";
  }

  private saveRecentSearch(query: string): void {
    try {
      const recent = this.getRecentSearches();

      // Remove if already exists
      const filtered = recent.filter((q) => q !== query);

      // Add to beginning
      filtered.unshift(query);

      // Limit to max
      const limited = filtered.slice(0, MAX_RECENT_SEARCHES);

      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(limited));
    } catch {
      // Ignore localStorage errors
    }
  }

  private loadPopularityScores(): void {
    try {
      const stored = localStorage.getItem("volcano-search-popularity");
      if (stored) {
        const scores = JSON.parse(stored);
        this.popularityScores = new Map(Object.entries(scores));
      }
    } catch {
      // Ignore errors
    }
  }

  private savePopularityScores(): void {
    try {
      const scores = Object.fromEntries(this.popularityScores);
      localStorage.setItem("volcano-search-popularity", JSON.stringify(scores));
    } catch {
      // Ignore errors
    }
  }
}
