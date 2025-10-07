import { createLazyFileRoute } from "@tanstack/react-router";
import { PreloadedRouter } from "../components/PreloadedRouter";

export const Route = createLazyFileRoute("/preloaded")({
  component: PreloadedPage,
});

function PreloadedPage() {
  return (
    <div className="px-4">
      <div className="mb-6 rounded-lg p-4">
        <h2 className="mb-2 font-semibold">🚀 CSS-Based Routing Demo</h2>
        <p className="mb-2">
          All routes below are pre-mounted in the DOM but hidden with CSS.
          Navigate between them and notice:
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>Instant transitions with no loading</li>
          <li>Counters and timers keep running</li>
          <li>Form inputs maintain their state</li>
          <li>Component mount time stays the same</li>
        </ul>
      </div>

      <PreloadedRouter />
    </div>
  );
}
