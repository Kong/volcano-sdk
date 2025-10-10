import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { getAllMDXTextContent } from "./helpers/mdx-content-extractor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Docs Pages Content Verification", () => {
  // Get all MDX files and their text content
  const docsDir = path.join(__dirname, "../src/content/docs");
  const mdxContents = getAllMDXTextContent(docsDir);

  test("should have MDX files to test", () => {
    expect(mdxContents.length).toBeGreaterThan(0);
  });

  // Create a test for each MDX file
  for (const mdxContent of mdxContents) {
    test(`${mdxContent.file} - should render all text content on the page`, async ({
      page,
    }) => {
      // Navigate to the docs page
      await page.goto(mdxContent.path);

      // Wait for the page to load
      await page.waitForLoadState("networkidle");

      // Get the page content
      const pageContent = await page.textContent("body");

      // Verify each text content appears on the page
      const missingContent: string[] = [];
      const foundContent: string[] = [];

      for (const text of mdxContent.textContent) {
        // Normalize both strings for comparison (remove extra whitespace)
        const normalizedText = text.replace(/\s+/g, " ").trim();
        const normalizedPage = pageContent?.replace(/\s+/g, " ") || "";

        if (normalizedPage.includes(normalizedText)) {
          foundContent.push(text);
        } else {
          // Try a more lenient match - check if most words appear
          const words = normalizedText
            .split(" ")
            .filter((w) => w.length > 3);
          const matchedWords = words.filter((word) =>
            normalizedPage.includes(word)
          );

          if (matchedWords.length >= words.length * 0.8) {
            // 80% of words match
            foundContent.push(text);
          } else {
            missingContent.push(text);
          }
        }
      }

      // Report findings
      const totalContent = mdxContent.textContent.length;
      const foundCount = foundContent.length;
      const missingCount = missingContent.length;
      const matchPercentage = ((foundCount / totalContent) * 100).toFixed(1);

      console.log(`\n📄 ${mdxContent.file}`);
      console.log(`   Path: ${mdxContent.path}`);
      console.log(`   Total text items: ${totalContent}`);
      console.log(`   ✅ Found: ${foundCount} (${matchPercentage}%)`);
      console.log(`   ❌ Missing: ${missingCount}`);

      if (missingContent.length > 0) {
        console.log(`\n   Missing content samples (first 5):`);
        missingContent.slice(0, 5).forEach((text, idx) => {
          console.log(`   ${idx + 1}. "${text.substring(0, 80)}..."`);
        });
      }

      // Assert that at least 90% of content is present
      // (some content might be in collapsed sections, tabs, or code blocks that are rendered differently)
      expect(
        foundCount,
        `Expected at least 90% of content to be present on ${mdxContent.path}. Found ${foundCount}/${totalContent} (${matchPercentage}%)`
      ).toBeGreaterThanOrEqual(totalContent * 0.9);
    });
  }

  // Additional test to verify page structure
  for (const mdxContent of mdxContents) {
    test(`${mdxContent.file} - should have proper page structure`, async ({
      page,
    }) => {
      await page.goto(mdxContent.path);
      await page.waitForLoadState("networkidle");

      // Verify main content area exists (use #docs-content specifically)
      const mainContent = page.locator("#docs-content");
      await expect(mainContent).toBeVisible();

      // Verify there are headings on the page
      const headings = page.locator("h1, h2, h3, h4, h5, h6");
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
    });
  }

  // Test navigation between docs
  test("should be able to navigate between docs pages", async ({ page }) => {
    // Start at the main docs page
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");

    // Get all navigation links in the sidebar
    const navLinks = page.locator('nav a[href^="/docs/"]');
    const linkCount = await navLinks.count();

    expect(linkCount).toBeGreaterThan(0);

    // Click the first link and verify navigation works
    if (linkCount > 0) {
      const firstLink = navLinks.first();
      const href = await firstLink.getAttribute("href");

      if (href) {
        await firstLink.click();
        await page.waitForLoadState("networkidle");

        // Verify we navigated to the correct page
        expect(page.url()).toContain(href);
      }
    }
  });
});
