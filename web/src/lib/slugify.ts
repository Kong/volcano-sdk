/**
 * Generate slug from heading text
 * Must match rehype-slug + rehype-clean-ids behavior
 */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      // Remove all non-alphanumeric characters except spaces and hyphens
      // This removes emojis, dots, special characters, etc.
      .replace(/[^\w\s-]/g, "")
      // Replace whitespace with hyphens
      .replace(/\s+/g, "-")
      // Collapse multiple hyphens
      .replace(/-+/g, "-")
      // Remove leading/trailing hyphens (matches rehype-clean-ids)
      .replace(/^-+|-+$/g, "")
  );
}
