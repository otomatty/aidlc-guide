import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

/**
 * shadcn 4.21.0 is kept only as a byte copy of dist/tailwind.css. The CLI
 * package is the lockfile's only path to braces <= 3.0.3 (GHSA-vfj7-8cjw-p6xm).
 * These checks pin the variants and keyframes the dashboard classes use, the
 * provenance of that copy, and that the upstream MIT license is what the
 * dashboard and webview builds emit.
 */

const STYLES = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(STYLES, "vendor", "shadcn-4.21.0");
const DASHBOARD = path.resolve(STYLES, "../../..");
const REPO = path.resolve(DASHBOARD, "../..");

const CSS_SHA256 = "bc7d83425702955b4cb67cb14ede9d603f9d912376d57a2d81d661094d2a782a";
const LICENSE_SHA256 = "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f";
const INTEGRITY =
  "sha512-UU2mFNusW8C5rvadKdH69vERYZqUlOOlXBcf0MYhYLdTGP6DPti7X4qovCu+RTfCqsAgq/T+YfE0Vnttxh9aiw==";
const DISTRIBUTED_LICENSE = "shadcn-4.21.0-LICENSE.md";

const VARIANTS = [
  "data-open",
  "data-closed",
  "data-checked",
  "data-unchecked",
  "data-selected",
  "data-disabled",
  "data-active",
  "data-horizontal",
  "data-vertical",
] as const;

const VARIANT_MARKERS: Record<(typeof VARIANTS)[number], readonly string[]> = {
  "data-open": ['[data-state="open"]', '[data-open]:not([data-open="false"])'],
  "data-closed": ['[data-state="closed"]', '[data-closed]:not([data-closed="false"])'],
  "data-checked": ['[data-state="checked"]', '[data-checked]:not([data-checked="false"])'],
  "data-unchecked": ['[data-state="unchecked"]', '[data-unchecked]:not([data-unchecked="false"])'],
  "data-selected": ['[data-selected="true"]'],
  "data-disabled": ['[data-disabled="true"]', '[data-disabled]:not([data-disabled="false"])'],
  "data-active": ['[data-state="active"]', '[data-active]:not([data-active="false"])'],
  "data-horizontal": ['[data-orientation="horizontal"]'],
  "data-vertical": ['[data-orientation="vertical"]'],
};

const KEYFRAMES = [
  "accordion-down",
  "accordion-up",
  "scroll-fade-reveal-t",
  "scroll-fade-reveal-b",
  "scroll-fade-reveal-s",
  "scroll-fade-reveal-e",
  "tw-shimmer",
] as const;

type Lockfile = {
  workspaces: {
    "": { devDependencies: Record<string, string> };
    "packages/dashboard": { dependencies: Record<string, string> };
  };
  packages: Record<string, [string, ...unknown[]]>;
};

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function blocksStarting(source: string, header: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  while (from < source.length) {
    const at = source.indexOf(header, from);
    if (at < 0) break;
    const open = source.indexOf("{", at + header.length);
    if (open < 0) break;
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) break;
    blocks.push(source.slice(at, end + 1));
    from = end + 1;
  }
  return blocks;
}

function provenanceField(doc: string, name: string): string {
  const row = doc.split("\n").find((line) => line.startsWith(`| ${name} |`));
  expect(row, name).toBeDefined();
  return row?.split("|").map((cell) => cell.trim())[2] ?? "";
}

