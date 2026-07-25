import { describe, expect, it } from "vitest";
import { BtwFailure } from "../src/errors.ts";
import { parse } from "../src/parse.ts";

describe("parse", () => {
  it("defaults to a side session", () => {
    expect(parse([])).toEqual({ mode: "side" });
  });

  it("recognises --fork", () => {
    expect(parse(["--fork"])).toEqual({ mode: "fork" });
  });

  it("recognises -p with a prompt", () => {
    expect(parse(["-p", "why is this failing?"])).toEqual({
      mode: "headless",
      prompt: "why is this failing?",
    });
  });

  it("recognises --prompt as an alias for -p", () => {
    expect(parse(["--prompt", "hello"])).toEqual({ mode: "headless", prompt: "hello" });
  });

  it("keeps a prompt containing shell metacharacters verbatim", () => {
    const prompt = '$(rm -rf /) && echo "pwned" `id`';
    expect(parse(["-p", prompt])).toEqual({ mode: "headless", prompt });
  });

  it.each([["--help"], ["-h"]])("recognises %s", (flag) => {
    expect(parse([flag])).toEqual({ mode: "help" });
  });

  it("lets --help win over other flags so help is always reachable", () => {
    expect(parse(["--fork", "--help"])).toEqual({ mode: "help" });
  });

  it("rejects --fork combined with -p", () => {
    expect(() => parse(["--fork", "-p", "hi"])).toThrow(BtwFailure);
    expect(() => parse(["--fork", "-p", "hi"])).toThrow(/cannot be combined/);
  });

  it("rejects -p with an empty prompt", () => {
    expect(() => parse(["-p", ""])).toThrow(/non-empty/);
  });

  it("rejects -p with a whitespace-only prompt", () => {
    expect(() => parse(["-p", "   "])).toThrow(/non-empty/);
  });

  it("rejects -p with no following argument", () => {
    expect(() => parse(["-p"])).toThrow(/requires a question/);
  });

  it("rejects unknown options", () => {
    expect(() => parse(["--yolo"])).toThrow(/unknown option "--yolo"/);
  });

  it("rejects bare positional arguments", () => {
    expect(() => parse(["what is this"])).toThrow(/unknown option/);
  });

  it("fails with a non-zero exit code", () => {
    try {
      parse(["--yolo"]);
      expect.unreachable("parse should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BtwFailure);
      expect((error as BtwFailure).code).toBeGreaterThan(0);
    }
  });
});
