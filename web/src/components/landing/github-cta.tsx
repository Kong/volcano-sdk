import { Star, Github } from "lucide-react";
import { useEffect, useState } from "react";

export function GitHubCTA() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/kong/volcano-sdk")
      .then((res) => res.json())
      .then((data) => setStars(data.stargazers_count || 0))
      .catch(() => {});
  }, []);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Github className="h-7 w-7 sm:h-8 sm:w-8" />
            <h2 className="font-space-mono text-2xl font-bold sm:text-3xl lg:text-4xl">
              Built in the Open, For Everyone
            </h2>
          </div>

          <p className="mb-4 text-base text-gray-700 sm:text-lg">
            Volcano SDK is fully open source and community-driven. We believe in
            transparency, collaboration, and building tools that empower
            developers to create intelligent AI agents without vendor lock-in.
          </p>

          <p className="mb-8 text-base text-gray-600">
            Explore the source code, contribute features, report issues, or
            simply star the repository to stay updated with the latest
            developments.
          </p>

          {stars !== null && (
            <div className="mb-6 flex items-center justify-center gap-2 text-sm text-gray-600">
              <Star className="h-4 w-4 fill-yellow-400 stroke-yellow-600" />
              <span className="font-space-mono text-lg font-bold text-black">
                {stars.toLocaleString()}
              </span>
              <span>stars</span>
            </div>
          )}

          <a
            href="https://github.com/kong/volcano-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-btn-primary inline-flex items-center justify-center gap-2 border-2 border-black px-6 py-3 text-base font-medium transition-transform hover:scale-105"
          >
            <Star className="h-5 w-5" />
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
