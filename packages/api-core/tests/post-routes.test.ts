import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { handlePost, POST_ROUTE_PATHS, routePost } from "../src/handlers/post.ts";
import { createGuideService } from "../src/service.ts";

const STATE_MD = `# AI-DLC State Tracking

## Project Information
- **Project**: post routes test
- **Project Type**: Greenfield
- **Scope**: feature
- **State Version**: 8

## Scope Configuration
- **Depth**: Standard
- **Test Strategy**: Standard

## Execution Plan Summary
- **Total Stages**: 1
- **Completed**: 0

## Stage Progress

### IDEATION PHASE
- [ ] intent-capture — EXECUTE

## Current Status
- **Lifecycle Phase**: IDEATION
- **Current Stage**: intent-capture
- **Next Stage**: intent-capture
`;

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function seedService(names: string[]) {
  const root = await mkdtemp(path.join(tmpdir(), "post-routes-"));
  roots.push(root);
  for (const name of names) {
    const dir = path.join(root, "aidlc", "spaces", "default", "intents", name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "aidlc-state.md"), STATE_MD);
  }
  return createGuideService({ workspaceRoot: root });
}

function post(route: string, body: unknown): Request {
  return new Request(`http://localhost${route}`, { method: "POST", body: JSON.stringify(body) });
}

/**
 * The reason this module exists: the dashboard server and the VS Code session
 * used to keep their own dispatch tables, so a route could reach one host and
 * not the other. These assert the two transports stay a matched pair.
 */
describe("POST routing — one table, two transports", () => {
  it("serves the same route set on both transports", async () => {
    const service = await seedService(["a-intent"]);

    for (const route of POST_ROUTE_PATHS) {
      expect(await routePost(service, route, {}), `routePost ${route}`).not.toBeNull();
      expect(
        await handlePost(service, route, post(route, {})),
        `handlePost ${route}`,
      ).not.toBeNull();
    }
  });

  it("declares exactly the two documented writes", () => {
    expect([...POST_ROUTE_PATHS].sort()).toEqual(["/api/answer", "/api/select-intent"]);
  });

  it("reports an unrouted path as null on both transports, so each host picks its own status", async () => {
    const service = await seedService(["a-intent"]);

    expect(await routePost(service, "/api/nope", {})).toBeNull();
    expect(await handlePost(service, "/api/nope", post("/api/nope", {}))).toBeNull();
    // A GET route is not reachable by POST either — otherwise a client could
    // write to a read endpoint by changing the verb.
    expect(await routePost(service, "/api/workflow", {})).toBeNull();
  });

  it("routes select-intent to the pin, on both transports", async () => {
    const service = await seedService(["a-intent", "b-intent"]);

    const routed = await routePost(service, "/api/select-intent", { intent: "b-intent" });
    expect(routed?.status).toBe(200);
    expect(service.readContext.selected()).toBe("b-intent");

    const http = await handlePost(
      service,
      "/api/select-intent",
      post("/api/select-intent", { intent: "a-intent" }),
    );
    expect(http?.status).toBe(200);
    expect(service.readContext.selected()).toBe("a-intent");
  });

  it("keeps each route's own bad-body reply rather than re-mapping it centrally", async () => {
    const service = await seedService(["a-intent"]);

    const badIntent = await routePost(service, "/api/select-intent", { intent: 42 });
    expect(badIntent?.status).toBe(400);

    // answer-writer refuses a well-formed write to a non-questions file with
    // its own 403 vocabulary, not with select-intent's 400.
    const badAnswer = await routePost(service, "/api/answer", {
      file: "notes.md",
      line: 1,
      value: "x",
    });
    expect(badAnswer?.status).toBe(403);
    expect(badAnswer?.body).toEqual({ error: "not-a-questions-file" });
  });
});
