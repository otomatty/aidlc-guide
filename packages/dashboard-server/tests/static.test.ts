import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createStatic, type StaticServer } from "../src/static.ts";

let dist: string;
let statics: StaticServer;

beforeAll(async () => {
  dist = await mkdtemp(path.join(tmpdir(), "dist-"));
  await mkdir(path.join(dist, "assets"), { recursive: true });
  await writeFile(path.join(dist, "index.html"), "<!doctype html><div id=root></div>");
  await writeFile(path.join(dist, "assets", "main-B7xK92aQ.js"), "console.log(1)");
  await writeFile(path.join(dist, "favicon.ico"), "icon");
  statics = createStatic(dist, true);
});

describe("static serving (P-DS-5)", () => {
  it("serves index.html at the root", async () => {
    const response = await statics.handle("/");
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/html");
    await expect(response?.text()).resolves.toContain("id=root");
  });

  it("marks index.html no-cache so a rebuilt SPA reaches an open tab", async () => {
    const response = await statics.handle("/index.html");
    expect(response?.headers.get("cache-control")).toBe("no-cache");
  });

  it("marks a hashed asset immutable", async () => {
    const response = await statics.handle("/assets/main-B7xK92aQ.js");
    expect(response?.status).toBe(200);
    expect(response?.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response?.headers.get("content-type")).toContain("javascript");
  });

  it("does not pin an unhashed asset forever", async () => {
    const response = await statics.handle("/favicon.ico");
    expect(response?.headers.get("cache-control")).toBe("no-cache");
  });

  it("falls back to index.html for a client-side route", async () => {
    const response = await statics.handle("/units/reader-core");
    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toContain("id=root");
  });

  it("refuses to escape dist/ via traversal", async () => {
    await expect(statics.handle("/../../../../etc/passwd")).resolves.toBeNull();
  });

  it("serves nothing at all when dist/ was never built", async () => {
    const absent = createStatic(dist, false);
    expect(absent.present).toBe(false);
    await expect(absent.handle("/")).resolves.toBeNull();
  });
});