describe("vendored shadcn 4.21.0 tailwind.css", () => {
  it("matches the locked dist/tailwind.css bytes", () => {
    const cssPath = path.join(VENDOR, "tailwind.css");
    expect(existsSync(cssPath), cssPath).toBe(true);
    expect(sha256(readFileSync(cssPath))).toBe(CSS_SHA256);
  });

  it("keeps the custom variants and their state selectors", () => {
    const css = readFileSync(path.join(VENDOR, "tailwind.css"), "utf8");
    const names = [...css.matchAll(/@custom-variant\s+([^\s{]+)/g)].map((match) => match[1]);
    expect(names).toEqual([...VARIANTS]);
    for (const name of VARIANTS) {
      const block = blocksStarting(css, `@custom-variant ${name} `).join("\n");
      for (const marker of VARIANT_MARKERS[name]) expect(block).toContain(marker);
    }
  });

  it("keeps accordion, scroll-fade, and animation keyframes inside @theme", () => {
    const css = readFileSync(path.join(VENDOR, "tailwind.css"), "utf8");
    const names = [...css.matchAll(/@keyframes\s+([^\s{]+)/g)].map((match) => match[1]);
    expect(names).toEqual([...KEYFRAMES]);
    const themed = blocksStarting(css, "@theme inline").join("\n");
    for (const name of KEYFRAMES) expect(themed).toContain(`@keyframes ${name}`);
    expect(themed).toContain("--accordion-panel-height");
    expect(themed).toContain("--radix-accordion-content-height");
    expect(css).toContain("@utility scroll-fade-b {");
  });

  it("records provenance for the locked package and the license bytes", () => {
    const css = readFileSync(path.join(VENDOR, "tailwind.css"));
    const license = readFileSync(path.join(VENDOR, "LICENSE.md"));
    const doc = readFileSync(path.join(VENDOR, "PROVENANCE.md"), "utf8");
    expect(sha256(license)).toBe(LICENSE_SHA256);
    expect(license.toString("utf8").startsWith("MIT License\n")).toBe(true);
    expect(license.toString("utf8")).toContain("Copyright (c) 2023 shadcn\n");
    expect(provenanceField(doc, "package")).toBe("shadcn");
    expect(provenanceField(doc, "version")).toBe("4.21.0");
    expect(provenanceField(doc, "source path")).toBe("dist/tailwind.css");
    expect(provenanceField(doc, "export")).toBe("./tailwind.css");
    expect(provenanceField(doc, "integrity")).toBe(INTEGRITY);
    expect(provenanceField(doc, "repository")).toBe("https://github.com/shadcn-ui/ui.git");
    expect(provenanceField(doc, "repository directory")).toBe("packages/shadcn");
    expect(provenanceField(doc, "license")).toBe("MIT");
    expect(provenanceField(doc, "css sha256")).toBe(CSS_SHA256);
    expect(provenanceField(doc, "license sha256")).toBe(LICENSE_SHA256);
    expect(provenanceField(doc, "advisory")).toBe("GHSA-vfj7-8cjw-p6xm");
    expect(provenanceField(doc, "cve")).toBe("CVE-2026-93687");
    expect(provenanceField(doc, "distributed license")).toBe(DISTRIBUTED_LICENSE);
    expect(sha256(css)).toBe(provenanceField(doc, "css sha256"));
  });

  it("imports the local stylesheet and drops the shadcn CLI package", () => {
    const globals = readFileSync(path.join(STYLES, "globals.css"), "utf8");
    expect(globals).toContain('@import "./vendor/shadcn-4.21.0/tailwind.css";');
    expect(globals).not.toContain("shadcn/tailwind.css");

    const dashboard = JSON.parse(readFileSync(path.join(DASHBOARD, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const root = JSON.parse(readFileSync(path.join(REPO, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(dashboard.dependencies).not.toHaveProperty("shadcn");
    expect(dashboard.dependencies["@shadcn/react"]).toEqual(expect.any(String));
    expect(root.devDependencies["@shadcn/lint"]).toEqual(expect.any(String));

    const lock = parse(readFileSync(path.join(REPO, "bun.lock"), "utf8")) as Lockfile;
    expect(lock.workspaces["packages/dashboard"].dependencies).not.toHaveProperty("shadcn");
    expect(lock.workspaces["packages/dashboard"].dependencies).toHaveProperty("@shadcn/react");
    expect(lock.workspaces[""].devDependencies).toHaveProperty("@shadcn/lint");
    for (const [key, value] of Object.entries(lock.packages)) {
      expect(key).not.toBe("shadcn");
      expect(key).not.toBe("braces");
      expect(key.startsWith("shadcn/")).toBe(false);
      const spec = value[0];
      expect(spec.startsWith("shadcn@")).toBe(false);
      expect(spec.startsWith("braces@")).toBe(false);
    }
  });

  it("copies the upstream license into dashboard and webview build output", () => {
    const viteConfig = readFileSync(path.join(DASHBOARD, "vite.config.ts"), "utf8");
    expect(viteConfig).toContain("copyFileSync");
    expect(viteConfig).toContain("src/shared/styles/vendor/shadcn-4.21.0/LICENSE.md");
    expect(viteConfig).toContain(DISTRIBUTED_LICENSE);
    expect(viteConfig).toContain("copyShadcnLicense()");
    expect(viteConfig).toMatch(/plugins:\s*\[[^\]]*copyShadcnLicense\(\)/s);

    const maintenance = readFileSync(
      path.join(REPO, "docs/maintenance/dependency-quality.md"),
      "utf8",
    );
    expect(maintenance).toContain("GHSA-vfj7-8cjw-p6xm");
    expect(maintenance).toContain(CSS_SHA256);
    expect(maintenance).toContain("vendor/shadcn-4.21.0/tailwind.css");
    expect(maintenance).toContain(DISTRIBUTED_LICENSE);
  });
});
