import type { IFuseOptions } from "fuse.js";

// Document type for search - must match SearchDocument in search-service.ts
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

// Synonym mappings for common terms
export const searchSynonyms: Record<string, string[]> = {
  component: ["widget", "element", "ui", "control"],
  api: ["endpoint", "interface", "method", "function"],
  guide: ["tutorial", "how-to", "walkthrough", "instructions"],
  setup: ["installation", "install", "config", "configuration"],
  auth: ["authentication", "authorization", "login", "security"],
  db: ["database", "storage", "data"],
  deploy: ["deployment", "publish", "release", "ship"],
  dev: ["development", "developer", "develop"],
  docs: ["documentation", "documents", "reference"],
  env: ["environment", "variables", "settings"],
  error: ["bug", "issue", "problem", "exception"],
  perf: ["performance", "speed", "optimization", "fast"],
  test: ["testing", "tests", "unit", "integration", "e2e"],
  ui: ["interface", "frontend", "design", "layout"],
  ux: ["experience", "usability", "user experience"],
};

// Search configuration with improved fuzzy matching
export const searchConfig: IFuseOptions<SearchDocument> = {
  keys: [
    { name: "title", weight: 0.45 }, // Increased weight for titles
    { name: "headings", weight: 0.25 }, // Headings are important
    { name: "description", weight: 0.15 }, // Descriptions provide context
    { name: "content", weight: 0.1 }, // Content for broader matches
    { name: "keywords", weight: 0.05 }, // Additional keywords
  ],
  threshold: 0.25, // Lower threshold for better fuzzy matching
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  shouldSort: true,
  findAllMatches: false, // Stop after finding a good match
  location: 0, // Start searching from beginning
  distance: 100, // How far from location to search
  useExtendedSearch: true, // Enable advanced search operators
  ignoreLocation: false,
  ignoreFieldNorm: false,
  fieldNormWeight: 1,
  // Fuzzy matching configuration
  getFn: (
    obj: SearchDocument,
    path: string | string[]
  ): string | readonly string[] => {
    const pathArray = typeof path === "string" ? [path] : path;
    const value = pathArray.reduce<unknown>(
      (currentObj: unknown, key: string) => {
        if (currentObj && typeof currentObj === "object" && key in currentObj) {
          return (currentObj as Record<string, unknown>)[key];
        }
        return undefined;
      },
      obj
    );
    if (typeof value === "string") {
      // Normalize text for better matching
      return value
        .toLowerCase()
        .replace(/[^\w\s]/g, " ") // Replace special chars with spaces
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();
    }
    if (Array.isArray(value)) {
      return value.map((v) => String(v));
    }
    return "";
  },
};

// Search operators for advanced queries
export const searchOperators = {
  exact: '"', // "exact phrase"
  exclude: "-", // -exclude
  include: "+", // +include
  wildcard: "*", // wild*
  fuzzy: "~", // fuzzy~
};

// Result scoring adjustments
export const scoreBoosts = {
  exactMatch: 2.0, // Boost for exact matches
  titleMatch: 1.5, // Boost for title matches
  headingMatch: 1.3, // Boost for heading matches
  recentContent: 1.2, // Boost for recently updated content
  popularContent: 1.1, // Boost for frequently accessed content
};

// Search result limits
export const searchLimits = {
  instant: 5, // Results shown instantly
  expanded: 20, // Results shown on "show more"
  max: 50, // Maximum results to process
  debounce: 150, // Debounce time in ms
  cache: 300000, // Cache duration in ms (5 minutes)
};

// Content type filters
export const contentTypes = {
  all: "All",
  docs: "Documentation",
  api: "API Reference",
  guides: "Guides",
  examples: "Examples",
  blog: "Blog Posts",
  changelog: "Changelog",
};

// Helper function to expand query with synonyms
export function expandQueryWithSynonyms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/);
  const expandedQueries = [query];

  for (const word of words) {
    // Check if word has synonyms
    for (const [key, synonyms] of Object.entries(searchSynonyms)) {
      if (key === word || synonyms.includes(word)) {
        // Add variations with synonyms
        const allTerms = [key, ...synonyms];
        for (const term of allTerms) {
          if (term !== word) {
            const expanded = query.toLowerCase().replace(word, term);
            if (!expandedQueries.includes(expanded)) {
              expandedQueries.push(expanded);
            }
          }
        }
      }
    }
  }

  return expandedQueries;
}

// Helper function to parse advanced search queries
export function parseSearchQuery(query: string): {
  main: string;
  exact: string[];
  exclude: string[];
  include: string[];
} {
  const exact: string[] = [];
  const exclude: string[] = [];
  const include: string[] = [];

  // Extract exact phrases
  let processed = query.replace(/"([^"]+)"/g, (_, phrase) => {
    exact.push(phrase);
    return "";
  });

  // Extract exclusions
  processed = processed.replace(/\s-(\S+)/g, (_, term) => {
    exclude.push(term);
    return "";
  });

  // Extract required inclusions
  processed = processed.replace(/\s\+(\S+)/g, (_, term) => {
    include.push(term);
    return "";
  });

  return {
    main: processed.trim(),
    exact,
    exclude,
    include,
  };
}
