import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type ReadContext, routeRead } from "../src/handlers/read.ts";

const workspaceRoot = join(import.meta.dirname, "../../..");

function ctx(officialDocsRoot: string = workspaceRoot): ReadContext {
  return {
    workspaceRoot,
    officialDocsRoot,
    hostMode: false,
    reader: {} as ReadContext["reader"],
    bridge: {} as ReadContext["bridge"],
    recordDir: async () => ({ error: true, reason: "unused" }),
    selected: () => null,
    matrix: () => null,
  };
}

describe("GET /api/official-docs (FR-U2.6)", () => {
  it("serves manifest", async () => {
    const result = await routeRead(ctx(), new URL("http://x/api/official-docs/manifest"));
    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({
      ok: true,
      value: { source: "aidlc-workflows" },
    });
  });

  it("serves an en page under /api/official-docs/:locale/*", async () => {
    const result = await routeRead(
      ctx(),
      new URL("http://x/api/official-docs/en/guide/getting-started.md"),
    );
    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({
      ok: true,
      value: { localeServed: "en", path: "guide/getting-started.md" },
    });
  });

  // The route takes the section from the URL, so a section added to the bundle
  // has to be reachable without a route change.
  it("serves a page from a section beyond guide and reference", async () => {
    const result = await routeRead(
      ctx(),
      new URL("http://x/api/official-docs/en/harness-engineering/00-overview.md"),
    );
    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({
      ok: true,
      value: { localeServed: "en", path: "harness-engineering/00-overview.md" },
    });
  });

  // `overview/README.md` is upstream's `docs/README.md`; the synthetic section
  // segment is what makes a docs-root page addressable at all.
  it("serves the docs-root landing page under overview", async () => {
    const result = await routeRead(
      ctx(),
      new URL("http://x/api/official-docs/en/overview/README.md"),
    );
    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({
      ok: true,
      value: { localeServed: "en", path: "overview/README.md" },
    });
  });

  it("serves missing_ja fallback as HTTP 200 with notice", async () => {
    const result = await routeRead(
      ctx(),
      new URL("http://x/api/official-docs/ja/reference/scopes.md"),
    );
    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({
      ok: true,
      value: {
        localeRequested: "ja",
        localeServed: "en",
        notice: "missing_ja",
        path: "reference/scopes.md",
      },
    });
  });

  it("maps not_found pages to HTTP 404", async () => {
    const result = await routeRead(
      ctx(),
      new URL("http://x/api/official-docs/en/guide/does-not-exist.md"),
    );
    expect(result?.status).toBe(404);
    expect(result?.body).toMatchObject({ error: true, reason: "not_found" });
  });

  it("does not collide with /api/guides", async () => {
    const unknown = await routeRead(ctx(), new URL("http://x/api/official-docs"));
    expect(unknown?.status).toBe(404);
  });

  it("rejects invalid locale", async () => {
    const result = await routeRead(
      ctx(),
      new URL("http://x/api/official-docs/de/guide/getting-started.md"),
    );
    expect(result?.body).toMatchObject({ error: true, reason: "path_rejected" });
  });

  it("reads official docs from officialDocsRoot, not workspaceRoot", async () => {
    const emptyWorkspace = join(import.meta.dirname, "fixtures-missing-workspace");
    const isolated = await routeRead(
      { ...ctx(workspaceRoot), workspaceRoot: emptyWorkspace },
      new URL("http://x/api/official-docs/en/guide/getting-started.md"),
    );
    expect(isolated?.status).toBe(200);
    expect(isolated?.body).toMatchObject({
      ok: true,
      value: { path: "guide/getting-started.md" },
    });
  });

  it("GET /api/official-docs/stage/:slug returns mapped ref or null", async () => {
    const mapped = await routeRead(
      ctx(),
      new URL("http://x/api/official-docs/stage/intent-capture"),
    );
    expect(mapped?.status).toBe(200);
    expect(mapped?.body).toMatchObject({
      ok: true,
      value: { path: "guide/getting-started.md", anchor: "approval-gates" },
    });

    const unmapped = await routeRead(
      ctx(),
      new URL("http://x/api/official-docs/stage/code-generation"),
    );
    expect(unmapped?.status).toBe(200);
    expect(unmapped?.body).toEqual({ ok: true, value: null });
  });
});
