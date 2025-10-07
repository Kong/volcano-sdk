import { createLazyFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/docs-layout";
import { SEOHead } from "@/seo/SEOHead";
import FeaturesContent from "@/content/docs/features.mdx";
import { useHashNavigation } from "@/hooks/useHashNavigation";

export const Route = createLazyFileRoute("/docs/features")({
  component: FeaturesPage,
});

function FeaturesPage() {
  useHashNavigation();

  return (
    <>
      <SEOHead
        title="Features - Volcano SDK Documentation"
        description="Volcano SDK provides production-ready features for building reliable AI agent workflows."
        canonicalUrl="/docs/features"
      />
      <DocsLayout>
        <FeaturesContent />
      </DocsLayout>
    </>
  );
}
