import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectVersionGate } from "../src/version/gate.ts";

const TARGET = "2.11.0";
let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "version-gate-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(rel: string, text: string): void {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** A native-install harness tree stamped with `version`. */
function nativeTool(dir: ".claude" | ".cursor" | ".aidlc", distribution: string, version: string) {
  write(
    path.join(dir, "tools", "data", "aidlc-stamp.json"),
    JSON.stringify({ schemaVersion: 1, frameworkVersion: version, distribution }),
  );
}

/** A copy-channel tree: the version file is the engine itself. */
function copyClaude(version: string) {
  write(path.join(".claude", "skills", "aidlc", "SKILL.md"), "# aidlc\n");
  write(
    path.join(".claude", "tools", "aidlc-version.ts"),
    `export const AIDLC_VERSION = "${version}";\n`,
  );
}

const engine = (version: string | null) => vi.fn(() => version);

describe("inspectVersionGate", () => {
  it("reports not-installed when no harness is present, even with a pin", () => {
    write(".aidlc-version", `${TARGET}\n`);
    const gate = inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) });
    expect(gate.status).toBe("not-installed");
    expect(gate.tools).toEqual([]);
  });

  it("is ok when every native tree, the pin, and the engine match the target", () => {
    nativeTool(".claude", "claude", TARGET);
    nativeTool(".cursor", "cursor", TARGET);
    write(".aidlc-version", `${TARGET}\n`);
    const gate = inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) });
    expect(gate).toMatchObject({
      status: "ok",
      target: TARGET,
      pin: TARGET,
      engine: TARGET,
      native: true,
    });
    expect(gate.tools.map((tool) => [tool.id, tool.version])).toEqual([
      ["cursor", TARGET],
      ["claude", TARGET],
    ]);
  });

  it("asks for the project update when any recorded version is older", () => {
    nativeTool(".claude", "claude", TARGET);
    nativeTool(".cursor", "cursor", "2.10.0");
    const gate = inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) });
    expect(gate.status).toBe("project-older");
    expect(gate.message).toContain("2.10.0");
  });

  it("treats an older pin alone as an older project", () => {
    nativeTool(".claude", "claude", TARGET);
    write(".aidlc-version", "2.10.0\n");
    expect(inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) }).status).toBe(
      "project-older",
    );
  });

  it("asks for a Guide update when any version is newer, ahead of an older one", () => {
    nativeTool(".claude", "claude", "2.12.0");
    nativeTool(".cursor", "cursor", "2.10.0");
    const gate = inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) });
    expect(gate.status).toBe("project-newer");
    expect(gate.message).toContain("2.12.0");
  });

  it("reports unknown for a pin it cannot read", () => {
    nativeTool(".claude", "claude", TARGET);
    write(".aidlc-version", "latest\n");
    expect(inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) }).status).toBe(
      "unknown",
    );
  });

  it("reports unknown for a detected harness without a version", () => {
    write(path.join(".claude", "skills", "aidlc", "SKILL.md"), "# aidlc\n");
    expect(inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) }).status).toBe(
      "unknown",
    );
  });

  it("reports unknown for an unparseable version file", () => {
    write(path.join(".claude", "skills", "aidlc", "SKILL.md"), "# aidlc\n");
    write(path.join(".claude", "tools", "aidlc-version.ts"), "export const AIDLC_VERSION = x;\n");
    expect(inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) }).status).toBe(
      "unknown",
    );
  });

  it("reports unknown for harnesses that cannot share a workspace", () => {
    nativeTool(".aidlc", "copilot", TARGET);
    write(path.join(".github", "skills", "aidlc", "SKILL.md"), "# aidlc\n");
    write(path.join(".opencode", "command", "aidlc.md"), "# aidlc\n");
    const gate = inspectVersionGate(root, TARGET, { readEngine: engine(TARGET) });
    expect(gate.status).toBe("unknown");
    expect(gate.message).toContain("opencode");
  });

  it("asks for this machine's engine when the native project matches but no engine resolves", () => {
    nativeTool(".claude", "claude", TARGET);
    write(".aidlc-version", `${TARGET}\n`);
    const gate = inspectVersionGate(root, TARGET, { readEngine: engine(null) });
    expect(gate.status).toBe("engine-mismatch");
    expect(gate.engine).toBeNull();
  });

  it("asks for this machine's engine when it resolves another version", () => {
    nativeTool(".claude", "claude", TARGET);
    const gate = inspectVersionGate(root, TARGET, { readEngine: engine("2.10.0") });
    expect(gate.status).toBe("engine-mismatch");
    expect(gate.engine).toBe("2.10.0");
  });

  it("does not consult the machine engine for a copy-channel project", () => {
    copyClaude(TARGET);
    const readEngine = engine(null);
    const gate = inspectVersionGate(root, TARGET, { readEngine });
    expect(gate).toMatchObject({ status: "ok", native: false, engine: null });
    expect(readEngine).not.toHaveBeenCalled();
  });

  it("compares a copy-channel project like any other recorded version", () => {
    copyClaude("2.10.0");
    expect(inspectVersionGate(root, TARGET, { readEngine: engine(null) }).status).toBe(
      "project-older",
    );
  });

  it("reports unknown when the target itself is not a version", () => {
    nativeTool(".claude", "claude", TARGET);
    expect(inspectVersionGate(root, "next", { readEngine: engine(TARGET) }).status).toBe(
      "unknown",
    );
  });

  it("reads the machine install by default", () => {
    nativeTool(".claude", "claude", TARGET);
    const previous = process.env.AIDLC_INSTALL_ROOT;
    process.env.AIDLC_INSTALL_ROOT = path.join(root, "no-install");
    try {
      expect(inspectVersionGate(root, TARGET).status).toBe("engine-mismatch");
    } finally {
      if (previous === undefined) delete process.env.AIDLC_INSTALL_ROOT;
      else process.env.AIDLC_INSTALL_ROOT = previous;
    }
  });
});
