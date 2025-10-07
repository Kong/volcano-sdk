import { useLocation } from "@tanstack/react-router";
import { HomePage } from "../pages/HomePage";
import { AboutPage } from "../pages/AboutPage";
import { BlogPage } from "../pages/BlogPage";
import { useEffect, useRef } from "react";

export function AnimatedRouter() {
  const location = useLocation();
  const currentPath = location.pathname;
  const previousPath = useRef(currentPath);

  useEffect(() => {
    previousPath.current = currentPath;
  }, [currentPath]);

  return (
    <div className="relative overflow-hidden">
      {/* Using opacity and transform for smooth transitions */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          currentPath === "/"
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-full opacity-0"
        }`}
      >
        <HomePage />
      </div>

      <div
        className={`absolute inset-0 transition-all duration-300 ${
          currentPath === "/about"
            ? "pointer-events-auto translate-x-0 opacity-100"
            : currentPath === "/"
              ? "pointer-events-none translate-x-full opacity-0"
              : "pointer-events-none -translate-x-full opacity-0"
        }`}
      >
        <AboutPage />
      </div>

      <div
        className={`absolute inset-0 transition-all duration-300 ${
          currentPath === "/blog"
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-full opacity-0"
        }`}
      >
        <BlogPage />
      </div>
    </div>
  );
}
