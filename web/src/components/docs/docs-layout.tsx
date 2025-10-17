import { useState } from "react";
import type { ReactNode } from "react";
import { Header } from "@/components/landing/header";
import { DocsSidebar } from "./sidebar";
import { TableOfContents } from "./table-of-contents-generated";
import { MDXProvider } from "@mdx-js/react";
import { mdxComponents } from "@/components/mdx-components";
import { FeatureCardsTransformer } from "./feature-cards-transformer";
import { Menu, X } from "lucide-react";

interface DocsLayoutProps {
  children: ReactNode;
}

export function DocsLayout({ children }: DocsLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="relative">
        {/* Mobile menu toggle button */}
        <button
          className="fixed right-4 bottom-4 z-[200] rounded-none border-2 border-black bg-[#FF572D] p-3 text-white shadow-lg hover:bg-[#FF572D]/90 lg:hidden"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle sidebar"
        >
          {isSidebarOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-[150] bg-black/30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex h-[calc(100vh-4rem)]">
          {/* Sidebar - hidden on mobile by default, shown when toggled */}
          <div
            className={`fixed top-0 bottom-0 left-0 z-[160] transform lg:relative lg:top-0 lg:z-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} h-screen bg-white transition-transform duration-300 ease-in-out lg:h-full lg:translate-x-0 lg:bg-transparent`}
          >
            <DocsSidebar onMobileClose={() => setIsSidebarOpen(false)} />
          </div>

          <main className="flex-1 overflow-y-auto">
            <div
              className="container mx-auto max-w-4xl px-4 py-6 text-[0.875rem] sm:px-6 sm:py-8 lg:px-8"
              id="docs-content"
            >
              <MDXProvider components={mdxComponents}>
                <article className="prose prose-base dark:prose-invert max-w-none">
                  {children}
                </article>
              </MDXProvider>
              <FeatureCardsTransformer />
            </div>
          </main>

          <aside className="hidden w-64 overflow-y-auto border-l px-6 py-8 xl:block">
            <TableOfContents />
          </aside>
        </div>
      </div>
    </div>
  );
}
