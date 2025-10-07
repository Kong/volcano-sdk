import { createLazyFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/docs-layout";
import { SEOHead } from "@/seo/SEOHead";
import ApiContent from "@/content/docs/api.mdx";
import { useHashNavigation } from "@/hooks/useHashNavigation";

export const Route = createLazyFileRoute("/docs/api")({
  component: ApiPage,
});

function ApiPage() {
  useHashNavigation();

  return (
    <>
      <SEOHead
        title="API Reference - Volcano SDK Documentation"
        description="Complete API reference for Volcano SDK: agent creation, step types, results, and utility functions."
        canonicalUrl="/docs/api"
      />
      <DocsLayout>
        <ApiContent />
      </DocsLayout>
    </>
  );
}
