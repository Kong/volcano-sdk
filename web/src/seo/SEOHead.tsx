import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: string;
  canonicalUrl?: string;
  noindex?: boolean;
}

const defaultMeta = {
  title: "Volcano SDK - TypeScript SDK for Multi-Provider AI Agents",
  description:
    "Build AI agents that chain LLM reasoning with MCP tools. Mix OpenAI, Claude, Mistral in one workflow. Parallel execution, branching, loops. TypeScript-first with full type safety.",
  keywords:
    "AI agents, TypeScript SDK, Multi-provider AI, MCP tools, OpenAI, Claude, Anthropic, Mistral, LLM workflow, AI development, TypeScript AI, agent framework, tool calling, parallel execution",
  ogImage: "/og-image.jpg",
  twitterCard: "summary_large_image",
};

export function SEOHead({
  title = defaultMeta.title,
  description = defaultMeta.description,
  keywords = defaultMeta.keywords,
  ogTitle,
  ogDescription,
  ogImage = defaultMeta.ogImage,
  ogUrl,
  twitterCard = defaultMeta.twitterCard,
  canonicalUrl,
  noindex = false,
}: SEOHeadProps) {
  const finalOgTitle = ogTitle || title;
  const finalOgDescription = ogDescription || description;
  const finalOgUrl =
    ogUrl || (typeof window !== "undefined" ? window.location.href : "");

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph */}
      <meta property="og:title" content={finalOgTitle} />
      <meta property="og:description" content={finalOgDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={finalOgUrl} />
      <meta property="og:type" content="website" />

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={finalOgTitle} />
      <meta name="twitter:description" content={finalOgDescription} />
      <meta name="twitter:image" content={ogImage} />

      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Robots */}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Additional SEO tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="language" content="English" />
      <meta name="author" content="Volcano Team" />

      {/* Performance and Indexing Hints */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
    </Helmet>
  );
}
