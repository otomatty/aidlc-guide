/**
 * Bring a heading to the top of the reading area and move focus onto it, so a
 * keyboard or screen-reader user continues from the section they jumped to.
 * Shared by fragment links (AnchorApplier) and the page outline.
 */
export function focusHeading(node: HTMLElement): void {
  node.scrollIntoView({ block: "start" });
  if (!node.hasAttribute("tabindex")) node.tabIndex = -1;
  node.focus({ preventScroll: true });
}
