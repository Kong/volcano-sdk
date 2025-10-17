import { Outlet, createRootRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { SEOProvider } from "../seo/seo-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { initializeAnalytics } from "@/lib/analytics";
import { usePageTracking } from "@/hooks/use-analytics";

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import("@tanstack/router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      }))
    );

function RootComponent() {
  // Initialize Google Analytics on mount
  useEffect(() => {
    initializeAnalytics();
  }, []);

  // Track page views on route changes
  usePageTracking();

  return (
    <SEOProvider>
      <ThemeProvider defaultTheme="light" storageKey="volcano-theme-v2">
        <div className="min-h-screen">
          <Outlet />
        </div>
        <Suspense fallback={null}>
          <TanStackRouterDevtools />
        </Suspense>
      </ThemeProvider>
    </SEOProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
