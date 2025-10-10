import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from "url";
import { extractHeadings, type Heading } from "./generate-toc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Table of Contents Generation", () => {
  const docsDir = path.join(__dirname, "../content/docs");

  // Get all MDX files in the docs directory
  const mdxFiles = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => f !== "quickstart.mdx"); // Skip quickstart as per generate-toc.ts

  it("should have MDX files to test", () => {
    expect(mdxFiles.length).toBeGreaterThan(0);
  });

  mdxFiles.forEach((file) => {
    describe(`${file}`, () => {
      const filePath = path.join(docsDir, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { content: markdown } = matter(fileContent);

      it("should parse MDX file and extract headings", () => {
        const headings = extractHeadings(markdown);

        // Should extract at least some headings
        expect(headings.length).toBeGreaterThan(0);

        // Each heading should have required properties
        headings.forEach((heading) => {
          expect(heading).toHaveProperty("level");
          expect(heading).toHaveProperty("text");
          expect(heading).toHaveProperty("id");
          expect(heading.level).toBeGreaterThanOrEqual(1);
          expect(heading.level).toBeLessThanOrEqual(6);
          expect(heading.text).toBeTruthy();
          expect(heading.id).toBeTruthy();
        });
      });

      it("should match all headings in the markdown content", () => {
        const headings = extractHeadings(markdown);

        // Remove code blocks from markdown to avoid matching headings inside code
        const codeBlockRegex = /```[\s\S]*?```/g;
        const contentWithoutCodeBlocks = markdown.replace(codeBlockRegex, "");

        // Find all heading patterns in the content
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const matches = [...contentWithoutCodeBlocks.matchAll(headingRegex)];

        // Should have the same number of headings as matches
        expect(headings.length).toBe(matches.length);

        // Each match should correspond to an extracted heading
        matches.forEach((match, index) => {
          const level = match[1].length;
          const text = match[2].trim();

          expect(headings[index].level).toBe(level);
          expect(headings[index].text).toBe(text);
        });
      });

      it("should generate valid slugs for all headings", () => {
        const headings = extractHeadings(markdown);

        headings.forEach((heading) => {
          // ID should be lowercase (for ASCII characters)
          expect(heading.id).toBe(heading.id.toLowerCase());

          // ID should not contain spaces
          expect(heading.id).not.toMatch(/\s/);

          // ID should not be empty
          expect(heading.id.length).toBeGreaterThan(0);

          // ID should not have consecutive hyphens
          expect(heading.id).not.toMatch(/--/);

          // ID should not start or end with hyphen
          expect(heading.id).not.toMatch(/^-/);
          expect(heading.id).not.toMatch(/-$/);
        });
      });

      it("should handle duplicate heading IDs correctly", () => {
        // Create test content with duplicate headings
        const testContent = `
# Test Heading
Some content here.

## Test Heading
More content.

### Test Heading
Even more content.
        `;

        const headings = extractHeadings(testContent);

        // First heading should have base ID
        expect(headings[0].id).toBe("test-heading");

        // Second heading should have -1 suffix
        expect(headings[1].id).toBe("test-heading-1");

        // Third heading should have -2 suffix
        expect(headings[2].id).toBe("test-heading-2");
      });

      it("should not extract headings from code blocks", () => {
        const testContent = `
# Real Heading

\`\`\`markdown
# This is not a heading
## Also not a heading
\`\`\`

## Another Real Heading
        `;

        const headings = extractHeadings(testContent);

        // Should only find 2 headings (not the ones in code block)
        expect(headings.length).toBe(2);
        expect(headings[0].text).toBe("Real Heading");
        expect(headings[1].text).toBe("Another Real Heading");
      });
    });
  });

  it("should verify all headings are included in generated TOC", () => {
    // Read the generated navigation file
    const generatedPath = path.join(
      __dirname,
      "../components/docs/navigation-generated.ts"
    );

    // Check if the generated file exists
    if (!fs.existsSync(generatedPath)) {
      throw new Error(
        "navigation-generated.ts does not exist. Run 'npm run generate-toc' first."
      );
    }

    const generatedContent = fs.readFileSync(generatedPath, "utf-8");

    // Parse the exported navigation data
    const jsonMatch = generatedContent.match(
      /export const generatedNavigation: NavigationDoc\[\] = ([\s\S]+)/
    );

    if (!jsonMatch) {
      throw new Error("Could not parse generated navigation data");
    }

    const generatedNavigation = JSON.parse(jsonMatch[1]);

    // For each MDX file, verify all its headings are in the generated TOC
    mdxFiles.forEach((file) => {
      const filePath = path.join(docsDir, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { content: markdown } = matter(fileContent);

      // Extract headings from the source file
      const sourceHeadings = extractHeadings(markdown);

      // Skip if no headings
      if (sourceHeadings.length === 0) return;

      // Find corresponding entry in generated navigation
      const relativePath = `/${file}`;
      let routePath = relativePath.replace(/\.mdx$/, "");

      if (routePath === "/index") {
        routePath = "/docs";
      } else {
        routePath = routePath.replace(/^\//, "/docs/");
      }

      const navEntry = generatedNavigation.find(
        (nav: { path: string; headings: Heading[] }) => nav.path === routePath
      );

      expect(navEntry).toBeDefined();
      expect(navEntry?.headings).toBeDefined();

      // Verify all source headings are in the generated TOC
      sourceHeadings.forEach((sourceHeading) => {
        const foundInToc = navEntry?.headings.some(
          (tocHeading: Heading) =>
            tocHeading.level === sourceHeading.level &&
            tocHeading.text === sourceHeading.text &&
            tocHeading.id === sourceHeading.id
        );

        expect(foundInToc).toBe(true);
      });

      // Verify the counts match
      expect(navEntry?.headings.length).toBe(sourceHeadings.length);
    });
  });
});
