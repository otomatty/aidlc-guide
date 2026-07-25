import { describe, expect, it } from "vitest";
import { BtwFailure } from "../src/errors.ts";
import type { BtwCommand } from "../src/parse.ts";
import { basePlanArgs, plan, type SpawnPlan } from "../src/plan.ts";

const CWD = "/Users/dev/aidlc-guide";
const SESSION = "0199a1b2-c3d4-5e6f-8899-aabbccddeeff";

/**
 * S-BTW-1: every plan must carry `--permission-mode plan`. For an inline or
 * win32 plan the flags are literal argv elements; for the darwin plan they live
 * inside the AppleScript command line, so check both shapes.
 */
function carriesPlanMode(spawnPlan: SpawnPlan): boolean {
  const flat = spawnPlan.args.join(" ");
  const pattern = new RegExp(`'?${basePlanArgs[0]}'?\\s+'?${basePlanArgs[1]}'?`);
  return pattern.test(flat);
}

const ALL_MODES: Array<[string, BtwCommand]> = [
  ["side", { mode: "side" }],
  ["fork", { mode: "fork" }],
  ["headless", { mode: "headless", prompt: "what changed?" }],
];

describe("plan — S-BTW-1: plan mode in every mode", () => {
  it.each(ALL_MODES)("darwin/%s carries --permission-mode plan", (_name, command) => {
    expect(
      carriesPlanMode(plan(command, { platform: "darwin", cwd: CWD, sessionId: SESSION })),
    ).toBe(true);
  });

  it.each(ALL_MODES)("win32/%s carries --permission-mode plan", (_name, command) => {
    expect(
      carriesPlanMode(plan(command, { platform: "win32", cwd: CWD, sessionId: SESSION })),
    ).toBe(true);
  });
});

describe("plan — side", () => {
  it("plans a new Terminal window on darwin", () => {
    const result = plan({ mode: "side" }, { platform: "darwin", cwd: CWD });

    expect(result.launch).toBe("terminal");
    expect(result.platform).toBe("darwin");
    expect(result.command).toBe("osascript");
    expect(result.args[0]).toBe("-e");
    expect(result.args[1]).toContain("do script");
    expect(result.args[1]).toContain("'/Users/dev/aidlc-guide'");
  });

  it("plans a new console window on win32", () => {
    const result = plan({ mode: "side" }, { platform: "win32", cwd: CWD });

    expect(result.launch).toBe("terminal");
    expect(result.platform).toBe("win32");
    expect(result.command).toBe("cmd");
    expect(result.args).toEqual([
      "/c",
      "start",
      "btw",
      "cmd",
      "/k",
      "claude",
      "--permission-mode",
      "plan",
    ]);
  });

  it("rejects an unsupported platform", () => {
    expect(() => plan({ mode: "side" }, { platform: "linux", cwd: CWD })).toThrow(BtwFailure);
    expect(() => plan({ mode: "side" }, { platform: "linux", cwd: CWD })).toThrow(
      /unsupported platform "linux"/,
    );
  });
});

describe("plan — fork", () => {
  it("passes --fork-session with the resolved id on win32", () => {
    const result = plan({ mode: "fork" }, { platform: "win32", cwd: CWD, sessionId: SESSION });

    expect(result.args).toEqual([
      "/c",
      "start",
      "btw",
      "cmd",
      "/k",
      "claude",
      "--fork-session",
      SESSION,
      "--permission-mode",
      "plan",
    ]);
  });

  it("passes --fork-session with the resolved id on darwin", () => {
    const result = plan({ mode: "fork" }, { platform: "darwin", cwd: CWD, sessionId: SESSION });

    expect(result.args[1]).toContain(`--fork-session' '${SESSION}'`);
  });

  it("refuses to plan a fork without a resolved session id", () => {
    expect(() => plan({ mode: "fork" }, { platform: "darwin", cwd: CWD })).toThrow(BtwFailure);
  });
});

describe("plan — headless", () => {
  it("runs inline with no OS branch", () => {
    const darwin = plan({ mode: "headless", prompt: "why?" }, { platform: "darwin", cwd: CWD });
    const win32 = plan({ mode: "headless", prompt: "why?" }, { platform: "win32", cwd: CWD });

    expect(darwin).toEqual(win32);
    expect(darwin.launch).toBe("inline");
    expect(darwin.platform).toBeUndefined();
    expect(darwin.command).toBe("claude");
    expect(darwin.args).toEqual(["-p", "why?", "--permission-mode", "plan"]);
  });

  it("keeps a prompt with shell metacharacters intact as one argv element", () => {
    const prompt = '$(rm -rf /) && echo "pwned"; `id` | tee /tmp/x';
    const result = plan({ mode: "headless", prompt }, { platform: "win32", cwd: CWD });

    expect(result.args[1]).toBe(prompt);
    expect(result.args).toHaveLength(4);
  });

  it("refuses to plan a launch for help", () => {
    expect(() => plan({ mode: "help" }, { platform: "darwin", cwd: CWD })).toThrow(BtwFailure);
  });
});

describe("plan — quoting of awkward working directories (R-BTW-4)", () => {
  it("quotes a cwd containing spaces and & on darwin", () => {
    const cwd = "/Users/dev/my project & co";
    const result = plan({ mode: "side" }, { platform: "darwin", cwd });

    expect(result.args[1]).toContain("cd '/Users/dev/my project & co'");
  });

  it("escapes a single quote in the cwd on darwin", () => {
    const result = plan({ mode: "side" }, { platform: "darwin", cwd: "/Users/dev/o'brien" });

    // Two layers: the shell sees `'\''` (close, escaped quote, reopen); inside
    // the AppleScript literal that backslash is itself escaped, hence `\\`.
    expect(result.args[1]).toContain("cd '/Users/dev/o'\\\\''brien'");
  });

  it("escapes backslashes and double quotes for AppleScript", () => {
    const result = plan({ mode: "side" }, { platform: "darwin", cwd: '/Users/dev/a"b\\c' });

    // The AppleScript literal must not be terminated early by the inner quote.
    expect(result.args[1]).toContain('\\"');
    expect(result.args[1]).toContain("\\\\");
  });

  it("does not need to quote the cwd on win32 (inherited via spawn cwd)", () => {
    const result = plan({ mode: "side" }, { platform: "win32", cwd: "C:\\my project & co" });

    expect(result.args).not.toContain("C:\\my project & co");
  });
});
