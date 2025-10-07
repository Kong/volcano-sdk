import { createLazyFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/docs-layout";
import { SEOHead } from "@/seo/SEOHead";
import { CodeBlock } from "@/components/ui/code-block";

export const Route = createLazyFileRoute("/docs/installation")({
  component: InstallationPage,
});

function InstallationPage() {
  return (
    <>
      <SEOHead
        title="Installation - Volcano SDK Documentation"
        description="Learn how to install and configure Volcano SDK for your project."
        canonicalUrl="/docs/installation"
      />
      <DocsLayout>
        <div className="prose prose-lg dark:prose-invert">
          <h1>Installation</h1>
          <p>Get Volcano SDK up and running in your project.</p>

          <h2>Package Installation</h2>
          <CodeBlock language="bash" title="Install Volcano SDK">
            {`npm install volcano-ai`}
          </CodeBlock>

          <h2>Requirements</h2>
          <ul>
            <li>Node.js 18.17 or later</li>
            <li>TypeScript 5.0+ (recommended)</li>
            <li>An API key from at least one LLM provider</li>
          </ul>

          <h2>Optional Dependencies</h2>
          <p>For AWS Bedrock support:</p>
          <CodeBlock language="bash" title="AWS Bedrock Dependencies">
            {`npm install @aws-sdk/client-bedrock-runtime`}
          </CodeBlock>

          <p>For Azure AI support:</p>
          <CodeBlock language="bash" title="Azure AI Dependencies">
            {`npm install @azure/identity`}
          </CodeBlock>

          <h2>TypeScript Configuration</h2>
          <p>
            Volcano SDK is written in TypeScript and provides full type
            definitions. No additional configuration is needed.
          </p>
        </div>
      </DocsLayout>
    </>
  );
}
