import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { configureCliEnvironment, openCliTerminal } from "../src/cli-environment.ts";
import type { NativeInstall } from "../src/native-setup.ts";

const mocks = vi.hoisted(() => ({
  createTerminal: vi.fn(),
  show: vi.fn(),
  sendText: vi.fn(),
}));
vi.mock("vscode", () => ({ window: { createTerminal: mocks.createTerminal } }));

const native: NativeInstall = {
  executable: path.resolve("machine/versions/2.9.0/aidlc"),
  version: "2.9.0",
  binDir: path.resolve("machine with spaces/bin"),
};

function context() {
  const mutations = new Map<string, string>();
  const prepend = vi.fn((name: string, value: string) => mutations.set(name, value));
  const extension = {
    environmentVariableCollection: { prepend, persistent: true },
  } as unknown as ExtensionContext;
  return { extension, mutations, prepend };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createTerminal.mockReturnValue({ show: mocks.show, sendText: mocks.sendText });
});
afterEach(() => vi.unstubAllEnvs());

describe("CLI terminal environment", () => {
  it("prepends the launcher directory for future terminals without changing the host environment", () => {
    const { extension, prepend } = context();
    const before = { ...process.env };
    configureCliEnvironment(extension, native);
    expect(prepend).toHaveBeenCalledExactlyOnceWith("PATH", `${native.binDir}${path.delimiter}`);
    expect(extension.environmentVariableCollection.persistent).toBe(true);
    expect(process.env).toEqual(before);
  });

  it("replaces this extension's previous PATH entry when setup runs again", () => {
    const { extension, mutations } = context();
    configureCliEnvironment(extension, native);
    configureCliEnvironment(extension, native);
    const relocated = { ...native, binDir: path.resolve("other machine/bin") };
    configureCliEnvironment(extension, relocated);
    expect([...mutations]).toEqual([["PATH", `${relocated.binDir}${path.delimiter}`]]);
  });

  it("opens a fresh project terminal and checks the public CLI through its launcher", () => {
    const { extension } = context();
    const root = path.resolve("project with spaces/$(literal)");
    const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
    const beforePath = process.env[pathKey] ?? "";
    vi.stubEnv("AIDLC_TEST_ENVIRONMENT", "preserved");
    const terminal = openCliTerminal(extension, native, root);
    expect(mocks.createTerminal).toHaveBeenCalledExactlyOnceWith({
      name: "AI-DLC CLI",
      cwd: root,
      env: expect.objectContaining({
        [pathKey]: `${native.binDir}${path.delimiter}${beforePath}`,
        AIDLC_TEST_ENVIRONMENT: "preserved",
      }),
    });
    const env = mocks.createTerminal.mock.calls[0]?.[0].env as NodeJS.ProcessEnv;
    expect(env.AIDLC_PROJECT_DIR).toBe(process.env.AIDLC_PROJECT_DIR);
    expect(env.AIDLC_RUNTIME_ROOT).toBe(process.env.AIDLC_RUNTIME_ROOT);
    expect(env.AIDLC_VERSION).toBe(process.env.AIDLC_VERSION);
    expect(mocks.show).toHaveBeenCalledOnce();
    expect(mocks.sendText).toHaveBeenCalledExactlyOnceWith(
      process.platform === "win32" ? "aidlc.cmd --version" : "aidlc --version",
    );
    expect(terminal).toBe(mocks.createTerminal.mock.results[0]?.value);
  });

  it.each([
    "relative/bin",
    `${path.resolve("machine/bin")}${path.delimiter}${path.resolve("other/bin")}`,
    `${path.resolve("machine/bin")}\nextra`,
    `${path.resolve("machine/bin")}\0extra`,
  ])("rejects a PATH value that is not one absolute directory: %j", (binDir) => {
    const { extension, prepend } = context();
    expect(() =>
      openCliTerminal(extension, { ...native, binDir }, path.resolve("project")),
    ).toThrow("導入先の絶対パス");
    expect(prepend).not.toHaveBeenCalled();
    expect(mocks.createTerminal).not.toHaveBeenCalled();
  });

  it("propagates VS Code failures to the calling panel", () => {
    const { extension } = context();
    mocks.createTerminal.mockImplementation(() => {
      throw new Error("terminal unavailable");
    });
    expect(() => openCliTerminal(extension, native, path.resolve("project"))).toThrow(
      "terminal unavailable",
    );
    expect(mocks.sendText).not.toHaveBeenCalled();
  });
});
