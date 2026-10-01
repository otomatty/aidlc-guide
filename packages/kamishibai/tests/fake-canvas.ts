import type { Ctx2D } from "../src/node.ts";
import type { TextMeasurer } from "../src/text-layout.ts";

export interface Call {
  name: string;
  args: unknown[];
}

export type FakeContext = Ctx2D & { calls: Call[]; reset(): void };

/**
 * A 2D context that records every method call and property write, so tests
 * assert on what was drawn without a real canvas (Node and jsdom have none).
 */
export function fakeContext(): FakeContext {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { globalAlpha: 1 };
  const proxy = new Proxy(state, {
    get(target, prop) {
      if (prop === "calls") return calls;
      if (prop === "reset") return () => calls.splice(0);
      if (typeof prop === "string" && prop in target) return target[prop];
      if (prop === "measureText") return (s: string) => ({ width: [...s].length * 10 });
      return (...args: unknown[]) => {
        calls.push({ name: String(prop), args });
      };
    },
    set(target, prop, value) {
      target[String(prop)] = value;
      calls.push({ name: `set:${String(prop)}`, args: [value] });
      return true;
    },
  });
  return proxy as unknown as FakeContext;
}

export function fakeCanvas(ctx: FakeContext = fakeContext()) {
  return { width: 0, height: 0, ctx, getContext: () => ctx };
}

/** Every character is exactly one em wide: wrapping becomes arithmetic. */
export const emMeasurer: TextMeasurer = (font, text) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
  return [...text].length * size;
};

export function callsNamed(ctx: FakeContext, name: string): Call[] {
  return ctx.calls.filter((c) => c.name === name);
}
