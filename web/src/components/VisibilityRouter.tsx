import { useLocation } from "@tanstack/react-router";
import { HomePage } from "../pages/HomePage";
import { AboutPage } from "../pages/AboutPage";
import { BlogPage } from "../pages/BlogPage";

/**
 * Alternative approach using visibility instead of display:none
 * This keeps the layout but hides content visually and from screen readers
 */
export function VisibilityRouter() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <>
      <div
        style={{
          visibility: currentPath === "/" ? "visible" : "hidden",
          position: currentPath === "/" ? "relative" : "absolute",
          pointerEvents: currentPath === "/" ? "auto" : "none",
        }}
        aria-hidden={currentPath !== "/"}
      >
        <HomePage />
      </div>

      <div
        style={{
          visibility: currentPath === "/about" ? "visible" : "hidden",
          position: currentPath === "/about" ? "relative" : "absolute",
          pointerEvents: currentPath === "/about" ? "auto" : "none",
        }}
        aria-hidden={currentPath !== "/about"}
      >
        <AboutPage />
      </div>

      <div
        style={{
          visibility: currentPath === "/blog" ? "visible" : "hidden",
          position: currentPath === "/blog" ? "relative" : "absolute",
          pointerEvents: currentPath === "/blog" ? "auto" : "none",
        }}
        aria-hidden={currentPath !== "/blog"}
      >
        <BlogPage />
      </div>
    </>
  );
}
