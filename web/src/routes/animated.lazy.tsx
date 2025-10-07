import { createLazyFileRoute } from "@tanstack/react-router";
import { AnimatedRouter } from "../components/AnimatedRouter";

export const Route = createLazyFileRoute("/animated")({
  component: AnimatedPage,
});

function AnimatedPage() {
  return (
    <div className="px-4">
      <div className="mb-6 rounded-lg p-4">
        <h2 className="mb-2 font-semibold">✨ Animated Route Transitions</h2>
        <p className="">
          Routes slide in and out with smooth CSS transitions. All components
          stay mounted for seamless animations.
        </p>
      </div>

      <div className="relative h-[600px]">
        <AnimatedRouter />
      </div>
    </div>
  );
}
