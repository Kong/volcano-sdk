import { createLazyFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/docs-layout";
import { SEOHead } from "@/seo/SEOHead";
import ObservabilityContent from "@/content/docs/observability.mdx";
import { useHashNavigation } from "@/hooks/useHashNavigation";

export const Route = createLazyFileRoute("/docs/observability")({
  component: ObservabilityPage,
});

function ObservabilityPage() {
  useHashNavigation();

  return (
    <>
      <SEOHead
        title="Observability - Volcano SDK Documentation"
        description="Monitor and trace your AI agent workflows with OpenTelemetry integration in Volcano SDK."
        canonicalUrl="/docs/observability"
      />
      <DocsLayout>
        <ObservabilityContent />
      </DocsLayout>
    </>
  );
}
