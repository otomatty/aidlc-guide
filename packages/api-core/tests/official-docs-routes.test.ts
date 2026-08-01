import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { routeRead, type ReadContext } from "../src/handlers/read.ts";

const workspaceRoot = join(import.meta.dirname, "../../..");

function ctx(): ReadContext {
  return {
    workspaceRoot,
    hostMode: false,
    reader: {} as ReadContext["reader"],
    bridge: {} as ReadContext["bridge"],
    recordDir: async () => ({ error: true, reason: "unused" }),
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
});

