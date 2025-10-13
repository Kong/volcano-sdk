import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Feature Cards Rendering", () => {
  test("should render all Key Features as feature cards", async ({ page }) => {
    // Read the index.mdx to extract all h3 headings under "Key Features"
    const docsDir = path.join(__dirname, "../src/content/docs");
    const indexPath = path.join(docsDir, "index.mdx");
    const fileContent = fs.readFileSync(indexPath, "utf-8");
    const { content: markdown } = matter(fileContent);

    // Extract h3 headings under "Key Features" section
    const lines = markdown.split("\n");
    const expectedFeatures: string[] = [];
    let inKeyFeaturesSection = false;

    for (const line of lines) {
      if (line.startsWith("## Key Features")) {
        inKeyFeaturesSection = true;
        continue;
      }

      if (inKeyFeaturesSection && line.startsWith("## ")) {
        // Reached next section, stop
        break;
      }

      if (inKeyFeaturesSection && line.startsWith("### ")) {
        // Extract feature title (remove "### " prefix)
        const title = line.replace(/^###\s+/, "").trim();
        expectedFeatures.push(title);
      }
    }

    // Navigate to the docs homepage
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");

    console.log(`\n📊 Feature Cards Test`);
    console.log(`   Expected features from MDX: ${expectedFeatures.length}`);
    console.log(`   Features: ${expectedFeatures.join(", ")}`);

    // Verify all features are rendered as cards
    const missingFeatures: string[] = [];
    const foundFeatures: string[] = [];

    for (const featureTitle of expectedFeatures) {
      // Check if a feature card with this title exists
      const featureCard = page.locator(
        `[data-feature-cards-transformed] a, [data-feature-cards-transformed] div`
      ).filter({ hasText: featureTitle });

      const count = await featureCard.count();

      if (count > 0) {
        foundFeatures.push(featureTitle);
        console.log(`   ✅ Found: ${featureTitle}`);
      } else {
        missingFeatures.push(featureTitle);
        console.log(`   ❌ Missing: ${featureTitle}`);
      }
    }

    // Assert all features are rendered
    expect(
      foundFeatures.length,
      `Expected all ${expectedFeatures.length} features to be rendered as cards. Found ${foundFeatures.length}, missing: ${missingFeatures.join(", ")}`
    ).toBe(expectedFeatures.length);

    // Additional check: verify TypeScript-First specifically (the bug we fixed)
    const typescriptCard = page
      .locator('[data-feature-cards-transformed] a')
      .filter({ hasText: "TypeScript-First" })
      .first();

    await expect(typescriptCard).toBeVisible();
    console.log(`   ✅ TypeScript-First card is visible (bug fix verified)`);
  });

  test("should have correct links for feature cards", async ({ page }) => {
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");

    // Get all feature card links
    const featureLinks = page.locator(
      '[data-feature-cards-transformed] a[href^="/docs/"]'
    );

    const linkCount = await featureLinks.count();
    console.log(`\n🔗 Feature Card Links: ${linkCount}`);

    // Verify each link has a valid href
    for (let i = 0; i < linkCount; i++) {
      const link = featureLinks.nth(i);
      const href = await link.getAttribute("href");
      const title = await link.textContent();

      expect(href).toBeTruthy();
      console.log(`   ✅ ${title?.trim()}: ${href}`);
    }
  });

  test("feature cards should be clickable and navigate correctly", async ({
    page,
  }) => {
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");

    // Get first feature card link
    const firstLink = page
      .locator('[data-feature-cards-transformed] a[href^="/docs/"]')
      .first();

    if ((await firstLink.count()) === 0) {
      console.log("   ⚠️  No feature card links found, skipping click test");
      return;
    }

    const href = await firstLink.getAttribute("href");
    const title = await firstLink.textContent();

    // Click the link
    await firstLink.click();
    await page.waitForTimeout(500);

    // Verify navigation occurred
    const currentUrl = page.url();
    expect(currentUrl).toContain(href || "");

    console.log(`   ✅ Clicked "${title?.trim()}" → navigated to ${currentUrl}`);
  });

  test("feature cards should have proper grid layout", async ({ page }) => {
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");

    // Check the grid container exists
    const gridContainer = page.locator("[data-feature-cards-transformed]");
    await expect(gridContainer).toBeVisible();

    // Verify it has the grid classes
    const classes = await gridContainer.getAttribute("class");
    expect(classes).toContain("grid");

    console.log(`   ✅ Feature cards grid container has proper layout classes`);
  });
});
