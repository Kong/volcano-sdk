/**
 * Scrolls to a specific element within the docs-content container
 * @param elementId - The ID of the element to scroll to
 * @param offset - The offset from the top (default: 32px)
 * @returns true if scroll was successful, false if element or container not found
 */
export function scrollToDocElement(
  elementId: string,
  offset: number = 32
): boolean {
  const element = document.getElementById(elementId);
  const contentContainer = document.getElementById("docs-content");

  if (element && contentContainer) {
    const containerRect = contentContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const relativeTop =
      elementRect.top - containerRect.top + contentContainer.scrollTop;

    contentContainer.scrollTo({
      top: relativeTop - offset,
      behavior: "smooth",
    });
    return true;
  }
  return false;
}

/**
 * Scrolls to the top of the docs-content container
 * @returns true if scroll was successful, false if container not found
 */
export function scrollToDocTop(): boolean {
  const contentContainer = document.getElementById("docs-content");
  if (contentContainer) {
    contentContainer.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    return true;
  }
  return false;
}
