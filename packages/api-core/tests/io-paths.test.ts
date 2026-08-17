import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { bridgeMap } from "@aidlc-guide/docs-bridge";
import { describe, expect, it } from "vitest";
import { routeRead } from "../src/handlers/read.ts";
import { createGuideService } from "../src/service.ts";

async function seedRecord(files: readonly string[]): Promise<string> {
  const recordDir = await mkdtemp(path.join(tmpdir(), "api-io-paths-"));
  for (const rel of files) {
    const absolute = path.join(recordDir, ...rel.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, `# ${path.basename(rel)}\n`);
  }
  return recordDir;
}

describe("GET /api/io-paths", () => {
  it("rejects a missing stage", async () => {
    const recordDir = await seedRecord([]);
    const service = createGuideService({ workspaceRoot: recordDir, recordDir });

    await expect(
      routeRead(service.readContext, new URL("http://localhost/api/io-paths")),
    ).resolves.toEqual({
      status: 400,
      body: { error: true, reason: "missing-stage" },
    });
  });

  it("returns not-found for an unknown stage", async () => {
    const recordDir = await seedRecord([]);
    const service = createGuideService({ workspaceRoot: recordDir, recordDir });

    await expect(
      routeRead(service.readContext, new URL("http://localhost/api/io-paths?stage=unknown-stage")),
    ).resolves.toEqual({
      status: 200,
      body: { error: true, reason: "not-found" },
    });
  });

  it("returns not-found for a prototype-chain stage name", async () => {
    const recordDir = await seedRecord([]);
    const service = createGuideService({ workspaceRoot: recordDir, recordDir });

    await expect(
      routeRead(service.readContext, new URL("http://localhost/api/io-paths?stage=__proto__")),
    ).resolves.toEqual({
      status: 200,
      body: { error: true, reason: "not-found" },
    });
  });

  it("normalizes padded stage for lookup, resolve, and response", async () => {
    const recordDir = await seedRecord([
      "construction/u/functional-design/business-rules.md",
      "construction/u/code-generation/code-summary.md",
    ]);
    const service = createGuideService({ workspaceRoot: recordDir, recordDir });

    const result = await routeRead(
      service.readContext,
      new URL("http://localhost/api/io-paths?stage=%20code-generation%20&unit=u"),
    );

    expect(result?.body).toMatchObject({
      ok: true,
      value: {
        stage: "code-generation",
        unit: "u",
        outputs: {
          "code-summary": "construction/u/code-generation/code-summary.md",
        },
      },
    });
  });

  it("maps every logical input and output for the selected unit", async () => {
    const recordDir = await seedRecord([
      "inception/requirements-analysis/requirements.md",
      "construction/reader-core/functional-design/rules.md",
      "construction/other-unit/functional-design/rules.md",
    ]);
    const service = createGuideService({ workspaceRoot: recordDir, recordDir });

    const result = await routeRead(
      service.readContext,
      new URL("http://localhost/api/io-paths?stage=functional-design&unit=reader-core"),
    );

    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({
      ok: true,
      value: {
        stage: "functional-design",
        unit: "reader-core",
        inputs: {
          requirements: "inception/requirements-analysis/requirements.md",
        },
        outputs: {
          rules: "construction/reader-core/functional-design/rules.md",
        },
      },
    });
    const body = result?.body as {
      ok: true;
      value: { inputs: Record<string, string | null>; outputs: Record<string, string | null> };
    };
    expect(Object.keys(body.value.inputs)).toEqual(bridgeMap.stages["functional-design"]?.inputs);
    expect(Object.keys(body.value.outputs)).toEqual(bridgeMap.stages["functional-design"]?.outputs);
    expect(body.value.outputs.rules).not.toContain("other-unit");
  });

  it("uses the domain-design I/O list for v7 application-design, keeping the on-disk slug", async () => {
    const recordDir = await seedRecord([
      "inception/application-design/components.md",
      "inception/application-design/decisions.md",
    ]);
    const service = createGuideService({ workspaceRoot: recordDir, recordDir });

    const result = await routeRead(
      service.readContext,
      new URL("http://localhost/api/io-paths?stage=application-design"),
    );

    expect(result?.status).toBe(200);
    expect(result?.body).toMatchObject({
      ok: true,
      value: {
        stage: "application-design",
        outputs: {
          components: "inception/application-design/components.md",
          decisions: "inception/application-design/decisions.md",
        },
      },
    });
    const body = result?.body as {
      ok: true;
      value: { inputs: Record<string, string | null>; outputs: Record<string, string | null> };
    };
    expect(Object.keys(body.value.inputs)).toEqual(bridgeMap.stages["domain-design"]?.inputs);
    expect(Object.keys(body.value.outputs)).toEqual(bridgeMap.stages["domain-design"]?.outputs);
  });
});
