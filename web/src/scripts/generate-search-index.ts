import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

interface SearchDocument {
  id: string;
  title: string;
  description?: string;
  content: string;
  headings: string[];
  path: string;
  section?: string;
  type?: string;
  keywords?: string[];
  lastModified?: string;
  codeBlocks?: string[];
  anchor?: string; // For heading-specific entries
  parentTitle?: string; // For showing context in search results
}

interface HeadingSection {
  level: number;
  title: string;
  anchor: string;
  content: string;
  startPos: number;
  endPos: number;
}

// Convert heading text to URL-safe anchor
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-"); // Replace multiple hyphens with single
}

// Extract content sections for each heading
function extractHeadingSections(content: string): HeadingSection[] {
  const sections: HeadingSection[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const matches = [...content.matchAll(headingRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const level = match[1].length;
    const title = match[2].trim();
    const startPos = match.index || 0;
    const endPos =
      i < matches.length - 1
        ? matches[i + 1].index || content.length
        : content.length;

    // Only index H2 and H3 headings as separate entries
    if (level >= 2 && level <= 3) {
      const sectionContent = content.substring(startPos, endPos).trim();

      sections.push({
        level,
        title,
        anchor: slugify(title),
        content: sectionContent,
        startPos,
        endPos,
      });
    }
  }

  return sections;
}

async function extractTextFromMDX(content: string): Promise<{
  text: string;
  codeBlocks: string[];
}> {
  // Remove frontmatter
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, "");

  // Extract code blocks for separate indexing
  const codeBlocks: string[] = [];
  const textWithoutCode = withoutFrontmatter.replace(
    /```[\s\S]*?```/g,
    (match) => {
      const codeContent = match.replace(/```\w*\n?/, "").replace(/```$/, "");
      codeBlocks.push(codeContent);
      return " [code block] "; // Placeholder to maintain context
    }
  );

  // Remove MDX/JSX components and imports
  let text = textWithoutCode
    .replace(/import\s+.*?from\s+['"].*?['"]/g, "")
    .replace(/{\/\*.*?\*\/}/g, "") // Remove comments
    .replace(/\{[^}]*\}/g, " "); // Keep space for JSX expressions

  // Repeatedly remove HTML/JSX tags to prevent injection from nested tags
  let previous;
  do {
    previous = text;
    text = text
      .replace(/<([A-Z][a-zA-Z0-9]*)[^>]*>[\s\S]*?<\/\1>/g, "") // Remove JSX components
      .replace(/<[^>]*\/>/g, ""); // Self-closing tags
  } while (text !== previous);

  // Remove inline code backticks but keep content
  text = text.replace(/`([^`]+)`/g, "$1");

  // Extract and preserve important information from markdown
  text = text
    .replace(/#{1,6}\s+/g, "") // Headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links - keep link text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/_([^_]+)_/g, "$1") // Italic
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // Images - keep alt text
    .replace(/^[-*]\s+/gm, "") // List items
    .replace(/^\d+\.\s+/gm, "") // Numbered lists
    .replace(/^>\s+/gm, "") // Blockquotes
    .replace(/\|/g, " "); // Table separators

  // Clean up extra whitespace
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();

  return { text, codeBlocks };
}

function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push(match[1].trim());
  }

  return headings;
}

async function extractKeywords(
  content: string,
  title: string
): Promise<string[]> {
  const keywords: string[] = [];

  // Extract keywords from title
  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 && !["with", "from", "this", "that", "have"].includes(w)
    );
  keywords.push(...titleWords);

  // Extract potential keywords from content (frequent important words)
  const words = content.toLowerCase().split(/\s+/);
  const wordFreq = new Map<string, number>();

  for (const word of words) {
    if (
      word.length > 4 &&
      !["which", "where", "there", "these", "those"].includes(word)
    ) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  // Get top frequent words as keywords
  const sorted = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  keywords.push(...sorted);

  // Remove duplicates
  return [...new Set(keywords)];
}

async function indexDirectory(
  dir: string,
  baseRoute: string,
  type: string
): Promise<SearchDocument[]> {
  const documents: SearchDocument[] = [];

  try {
    const files = await fs.readdir(dir);
    const mdxFiles = files.filter(
      (f) => f.endsWith(".mdx") || f.endsWith(".md")
    );

    for (const file of mdxFiles) {
      // Skip quickstart.mdx as its content should be in the main docs
      // Skip index.mdx to avoid duplicate indexing of main page
      if (
        file === "quickstart.mdx" ||
        file === "quickstart.md" ||
        file === "index.mdx" ||
        file === "index.md"
      ) {
        continue;
      }

      const filePath = path.join(dir, file);

      // Use file handle to avoid TOCTOU vulnerability
      let fh;
      let stats;
      let rawContent;

      try {
        fh = await fs.open(filePath, "r");
        stats = await fh.stat();
        rawContent = await fh.readFile("utf-8");
      } finally {
        await fh?.close();
      }

      // Parse frontmatter
      const { data: frontmatter, content } = matter(rawContent);

      // Extract text content, code blocks, and headings
      const { text: textContent, codeBlocks } =
        await extractTextFromMDX(content);
      const headings = extractHeadings(content);

      // Extract keywords
      const keywords = await extractKeywords(
        textContent,
        frontmatter.title || file.replace(/\.mdx?$/, "")
      );

      // Create document path
      const fileName = file.replace(/\.mdx?$/, "");
      const docPath =
        fileName === "index" ? baseRoute : `${baseRoute}/${fileName}`;

      // Determine section/category
      const section = frontmatter.category || frontmatter.section || type;

      const docTitle = frontmatter.title || fileName.replace(/-/g, " ");

      // Add main document entry
      documents.push({
        id: `${type}-${fileName}`,
        title: docTitle,
        description: frontmatter.description || frontmatter.excerpt,
        content: textContent,
        headings,
        path: docPath,
        section,
        type,
        keywords,
        lastModified: stats.mtime.toISOString(),
        codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
      });

      // Extract heading sections and create individual entries for H2 and H3
      const headingSections = extractHeadingSections(content);

      for (const headingSection of headingSections) {
        // Extract text and code blocks for this section
        const { text: sectionText, codeBlocks: sectionCodeBlocks } =
          await extractTextFromMDX(headingSection.content);

        // Extract keywords for this section
        const sectionKeywords = await extractKeywords(
          sectionText,
          headingSection.title
        );

        documents.push({
          id: `${type}-${fileName}-${headingSection.anchor}`,
          title: headingSection.title,
          description: sectionText.substring(0, 150), // First 150 chars as description
          content: sectionText,
          headings: [headingSection.title], // Only this heading
          path: `${docPath}#${headingSection.anchor}`,
          section,
          type,
          keywords: sectionKeywords,
          lastModified: stats.mtime.toISOString(),
          codeBlocks:
            sectionCodeBlocks.length > 0 ? sectionCodeBlocks : undefined,
          anchor: headingSection.anchor,
          parentTitle: docTitle,
        });
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not index directory ${dir}:`, error);
  }

  return documents;
}

async function generateSearchIndex() {
  const outputPath = path.join(
    process.cwd(),
    "src",
    "data",
    "search-index.json"
  );

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const documents: SearchDocument[] = [];

  // Index documentation
  const docsDir = path.join(process.cwd(), "src", "content", "docs");
  const docsDocs = await indexDirectory(docsDir, "/docs", "Documentation");
  documents.push(...docsDocs);

  // Sort documents by title
  documents.sort((a, b) => a.title.localeCompare(b.title));

  // Write the search index
  await fs.writeFile(outputPath, JSON.stringify(documents, null, 2));

  console.log(`✅ Generated search index with ${documents.length} documents`);
  console.log(`📝 Output: ${outputPath}`);

  // Show summary by type
  const byType = documents.reduce(
    (acc, doc) => {
      const type = doc.type || "Other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log("\nDocuments indexed by type:");
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  - ${type}: ${count} documents`);
  }
}

// Run the script
generateSearchIndex().catch(console.error);
