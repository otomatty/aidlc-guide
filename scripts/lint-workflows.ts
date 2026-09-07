/** Run the same checksum-pinned actionlint release locally and on every CI OS. */
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import release from "./actionlint-release.json";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function assetFor(platform: string, architecture: string) {
  const platforms: Record<string, string | undefined> = {
    darwin: "darwin",
    linux: "linux",
    win32: "windows",
  };
  const architectures: Record<string, string | undefined> = { x64: "amd64", arm64: "arm64" };
  const os = platforms[platform];
  const arch = architectures[architecture];
  const suffix = `${os}_${arch}.${platform === "win32" ? "zip" : "tar.gz"}`;
  if (!Object.hasOwn(release.checksums, suffix)) {
    throw new Error(`actionlint: unsupported platform ${platform}/${architecture}`);
  }
  return {
    name: `actionlint_${release.version}_${suffix}`,
    checksum: release.checksums[suffix as keyof typeof release.checksums],
  };
}

export function verifyChecksum(bytes: Uint8Array, expected: string): void {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(`actionlint: SHA-256 mismatch; expected ${expected}, got ${actual}`);
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Temporary coverage for https://github.com/rhysd/actionlint/issues/680. */
export function validateConcurrencyQueues(workflow: unknown): void {
  const root = record(workflow);
  for (const scope of [root, ...Object.values(record(root.jobs)).map(record)]) {
    const concurrency = record(scope.concurrency);
    if (!Object.hasOwn(concurrency, "queue")) continue;
    if (concurrency.queue !== "single" && concurrency.queue !== "max") {
      throw new Error("concurrency.queue must be single or max");
    }
    if (
      concurrency.queue === "max" &&
      concurrency["cancel-in-progress"] !== undefined &&
      concurrency["cancel-in-progress"] !== false
    ) {
      throw new Error("queue: max requires cancel-in-progress to be false or omitted");
    }
  }
}

async function runActionlint(): Promise<number> {
  const asset = assetFor(process.platform, process.arch);
  const cacheRoot = path.join(repoRoot, "node_modules", ".cache", "actionlint");
  await mkdir(cacheRoot, { recursive: true });
  const cachedArchive = path.join(cacheRoot, asset.name);
  let archive: Uint8Array;
  try {
    archive = await readFile(cachedArchive);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const url = `https://github.com/rhysd/actionlint/releases/download/v${release.version}/${asset.name}`;
    console.log(
      `Downloading actionlint ${release.version} for ${process.platform}/${process.arch}`,
    );
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`actionlint download failed: HTTP ${response.status}`);
    archive = new Uint8Array(await response.arrayBuffer());
    verifyChecksum(archive, asset.checksum);
    await writeFile(cachedArchive, archive);
  }
  // Verify cached downloads too. Never reuse an unchecked executable.
  verifyChecksum(archive, asset.checksum);
  const temporary = await mkdtemp(path.join(cacheRoot, "run-"));
  try {
    const archivePath = path.join(temporary, asset.name);
    await writeFile(archivePath, archive);
    const binaryName = process.platform === "win32" ? "actionlint.exe" : "actionlint";
    const extraction = Bun.spawn(["tar", "-xf", archivePath, "-C", temporary, binaryName], {
      stdout: "inherit",
      stderr: "inherit",
    });
    if ((await extraction.exited) !== 0) throw new Error("actionlint: archive extraction failed");
    const binary = path.join(temporary, binaryName);
    if (process.platform !== "win32") await chmod(binary, 0o755);
    const workflows = (await readdir(path.join(repoRoot, ".github", "workflows")))
      .filter((name) => /\.ya?ml$/.test(name))
      .sort()
      .map((name) => path.join(repoRoot, ".github", "workflows", name));
    if (workflows.length === 0) throw new Error("actionlint: no workflows found");
    for (const workflow of workflows) {
      try {
        validateConcurrencyQueues(Bun.YAML.parse(await readFile(workflow, "utf8")));
      } catch (error) {
        throw new Error(`${workflow}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // Do not let optional tools on PATH change the gate between OSes.
    // actionlint 1.7.12 does not know GitHub's queue property. Validate its
    // value above and suppress only that exact unknown-key diagnostic.
    const child = Bun.spawn(
      [
        binary,
        "-shellcheck=",
        "-pyflakes=",
        "-ignore",
        '^unexpected key "queue" for "concurrency" section\\. expected one of "cancel-in-progress", "group"$',
        ...workflows,
      ],
      { cwd: repoRoot, stdout: "inherit", stderr: "inherit" },
    );
    return await child.exited;
  } finally {
    // mkdtemp created this directory beneath the repository's ignored cache.
    await rm(temporary, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    process.exitCode = await runActionlint();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
