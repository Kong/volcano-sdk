import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { generatedNavigation } from "./navigation-generated";

interface TableOfContentsProps {
  className?: string;
}

export function TableOfContents({ className }: TableOfContentsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeId, setActiveId] = useState<string>("");
  const prevActiveIdRef = useRef<string>("");
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const isManualNavigationRef = useRef<boolean>(false);

  // Find the current doc's headings from pre-generated data
  const currentDoc = generatedNavigation.find(
    (doc) => doc.path === location.pathname
  );

  // Filter out sub-items (level 3+) under "Key Features"
  const allHeadings = currentDoc?.headings || [];
  const tocItems = allHeadings.filter((heading, index) => {
    // Find the "Key Features" section
    const keyFeaturesIndex = allHeadings.findIndex(
      (h) => h.id === "key-features"
    );

    if (keyFeaturesIndex === -1) return true; // No Key Features section, keep all

    // Find the next level 2 heading after Key Features
    const nextLevel2Index = allHeadings.findIndex(
      (h, i) => i > keyFeaturesIndex && h.level === 2
    );

    // If we're between Key Features and the next level 2 heading, and we're level 3+, filter out
    const isAfterKeyFeatures = index > keyFeaturesIndex;
    const isBeforeNextSection =
      nextLevel2Index === -1 || index < nextLevel2Index;
    const isSubItem = heading.level >= 3;

    if (isAfterKeyFeatures && isBeforeNextSection && isSubItem) {
      return false; // Filter out level 3+ items under Key Features
    }

    return true; // Keep everything else
  });

  // Update active ID based on URL hash
  useEffect(() => {
    const hash = location.hash?.replace("#", "") || "";
    if (hash) {
      setActiveId(hash);
    }
  }, [location]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (activeId && activeId !== prevActiveIdRef.current) {
      // Small delay to ensure DOM is ready
      const scrollTimeout = setTimeout(() => {
        const itemElement = itemRefs.current.get(activeId);
        const containerElement = navRef.current?.closest("aside");

        if (itemElement && containerElement) {
          const itemRect = itemElement.getBoundingClientRect();
          const containerRect = containerElement.getBoundingClientRect();

          // Calculate if item is out of view
          const itemTop =
            itemRect.top - containerRect.top + containerElement.scrollTop;
          const itemBottom = itemTop + itemRect.height;
          const visibleTop = containerElement.scrollTop;
          const visibleBottom = visibleTop + containerRect.height;

          // Only scroll if item is not fully visible
          if (itemTop < visibleTop || itemBottom > visibleBottom) {
            // Calculate the optimal scroll position to center the item
            const targetScroll =
              itemTop - containerRect.height / 2 + itemRect.height / 2;

            containerElement.scrollTo({
              top: Math.max(0, targetScroll),
              behavior: "smooth",
            });
          }
        }
      }, 100);

      // Update previous value
      prevActiveIdRef.current = activeId;

      // Cleanup timeout
      return () => clearTimeout(scrollTimeout);
    }
  }, [activeId]);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setActiveId(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Use Intersection Observer for scroll-based active highlighting
  useEffect(() => {
    if (tocItems.length === 0) return;

    const observerOptions = {
      rootMargin: "-20% 0% -80% 0%",
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Skip updates during manual navigation
          if (isManualNavigationRef.current) {
            return;
          }

          const id = entry.target.id;
          setActiveId(id);

          // Notify left sidebar of active heading change (no URL updates)
          window.dispatchEvent(
            new CustomEvent("docs-heading-active", {
              detail: { id },
            })
          );
        }
      });
    }, observerOptions);

    // Observe all headings
    tocItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [tocItems]);

  const scrollToHeading = async (id: string) => {
    // Set flag to ignore IntersectionObserver updates during manual navigation
    isManualNavigationRef.current = true;

    // Immediately set active ID for instant visual feedback
    setActiveId(id);

    // Navigate with hash using TanStack Router
    await navigate({
      to: location.pathname,
      hash: id,
    });

    // Scroll to element within the main scrollable container
    setTimeout(() => {
      const element = document.getElementById(id);
      // Find the scrollable main container (not the docs-content div)
      const contentDiv = document.getElementById("docs-content");
      const scrollContainer = contentDiv?.closest("main");

      if (element && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const relativeTop =
          elementRect.top - containerRect.top + scrollContainer.scrollTop;

        scrollContainer.scrollTo({
          top: relativeTop - 32,
          behavior: "smooth",
        });
      }

      // Re-enable IntersectionObserver after scroll completes
      setTimeout(() => {
        isManualNavigationRef.current = false;
      }, 1000); // Wait for smooth scroll to complete
    }, 0);
  };

  if (tocItems.length === 0) {
    return (
      <nav ref={navRef} className={cn("space-y-1 text-[0.875rem]", className)}>
        <h4 className="mb-3 font-semibold">On this page</h4>
        <p className="">No headings available</p>
      </nav>
    );
  }

  return (
    <nav ref={navRef} className={cn("space-y-1 text-[0.875rem]", className)}>
      <h4 className="mb-3 font-semibold">On this page</h4>
      <ul className="space-y-1">
        {tocItems.map((item) => (
          <li
            key={item.id}
            ref={(el) => {
              if (el) {
                itemRefs.current.set(item.id, el);
              } else {
                itemRefs.current.delete(item.id);
              }
            }}
          >
            <button
              onClick={() => scrollToHeading(item.id)}
              className={cn(
                "block w-full px-2 py-1.5 text-left transition-all duration-200",
                "hover:bg-[#FF572D]/10",
                activeId === item.id
                  ? "text-color-primary border-l-2 border-[#FF572D] bg-[#FF572D]/20 font-semibold"
                  : "",
                {
                  "pl-3": item.level === 1,
                  "pl-5": item.level === 2,
                  "pl-7": item.level === 3,
                  "pl-9": item.level === 4,
                  "pl-11": item.level === 5,
                  "pl-13": item.level === 6,
                }
              )}
              title={item.text}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
