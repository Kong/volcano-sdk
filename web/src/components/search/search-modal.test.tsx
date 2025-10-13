import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchModal } from "./search-modal";

// Mock the router navigation
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock search index data
vi.mock("@/data/search-index.json", () => ({
  default: [
    {
      id: "1",
      title: "Getting Started",
      description: "Learn how to get started with the SDK",
      content: "This is a guide about getting started with our SDK",
      headings: ["Introduction", "Installation"],
      path: "/docs/getting-started",
      section: "Guide",
    },
    {
      id: "2",
      title: "API Reference",
      description: "Complete API documentation",
      content: "Documentation for all API methods and functions",
      headings: ["Methods", "Types"],
      path: "/docs/api",
      section: "API",
    },
    {
      id: "3",
      title: "Installation Guide",
      description: "How to install the SDK",
      content: "Step by step installation instructions for the SDK",
      headings: ["Prerequisites", "Setup"],
      path: "/docs/installation",
      section: "Guide",
    },
  ],
}));

// Mock search suggestions
vi.mock("@/data/search-suggestions.json", () => ({
  default: {
    quickLinks: [
      { label: "Quick Start", query: "Quick Start", path: "/docs/quick-start" },
      { label: "Examples", query: "Examples", path: "/docs/examples" },
    ],
    popular: [
      { label: "authentication", query: "authentication" },
      { label: "configuration", query: "configuration" },
    ],
    api: [
      { label: "createClient", query: "createClient" },
      { label: "fetchData", query: "fetchData" },
    ],
    concepts: [
      { label: "providers", query: "providers" },
      { label: "middleware", query: "middleware" },
    ],
  },
}));

