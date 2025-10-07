import { createLazyFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/docs-layout";
import { SEOHead } from "@/seo/SEOHead";
import McpToolsContent from "@/content/docs/mcp-tools.mdx";
import { useHashNavigation } from "@/hooks/useHashNavigation";

export const Route = createLazyFileRoute("/docs/mcp-tools")({
  component: McpToolsPage,
});

function McpToolsPage() {
  useHashNavigation();

  return (
    <>
      <SEOHead
        title="MCP Tools - Volcano SDK Documentation"
        description="Integrate Model Context Protocol (MCP) tools with Volcano SDK for advanced AI agent capabilities."
        canonicalUrl="/docs/mcp-tools"
      />
      <DocsLayout>
        <McpToolsContent />
      </DocsLayout>
    </>
  );
}
