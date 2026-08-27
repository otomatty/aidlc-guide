export interface OfficialDocHref {
  path: string;
  anchor: string | undefined;
}

const DOC_SECTIONS = new Set(["guide", "reference"]);

/**
 * When a directory href rewrote to README.md, pick a page that actually exists
 * in the TOC. Prefer the README when it is catalogued; otherwise the first
 * page under that folder. Without a catalog, the README rewrite stands.
 */
function landingForDirectory(
  readmePath: string,
  knownPaths: readonly string[] | undefined,
): string | null {
  if (knownPaths === undefined) return readmePath;
  if (knownPaths.includes(readmePath)) return readmePath;
  const prefix = readmePath.replace(/\/README\.md$/i, "/");
  return knownPaths.find((p) => p.startsWith(prefix) && p.toLowerCase().endsWith(".md")) ?? null;
}

/**
 * Resolve a markdown href against the current official-docs page path
 * (`guide/…` or `reference/…`). http(s), other schemes, path escapes, and
 * non-`.md` targets return null — the caller must not treat those as in-app
 * navigation.
 *
 * `knownPaths` is the flattened TOC. Directory hrefs use it so folders
 * without a README (e.g. `04-stages/`) land on a real page instead of 404.
 */
export function resolveOfficialDocHref(
  currentPath: string,
  href: string,
  knownPaths?: readonly string[],
): OfficialDocHref | null {
  const trimmed = href.trim();
  if (trimmed === "") return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return null;

  const current = currentPath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (current === "" || current.includes("\0")) return null;

  let pathname: string;
  let fragment: string;
  try {
    const url = new URL(trimmed, `https://docs.local/${current}`);
    if (url.hostname !== "docs.local") return null;
    pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    fragment = url.hash.startsWith("#") ? decodeURIComponent(url.hash.slice(1)) : "";
  } catch {
    return null;
  }

  let fromDirectory = false;
  if (pathname.endsWith("/")) {
    pathname = `${pathname}README.md`;
    fromDirectory = true;
  } else if (!pathname.toLowerCase().endsWith(".md")) {
    const last = pathname.slice(pathname.lastIndexOf("/") + 1);
    if (last.includes(".")) return null;
    pathname = `${pathname}/README.md`;
    fromDirectory = true;
  }

  if (pathname === "" || pathname.includes("\0") || pathname.includes("\\")) return null;
  if (pathname.split("/").some((part) => part === "" || part === "..")) return null;
  if (!pathname.toLowerCase().endsWith(".md")) return null;

  const slash = pathname.indexOf("/");
  if (slash <= 0) return null;
  const section = pathname.slice(0, slash);
  if (!DOC_SECTIONS.has(section)) return null;
  if (pathname.slice(slash + 1) === "") return null;

  if (fromDirectory) {
    const landing = landingForDirectory(pathname, knownPaths);
    if (landing === null) return null;
    pathname = landing;
  }

  return { path: pathname, anchor: fragment === "" ? undefined : fragment };
}
