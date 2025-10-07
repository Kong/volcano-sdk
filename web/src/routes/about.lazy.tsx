import { createLazyFileRoute } from "@tanstack/react-router";
import { SEOHead } from "../seo/SEOHead";

export const Route = createLazyFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <SEOHead
        title="About Us - Modern React App Development"
        description="Learn about our modern web application stack built with React, Vite, TanStack Router, and TailwindCSS for optimal performance."
        canonicalUrl="/about"
      />
      <div className="px-4">
        <h1 className="mb-6 font-bold">About Us</h1>
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="">
            This is a modern web application built with the latest technologies
            for optimal performance and SEO.
          </p>

          <h2 className="mt-8 mb-4 font-semibold">Technology Stack</h2>
          <ul className="space-y-2">
            <li>React 18 with TypeScript</li>
            <li>Vite for fast development and optimized builds</li>
            <li>TanStack Router for file-based routing</li>
            <li>TailwindCSS for styling</li>
            <li>SEO optimization with meta tags and pre-rendering</li>
          </ul>

          <h2 className="mt-8 mb-4 font-semibold">Features</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg p-4">
              <h3 className="font-semibold">Type Safety</h3>
              <p className="">Full TypeScript support with type-safe routing</p>
            </div>
            <div className="rounded-lg p-4">
              <h3 className="font-semibold">Code Splitting</h3>
              <p className="">
                Automatic code splitting for optimal loading performance
              </p>
            </div>
            <div className="rounded-lg p-4">
              <h3 className="font-semibold">SEO Ready</h3>
              <p className="">
                Pre-rendering and meta tag management for search engines
              </p>
            </div>
            <div className="rounded-lg p-4">
              <h3 className="font-semibold">Modern Styling</h3>
              <p className="">
                TailwindCSS for responsive and maintainable styles
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
