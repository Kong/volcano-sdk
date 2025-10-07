import { Outlet, createRootRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { SEOProvider } from "../seo/SEOProvider";
import { ThemeProvider } from "@/components/theme-provider";

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import("@tanstack/router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      }))
    );

export const Route = createRootRoute({
  component: () => (
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
  ),
});
