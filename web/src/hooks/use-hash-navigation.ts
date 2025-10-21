import { useEffect } from "react";

export function useHashNavigation() {
  useEffect(() => {
    // Handle hash navigation on page load
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1); // Remove the #

      // Small delay to ensure the page is fully rendered
      setTimeout(() => {
        const element = document.getElementById(hash);
        const contentContainer = document.getElementById("docs-content");

        if (element && contentContainer) {
          // Get positions relative to the content container
          const containerRect = contentContainer.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const relativeTop =
            elementRect.top - containerRect.top + contentContainer.scrollTop;

          contentContainer.scrollTo({
            top: relativeTop - 32, // Small offset for better visibility
            behavior: "smooth",
          });
        }
      }, 150);
    }
  }, []);
}
