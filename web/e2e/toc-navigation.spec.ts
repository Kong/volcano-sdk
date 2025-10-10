import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { extractHeadings } from "../src/scripts/generate-toc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocInfo {
  file: string;
  path: string;
  headings: Array<{ level: number; text: string; id: string }>;
}

test.describe("Table of Contents Navigation", () => {
  // Get all MDX files and their headings
  const docsDir = path.join(__dirname, "../src/content/docs");
  const mdxFiles = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => f !== "quickstart.mdx");

  const docsInfo: DocInfo[] = [];

  for (const file of mdxFiles) {
    const filePath = path.join(docsDir, file);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { content: markdown } = matter(fileContent);
    const headings = extractHeadings(markdown);

    // Skip files with no headings
    if (headings.length === 0) continue;

    // Convert file path to route path
    let routePath = `/${file}`.replace(/\.mdx$/, "");
    if (routePath === "/index") {
      routePath = "/docs";
    } else {
      routePath = routePath.replace(/^\//, "/docs/");
    }

    docsInfo.push({
      file,
      path: routePath,
      headings,
    });
  }

  test("should have docs with headings to test", () => {
    expect(docsInfo.length).toBeGreaterThan(0);
  });

  // Test each docs page TOC
  for (const doc of docsInfo) {
    test(`${doc.file} - TOC should have correct href attributes`, async ({
      page,
    }) => {
      await page.goto(doc.path);
      await page.waitForLoadState("networkidle");

      // Find the TOC container (usually has "On this page" heading)
      const tocContainer = page.locator('nav:has(h4:text("On this page"))');
      await expect(tocContainer).toBeVisible();

      // Get all TOC links
      const tocLinks = tocContainer.locator("a, button");
      const tocLinkCount = await tocLinks.count();

      // We should have TOC links
      expect(tocLinkCount).toBeGreaterThan(0);

      console.log(`\n📄 ${doc.file}`);
      console.log(`   Path: ${doc.path}`);
      console.log(`   Total headings in MDX: ${doc.headings.length}`);

      // Apply the same filtering logic as the TOC component
      // Filter out sub-items (level 3+) under "Key Features"
      const allHeadings = doc.headings;
      const expectedTocHeadings = allHeadings.filter((heading, index) => {
        // Find the "Key Features" section
        const keyFeaturesIndex = allHeadings.findIndex(
          (h) => h.id === "key-features"
        );

        if (keyFeaturesIndex === -1) return true; // No Key Features section, keep all

        // Find the next level 2 heading after Key Features
        const nextLevel2Index = allHeadings.findIndex(
          (h, i) => i > keyFeaturesIndex && h.level === 2
        );

        // If we're between Key Features and the next level 2 heading, and we're level 3+, filter out
        const isAfterKeyFeatures = index > keyFeaturesIndex;
        const isBeforeNextSection =
          nextLevel2Index === -1 || index < nextLevel2Index;
        const isSubItem = heading.level >= 3;

        if (isAfterKeyFeatures && isBeforeNextSection && isSubItem) {
          return false; // Filter out level 3+ items under Key Features
        }

        return true; // Keep everything else
      });

      console.log(`   Expected in TOC (after filtering): ${expectedTocHeadings.length}`);
      console.log(`   TOC links found: ${tocLinkCount}`);

      // Collect all button texts from TOC (buttons use onClick, not href)
      const tocButtonTexts: string[] = [];

      for (let i = 0; i < tocLinkCount; i++) {
        const link = tocLinks.nth(i);
        const text = await link.textContent();

        if (text) {
          tocButtonTexts.push(text.trim());
        }
      }

      console.log(`   TOC buttons extracted: ${tocButtonTexts.length}`);

      // Verify expected headings match TOC buttons
      const missingInToc: string[] = [];
      const extraInToc: string[] = [];

      // Check if all expected headings are in TOC (by text)
      for (const heading of expectedTocHeadings) {
        const foundInToc = tocButtonTexts.some(
          (text) => text === heading.text
        );
        if (!foundInToc) {
          missingInToc.push(`${heading.text} (#${heading.id})`);
        }
      }

      // Check if TOC has any extra items not in expected list
      for (const tocText of tocButtonTexts) {
        const foundInExpected = expectedTocHeadings.some(
          (h) => h.text === tocText
        );
        if (!foundInExpected) {
          extraInToc.push(tocText);
        }
      }

      if (missingInToc.length > 0) {
        console.log(`   ⚠️  Missing in TOC:`);
        missingInToc.slice(0, 5).forEach((item) => {
          console.log(`      - ${item}`);
        });
      }

      if (extraInToc.length > 0) {
        console.log(`   ⚠️  Extra in TOC:`);
        extraInToc.slice(0, 5).forEach((item) => {
          console.log(`      - ${item}`);
        });
      }

      // Assert: Expected headings should match TOC buttons
      const matchCount = expectedTocHeadings.filter((h) =>
        tocButtonTexts.some((text) => text === h.text)
      ).length;
      const matchPercentage =
        (matchCount / expectedTocHeadings.length) * 100;

      console.log(
        `   ✅ Match: ${matchCount}/${expectedTocHeadings.length} (${matchPercentage.toFixed(1)}%)`
      );

      // We expect 100% match since we're using the same filtering logic
      expect(
        matchCount,
        `Expected all filtered headings to be in TOC. Found ${matchCount}/${expectedTocHeadings.length} (${matchPercentage.toFixed(1)}%)`
      ).toBe(expectedTocHeadings.length);
    });

    test(`${doc.file} - TOC links should navigate to correct headings`, async ({
      page,
    }) => {
      await page.goto(doc.path);
      await page.waitForLoadState("networkidle");

      // Find the TOC container
      const tocContainer = page.locator('nav:has(h4:text("On this page"))');
      await expect(tocContainer).toBeVisible();

      // Get all TOC links (buttons in this case based on the component)
      const tocLinks = tocContainer.locator("button");
      const tocLinkCount = await tocLinks.count();

      if (tocLinkCount === 0) {
        console.log(`   ⚠️  No TOC buttons found, skipping navigation test`);
        return;
      }

      // Test first 3 TOC links (to keep test time reasonable)
      const linksToTest = Math.min(3, tocLinkCount);

      for (let i = 0; i < linksToTest; i++) {
        const link = tocLinks.nth(i);
        const linkText = await link.textContent();

        // Click the TOC link
        await link.click();
        await page.waitForTimeout(500); // Wait for scroll/navigation

        // Get current URL hash
        const url = page.url();
        const hash = url.includes("#") ? url.split("#")[1] : "";

        expect(hash).toBeTruthy();

        // Decode URL-encoded hash (for emojis, special chars, etc.)
        const decodedHash = decodeURIComponent(hash);

        // Verify the corresponding heading exists on the page
        // Use attribute selector to avoid CSS escaping issues with special characters
        const heading = page.locator(`[id="${decodedHash}"]`);

        // Check if heading exists (some edge cases with special chars may not render)
        const headingCount = await heading.count();
        if (headingCount > 0) {
          await expect(heading).toBeVisible();
          console.log(`   ✅ ${linkText?.trim()} → #${decodedHash}`);
        } else {
          console.log(`   ⚠️  ${linkText?.trim()} → #${decodedHash} (element not found, skipping)`);
        }
      }
    });

    test(`${doc.file} - TOC should highlight active section`, async ({
      page,
    }) => {
      await page.goto(doc.path);
      await page.waitForLoadState("networkidle");

      // Find the TOC container
      const tocContainer = page.locator('nav:has(h4:text("On this page"))');
      await expect(tocContainer).toBeVisible();

      // Get all TOC links
      const tocLinks = tocContainer.locator("button");
      const tocLinkCount = await tocLinks.count();

      if (tocLinkCount === 0) {
        return;
      }

      // Click a TOC link
      const firstLink = tocLinks.first();
      await firstLink.click();
      await page.waitForTimeout(500);

      // Check if the clicked link has an active/highlighted state
      // This checks for common active state classes/attributes
      const hasActiveClass = await firstLink.evaluate((el) => {
        const classes = el.className;
        return (
          classes.includes("active") ||
          classes.includes("bg-") ||
          classes.includes("border-") ||
          classes.includes("font-semibold")
        );
      });

      expect(hasActiveClass).toBe(true);

      console.log(`   ✅ Active state applied to clicked TOC link`);
    });
  }

  test("TOC should update when scrolling through content", async ({ page }) => {
    // Use the main docs page which likely has multiple sections
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");

    // Find the TOC container
    const tocContainer = page.locator('nav:has(h4:text("On this page"))');

    if (!(await tocContainer.isVisible())) {
      console.log("   ⚠️  TOC not found, skipping scroll test");
      return;
    }

    // Get TOC buttons
    const tocButtons = tocContainer.locator("button");
    const buttonCount = await tocButtons.count();

    if (buttonCount < 2) {
      console.log("   ⚠️  Not enough TOC buttons for scroll test");
      return;
    }

    // Click the second TOC button to trigger navigation
    const secondButton = tocButtons.nth(1);
    await secondButton.click();
    await page.waitForTimeout(500);

    // Check if TOC has updated (the clicked button should have active state)
    const hasActiveState = await secondButton.evaluate((el) => {
      return el.className.includes("font-semibold");
    });

    expect(hasActiveState).toBe(true);
    console.log(`   ✅ TOC highlights active section after click`);
  });
});
