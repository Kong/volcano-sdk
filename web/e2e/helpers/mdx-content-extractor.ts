import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface MDXTextContent {
  file: string;
  path: string;
  textContent: string[];
}

/**
 * Extract text content from MDX markdown
 * Removes code blocks, frontmatter, and extracts readable text
 */
export function extractTextContent(markdown: string): string[] {
  const textContent: string[] = [];

  // Remove code blocks (both ``` and indented code)
  let content = markdown.replace(/```[\s\S]*?```/g, "");

  // Remove inline code
  content = content.replace(/`[^`]+`/g, "");

  // Remove MDX/JSX components (like :::warning, <Component />, etc.)
  content = content.replace(/:::[a-z]+\[.*?\][\s\S]*?:::/g, "");
  content = content.replace(/:::[a-z]+/g, ""); // Remove ::: markers
  content = content.replace(/<[^>]+>/g, "");

  // Remove links but keep the text
  content = content.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

  // Remove images
  content = content.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "");

  // Remove bold and italic markers but keep the text
  content = content.replace(/\*\*([^*]+)\*\*/g, "$1"); // **bold**
  content = content.replace(/\*([^*]+)\*/g, "$1"); // *italic*
  content = content.replace(/__([^_]+)__/g, "$1"); // __bold__
  content = content.replace(/_([^_]+)_/g, "$1"); // _italic_

  // Remove headings markers but keep the text
  content = content.replace(/^#{1,6}\s+/gm, "");

  // Remove horizontal rules
  content = content.replace(/^[-*_]{3,}$/gm, "");

  // Remove blockquotes markers but keep the text
  content = content.replace(/^>\s+/gm, "");

  // Remove list markers but keep the text
  content = content.replace(/^[\s]*[-*+]\s+/gm, "");
  content = content.replace(/^[\s]*\d+\.\s+/gm, "");

  // Remove table formatting
  content = content.replace(/\|/g, " ");
  content = content.replace(/^[\s]*[-:]+[\s]*$/gm, "");

  // Split into lines and filter
  const lines = content.split("\n");

  for (const line of lines) {
    let trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip lines that are just dashes, equals, or colons (table separators, underlines)
    if (/^[-=:|\s]+$/.test(trimmed)) continue;

    // Skip lines with mostly dashes/colons (table separators)
    const dashCount = (trimmed.match(/[-:]/g) || []).length;
    if (dashCount > trimmed.length * 0.5) continue;

    // Skip lines that are very short or just punctuation
    const alphanumericCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
    if (alphanumericCount < 3) continue;

    // Remove any remaining asterisks or underscores used for formatting
    trimmed = trimmed.replace(/\*+/g, "").replace(/_+/g, "");
    trimmed = trimmed.trim();

    // Skip if after cleanup there's nothing substantial left
    if (trimmed.length < 3) continue;

    textContent.push(trimmed);
  }

  return textContent;
}

/**
 * Get all MDX files and their text content
 */
export function getAllMDXTextContent(docsDir: string): MDXTextContent[] {
  const results: MDXTextContent[] = [];

  const files = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => f !== "quickstart.mdx"); // Skip quickstart

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { content: markdown } = matter(fileContent);

    const textContent = extractTextContent(markdown);

    // Convert file path to route path
    let routePath = `/${file}`.replace(/\.mdx$/, "");

    if (routePath === "/index") {
      routePath = "/docs";
    } else {
      routePath = routePath.replace(/^\//, "/docs/");
    }

    results.push({
      file,
      path: routePath,
      textContent,
    });
  }

  return results;
}
