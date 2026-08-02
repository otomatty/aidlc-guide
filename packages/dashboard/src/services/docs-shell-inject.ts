import type { DocsShellDeepLink, OfficialDocsLocale } from "@aidlc-guide/shared-types";

type DocsShellDeepLinkHandler = (deepLink: DocsShellDeepLink) => void;

const handlers = new Set<DocsShellDeepLinkHandler>();

/** Register a store dispatch for host `docs-shell-deeplink` injects (Bolt 3). */
export function onDocsShellDeepLink(handler: DocsShellDeepLinkHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function parseDocsShellDeepLink(data: Record<string, unknown>): DocsShellDeepLink | null {
  const locale = data.locale;
  if (locale !== "en" && locale !== "ja") return null;
  const deepLink: DocsShellDeepLink = { locale: locale as OfficialDocsLocale };
  if (typeof data.path === "string" && data.path.length >= 1) {
    deepLink.path = data.path;
  }
  if (typeof data.anchor === "string" && data.anchor !== "") {
    deepLink.anchor = data.anchor;
  }
  return deepLink;
}

/** Deliver a parsed deep-link to every registered handler. */
export function deliverDocsShellDeepLink(deepLink: DocsShellDeepLink): void {
  for (const handler of handlers) {
    handler(deepLink);
  }
}
