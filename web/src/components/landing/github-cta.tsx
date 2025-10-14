import { Star } from "lucide-react";
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
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-space-mono mb-3 text-2xl font-bold sm:text-3xl">
            Open Source
          </h2>
          <p className="mb-6 text-base text-gray-700">
            Made by developers, for developers.
          </p>

          <a
            href="https://github.com/kong/volcano-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-btn-primary inline-flex items-center justify-center gap-2 border-2 border-black px-6 py-3 text-base font-medium transition-opacity hover:opacity-85"
          >
            <Star className="h-5 w-5" />
            {stars !== null ? (
              <span>
                Star on GitHub <span className="font-bold">({stars})</span>
              </span>
            ) : (
              "Star on GitHub"
            )}
          </a>
        </div>
      </div>
    </section>
  );
}
