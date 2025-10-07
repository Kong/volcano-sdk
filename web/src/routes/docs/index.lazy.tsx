import { createLazyFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/docs-layout";
import { SEOHead } from "@/seo/SEOHead";
import DocsContent from "@/content/docs/index.mdx";
import { useHashNavigation } from "@/hooks/useHashNavigation";

export const Route = createLazyFileRoute("/docs/")({
  component: DocsPage,
});

function DocsPage() {
  useHashNavigation();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Volcano SDK Documentation",
    description:
      "Complete documentation for building multi-provider AI agents with TypeScript. Learn about MCP tools, LLM providers, and advanced patterns.",
    author: {
      "@type": "Organization",
      name: "Volcano Team",
    },
    publisher: {
      "@type": "Organization",
      name: "Volcano SDK",
    },
    datePublished: "2025-01-01",
    dateModified: "2025-01-15",
  };

  return (
    <>
      <SEOHead
        title="Documentation - Volcano SDK | Complete Guide for AI Agents"
        description="Complete documentation for Volcano SDK. Learn how to build production-ready AI agents with TypeScript, integrate MCP tools, and use multiple LLM providers."
        keywords="Volcano SDK docs, AI agent documentation, TypeScript AI tutorial, MCP tools guide, LLM integration, agent framework documentation"
        canonicalUrl="/docs"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <DocsLayout>
        <DocsContent />
      </DocsLayout>
    </>
  );
}
