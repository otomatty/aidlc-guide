/** Run the same checksum-pinned actionlint release locally and on every CI OS. */
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import release from "./actionlint-release.json";
import {
  DOCTOR_DATA_INPUTS,
  doctorScopeGaps,
  duplicatePushRuns,
  permissionEscalations,
  type Workflow,
} from "./ci-workflow-policy.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Select the pinned archive and SHA-256 for Node/Bun platform and architecture names.
 * Throws when the release manifest has no matching asset; never falls back to another build.
 */
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

/**
 * Require archive bytes to match the manifest's lowercase hexadecimal SHA-256.
 * Throws on mismatch so downloaded and cached archives are rejected before extraction.
 */
export function verifyChecksum(bytes: Uint8Array, expected: string): void {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(`actionlint: SHA-256 mismatch; expected ${expected}, got ${actual}`);
  }
}

/**
 * Git-for-Windows `tar` is GNU tar and cannot extract the actionlint zip.
 * Windows ships bsdtar as System32\\tar.exe, which can.
 */
export function tarExecutable(
  platform: string = process.platform,
  systemRoot: string | undefined = process.env.SystemRoot,
): string {
  if (platform !== "win32") return "tar";
  return path.win32.join(
    systemRoot && systemRoot.length > 0 ? systemRoot : "C:\\Windows",
    "System32",
    "tar.exe",
  );
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Validate workflow/job queue settings unsupported by actionlint until issue #680 is fixed.
 * Throws for unknown queue values or cancellation combined with queue: max.
 * @see https://github.com/rhysd/actionlint/issues/680
 */
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

/**
 * Run the repository's own workflow rules (see ci-workflow-policy.ts) against
 * the parsed workflows and the checked-in main ruleset.
 */
async function workflowPolicyViolations(workflows: Map<string, Workflow>): Promise<string[]> {
  const ruleset = record(
    JSON.parse(
      await readFile(path.join(repoRoot, ".github", "rulesets", "main-quality.json"), "utf8"),
    ),
  );
  const checks = (Array.isArray(ruleset.rules) ? ruleset.rules : [])
    .map(record)
    .find((rule) => rule.type === "required_status_checks");
  const parameters = record(checks?.parameters);
  const contexts = (
    Array.isArray(parameters.required_status_checks) ? parameters.required_status_checks : []
  ).flatMap((check) => {
    const context = record(check).context;
    return typeof context === "string" ? [context] : [];
  });
  const violations = [
    ...permissionEscalations(workflows),
    ...duplicatePushRuns(
      workflows,
      contexts,
      parameters.strict_required_status_checks_policy === true,
    ),
  ];
  const doctor = workflows.get("doctor-contract.yml");
  try {
    if (doctor === undefined) throw new Error("doctor-contract.yml is missing");
    for (const file of doctorScopeGaps(repoRoot, doctor, DOCTOR_DATA_INPUTS)) {
      violations.push(
        `doctor-contract.yml: DOCTOR_INPUTS does not cover ${file}, which the contract reads`,
      );
    }
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
  }
  return violations;
}

/**
 * Fetch on cache miss, verify the archive, and run actionlint from a temporary directory.
 * Returns actionlint's exit code; setup and queue-validation failures throw.
 * Removes the temporary directory after execution or failure.
 */
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
    const extraction = Bun.spawn(
      [tarExecutable(), "-xf", archivePath, "-C", temporary, binaryName],
      {
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    if ((await extraction.exited) !== 0) throw new Error("actionlint: archive extraction failed");
    const binary = path.join(temporary, binaryName);
    if (process.platform !== "win32") await chmod(binary, 0o755);
    const workflows = (await readdir(path.join(repoRoot, ".github", "workflows")))
      .filter((name) => /\.ya?ml$/.test(name))
      .sort()
      .map((name) => path.join(repoRoot, ".github", "workflows", name));
    if (workflows.length === 0) throw new Error("actionlint: no workflows found");
    const parsed = new Map<string, Workflow>();
    for (const workflow of workflows) {
      try {
        const document = Bun.YAML.parse(await readFile(workflow, "utf8"));
        validateConcurrencyQueues(document);
        parsed.set(path.basename(workflow), record(document));
      } catch (error) {
        throw new Error(`${workflow}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const policy = await workflowPolicyViolations(parsed);
    if (policy.length > 0) {
      for (const violation of policy) console.error(`workflow policy: ${violation}`);
      return 1;
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
