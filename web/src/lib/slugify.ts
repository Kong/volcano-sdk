/**
 * Generate slug from heading text
 * Must match rehype-slug behavior exactly
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "") // Remove &
    .replace(/\s+/g, "-") // Spaces to dashes
    .replace(/[()]/g, "") // Remove parentheses
    .replace(/[?/]/g, "") // Remove ? and /
    .replace(/:/g, "") // Remove colons
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-+|-+$/g, "") // Remove leading/trailing dashes
    .trim();
}
