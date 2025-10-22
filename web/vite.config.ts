import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkDirective from "remark-directive";
import { remarkDirectiveToComponent } from "./src/lib/remark-directive-to-component";
import rehypeSlug from "rehype-slug";
import { rehypeCleanIds } from "./src/lib/rehype-clean-ids";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    {
      enforce: "pre",
      ...mdx({
        providerImportSource: "@mdx-js/react",
        remarkPlugins: [
          remarkFrontmatter,
          remarkGfm,
          remarkDirective,
          remarkDirectiveToComponent,
        ],
        rehypePlugins: [rehypeSlug, rehypeCleanIds],
      }),
    },
    react({
      include: /\.(jsx|js|mdx|md|tsx|ts)$/,
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
