import { Star } from "lucide-react";

export function GitHubCTA() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-space-mono mb-4 text-2xl font-bold sm:text-3xl lg:text-4xl">
            Open Source & Community Driven
          </h2>
          <p className="font-space-mono mb-8 text-base text-gray-700 sm:text-lg">
            Volcano SDK is open source. Explore the code, contribute to the
            project, or just give us a star to show your support.
          </p>
          <a
            href="https://github.com/kong/volcano-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-btn-primary inline-flex items-center justify-center gap-2 border-2 border-black px-8 py-4 text-base font-medium transition-opacity hover:opacity-85 sm:text-lg"
          >
            <Star className="h-5 w-5" />
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
