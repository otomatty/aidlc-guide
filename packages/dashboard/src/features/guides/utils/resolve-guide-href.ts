const GUIDE_HREF = /^(?:\.\/)?([a-z0-9][a-z0-9-]*)\.md(?:#.*)?$/i;

export function resolveGuideHref(href: string): string | null {
  const match = GUIDE_HREF.exec(href.trim());
  return match?.[1] === undefined ? null : `${match[1]}.md`;
}
