import { createLazyFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/docs-layout";
import { SEOHead } from "@/seo/SEOHead";
import ExamplesContent from "@/content/docs/examples.mdx";

export const Route = createLazyFileRoute("/docs/examples")({
  component: ExamplesPage,
});

function ExamplesPage() {
  return (
    <>
      <SEOHead
        title="Examples - Volcano SDK Documentation"
        description="Ready-to-run examples demonstrating Volcano SDK capabilities from basic usage to advanced patterns."
        canonicalUrl="/docs/examples"
      />
      <DocsLayout>
        <ExamplesContent />
      </DocsLayout>
    </>
  );
}