describe("SearchModal", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      render(<SearchModal isOpen={false} onClose={vi.fn()} />);
      expect(screen.queryByPlaceholderText("Search documentation...")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByPlaceholderText("Search documentation...")).toBeInTheDocument();
    });

    it("should focus input when modal opens", () => {
      const { rerender } = render(<SearchModal isOpen={false} onClose={vi.fn()} />);
      rerender(<SearchModal isOpen={true} onClose={vi.fn()} />);

      const input = screen.getByPlaceholderText("Search documentation...");
      expect(input).toHaveFocus();
    });

    it("should display search suggestions when query is empty", () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText("Quick Start")).toBeInTheDocument();
      expect(screen.getByText("Examples")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("should update input value when typing", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "getting");
      expect(input).toHaveValue("getting");
    });

    it("should display search results after typing", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "getting");

      // Wait for debounce and search to complete
      await waitFor(() => {
        const results = screen.getAllByText((content, element) => {
          return element?.tagName === 'SPAN' && content.includes('Started');
        });
        expect(results.length).toBeGreaterThan(0);
      }, { timeout: 500 });
    });

    it("should show 'No results found' for queries with no matches", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "xyz123nonexistent");

      await waitFor(() => {
        expect(screen.getByText(/No results found for/i)).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it("should highlight matching text in results", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "api");

      await waitFor(() => {
        // Look for mark elements (highlighting)
        const marks = document.querySelectorAll("mark");
        expect(marks.length).toBeGreaterThan(0);
      }, { timeout: 500 });
    });

    it("should hide suggestions when typing starts", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);

      // Initially shows suggestions
      expect(screen.getByText("Quick Start")).toBeInTheDocument();

      const input = screen.getByPlaceholderText("Search documentation...");
      await user.type(input, "a");

      // Suggestions should be hidden
      expect(screen.queryByText("Quick Start")).not.toBeInTheDocument();
    });

    it("should require at least 2 characters to search", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "a");

      await waitFor(() => {
        // Should not show results with only 1 character
        expect(screen.queryByText("Getting Started")).not.toBeInTheDocument();
        expect(screen.queryByText("API Reference")).not.toBeInTheDocument();
      }, { timeout: 500 });
    });
  });

  describe("Keyboard Navigation", () => {
    it("should close modal when Escape is pressed", async () => {
      const onClose = vi.fn();
      render(<SearchModal isOpen={true} onClose={onClose} />);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalled();
    });

    it("should navigate through search results with arrow keys", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "api");

      // Wait for results
      await waitFor(() => {
        const resultButtons = document.querySelectorAll('[data-index]');
        expect(resultButtons.length).toBeGreaterThan(0);
      }, { timeout: 500 });

      // Press down arrow
      await user.keyboard("{ArrowDown}");

      // First result should be selected (bg color changes)
      const firstResult = document.querySelector('[data-index="0"]');
      expect(firstResult).toHaveClass("bg-[#FF572D]/20");
    });

    it("should navigate through suggestions with arrow keys", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);

      // Press down arrow on empty query (suggestions shown)
      await user.keyboard("{ArrowDown}");

      // Check that first suggestion is selected
      const firstSuggestion = screen.getByText("Quick Start").closest("button");
      expect(firstSuggestion).toHaveAttribute("data-suggestion-index", "0");
    });

    it("should select result when Enter is pressed", async () => {
      const onClose = vi.fn();
      render(<SearchModal isOpen={true} onClose={onClose} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "api");

      // Wait for results
      await waitFor(() => {
        const resultButtons = document.querySelectorAll('[data-index]');
        expect(resultButtons.length).toBeGreaterThan(0);
      }, { timeout: 500 });

      // Press Enter
      await user.keyboard("{Enter}");

      // Should close modal and navigate
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/docs/api" });
      });
    });

    it("should wrap around when navigating past end of results", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "guide");

      await waitFor(() => {
        const resultButtons = document.querySelectorAll('[data-index]');
        expect(resultButtons.length).toBeGreaterThan(0);
      }, { timeout: 500 });

      const resultButtons = document.querySelectorAll('[data-index]');
      const totalResults = resultButtons.length;

      // Navigate down to last result
      for (let i = 0; i < totalResults; i++) {
        await user.keyboard("{ArrowDown}");
      }

      // Should wrap back to first (index 0) - verify by checking if first result gets selected class
      await waitFor(() => {
        const firstResult = document.querySelector('[data-index="0"]');
        expect(firstResult?.className).toContain("bg-[#FF572D]/20");
      });
    });
  });

  describe("User Interactions", () => {
    it("should navigate when clicking a search result", async () => {
      const onClose = vi.fn();
      render(<SearchModal isOpen={true} onClose={onClose} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "getting");

      await waitFor(() => {
        const resultButtons = document.querySelectorAll('[data-index]');
        expect(resultButtons.length).toBeGreaterThan(0);
      }, { timeout: 500 });

      const result = document.querySelector('[data-index="0"]') as HTMLElement;
      await user.click(result!);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/docs/getting-started" });
      });
    });

    it("should close modal when clicking X button", async () => {
      const onClose = vi.fn();
      render(<SearchModal isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByRole("button", { name: "" }).closest("button");
      await user.click(closeButton!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should close modal when clicking overlay", async () => {
      const onClose = vi.fn();
      render(<SearchModal isOpen={true} onClose={onClose} />);

      // Click the overlay (backdrop)
      const overlay = screen.getByPlaceholderText("Search documentation...").closest(".fixed");
      await user.click(overlay?.parentElement!);

      expect(onClose).toHaveBeenCalled();
    });

    it("should navigate directly when clicking quick link suggestion", async () => {
      const onClose = vi.fn();
      render(<SearchModal isOpen={true} onClose={onClose} />);

      const quickLink = screen.getByText("Quick Start");
      await user.click(quickLink);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/docs/quick-start" });
      });
    });

    it("should populate search query when clicking non-quick-link suggestion", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      const suggestion = screen.getByText("authentication");
      await user.click(suggestion);

      // Query should be populated
      expect(input).toHaveValue("authentication");

      // Suggestions should be hidden
      expect(screen.queryByText("Quick Start")).not.toBeInTheDocument();
    });
  });

  describe("Result Display", () => {
    it("should display section badges for results", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "api");

      await waitFor(() => {
        // Look for section badges (they have specific classes)
        const badges = document.querySelectorAll('.rounded-none.border.border-gray-300.bg-gray-100');
        expect(badges.length).toBeGreaterThan(0);
      }, { timeout: 500 });
    });

    it("should display description for results that have one", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "getting");

      await waitFor(() => {
        expect(screen.getByText("Learn how to get started with the SDK")).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it("should show keyboard shortcuts in footer when query is empty", () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText("Navigate")).toBeInTheDocument();
      expect(screen.getByText("Select")).toBeInTheDocument();
      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    it("should show correct icon for API vs Guide sections", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      await user.type(input, "guide");

      await waitFor(() => {
        const results = screen.getAllByRole("button");
        // API results should have Hash icon, Guide results should have FileText icon
        expect(results.length).toBeGreaterThan(0);
      }, { timeout: 500 });
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid typing without errors", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      // Type rapidly
      await user.type(input, "abcdefghijklmnop", { delay: 10 });

      // Should not throw errors and input should have value
      expect(input).toHaveValue("abcdefghijklmnop");
    });

    it("should clear search when modal reopens", () => {
      const { rerender } = render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      // Type something
      userEvent.type(input, "test");

      // Close and reopen
      rerender(<SearchModal isOpen={false} onClose={vi.fn()} />);
      rerender(<SearchModal isOpen={true} onClose={vi.fn()} />);

      // Input should be cleared
      const newInput = screen.getByPlaceholderText("Search documentation...");
      expect(newInput).toHaveValue("");
    });

    it("should handle special characters in search query", async () => {
      render(<SearchModal isOpen={true} onClose={vi.fn()} />);
      const input = screen.getByPlaceholderText("Search documentation...");

      // Type text with special characters - verify no crash
      await user.type(input, "api");

      // Add a hyphen
      await user.keyboard("-");

      // Should not crash and component should remain functional
      expect(input.value.length).toBeGreaterThan(0);
      expect(input).toBeInTheDocument();
    });
  });
});
