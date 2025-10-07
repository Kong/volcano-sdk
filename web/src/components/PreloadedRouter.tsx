import { useLocation } from "@tanstack/react-router";
import { HomePage } from "../pages/HomePage";
import { AboutPage } from "../pages/AboutPage";
import { BlogPage } from "../pages/BlogPage";

export function PreloadedRouter() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="relative">
      {/* All routes are mounted but hidden with CSS */}
      <div className={currentPath === "/" ? "block" : "hidden"}>
        <HomePage />
      </div>

      <div className={currentPath === "/about" ? "block" : "hidden"}>
        <AboutPage />
      </div>

      <div className={currentPath === "/blog" ? "block" : "hidden"}>
        <BlogPage />
      </div>
    </div>
  );
}
