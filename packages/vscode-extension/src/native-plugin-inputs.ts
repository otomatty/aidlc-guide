import { createHash } from "node:crypto";
import { lstat, readdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectHarnesses, type HarnessId } from "./harness-detect.ts";
import { HARNESS_DIRECTORIES } from "./native-harness-merge.ts";
import type { ConfigureNativeOptions, NativeInstall, SetupRunner } from "./native-setup.ts";

const KEY = /^[a-z][a-z0-9-]*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const COMPOSE_DIRS = [
  "agents",
  "contributions",
  "knowledge",
  "scopes",
  "sensors",
  "stages",
  "tools",
];
const MANIFEST_DIR: Record<HarnessId, string> = {
  claude: ".claude-plugin",
  cursor: ".cursor-plugin",
  codex: ".codex-plugin",
  copilot: ".plugin",
  opencode: ".opencode-plugin",
  kiro: ".kiro-plugin",
  "kiro-ide": ".kiro-plugin",
};
type Composition = { schemaVersion: 1; name: string; version: string; sourceHash: string };
type SourceState = {
  harness: HarnessId;
  version: string;
  selected: string[] | null;
  composed: Composition[];
};
type PackageInput = {
  name: string;
  version: string;
  root: string;
  hash: string;
  sourceHash: string;
};
export type PluginInputs = { hash: string; selected: string[] | null; packages: PackageInput[] };

const digest = (bytes: string | Buffer) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function unsupported(detail: string): never {
  throw new Error(
    `既存プラグインを同じ内容で再構成できないため、ツールの追加・更新を停止しました: ${detail}。プラグインの元パッケージと対象ツール向けの出力を復元し、公式の plugin sync で状態を確認してから再実行してください。`,
  );
}

async function stat(file: string) {
  try {
    const value = await lstat(file);
    if (value.isSymbolicLink() || (!value.isDirectory() && !value.isFile()))
      unsupported(`通常のファイルではありません: ${file}`);
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw error;
  }
}

async function bytes(file: string): Promise<Buffer | null> {
  const value = await stat(file);
  if (value === null) return null;
  if (!value.isFile()) unsupported(`ファイルではありません: ${file}`);
  return readFile(file);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parse(content: Buffer | null, file: string): Record<string, unknown> | null {
  if (content === null) return null;
  try {
    const value: unknown = JSON.parse(content.toString("utf8"));
    if (object(value)) return value;
  } catch {
    /* Report the source path below. */
  }
  return unsupported(`JSON の形式が不正です: ${file}`);
}

async function packageFiles(root: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const visit = async (relative: string) => {
    const file = path.join(root, relative);
    const value = await stat(file);
    if (value === null) unsupported(`元パッケージがありません: ${file}`);
    if (value.isDirectory()) {
      for (const name of (await readdir(file)).sort())
        await visit(relative ? `${relative}/${name}` : name);
    } else files.set(relative, await readFile(file));
  };
  await visit("");
  return files;
}

function packageHash(files: Map<string, Buffer>): string {
  return digest(JSON.stringify([...files].map(([name, value]) => [name, digest(value)])));
}

/** Match native pluginSourceHash, including text newline normalization. */
function sourceHash(files: Map<string, Buffer>): string {
  const hash = createHash("sha256");
  const sources = [...files]
    .filter(([name]) => COMPOSE_DIRS.includes(name.split("/")[0] ?? ""))
    .sort(([left], [right]) => left.localeCompare(right));
  for (const [name, content] of sources) {
    const text = content.toString("utf8");
    hash.update(name);
    hash.update("\0");
    hash.update(
      Buffer.from(text).equals(content) ? Buffer.from(text.replace(/\r\n?/g, "\n")) : content,
    );
  }
  return `sha256:${hash.digest("hex")}`;
}

function packageVersion(
  files: Map<string, Buffer>,
  harness: HarnessId,
  name: string,
): string | null {
  const manifest = parse(
    files.get(`${MANIFEST_DIR[harness]}/plugin.json`) ?? null,
    `${name} (${harness})`,
  );
  return manifest?.name === `aidlc-${name}` && typeof manifest.version === "string"
    ? manifest.version
    : null;
}

async function findPackage(
  root: string,
  target: HarnessId,
  state: SourceState,
  composition: Composition,
  install: NativeInstall,
): Promise<PackageInput> {
  const bases = [
    [
      path.dirname(path.dirname(install.executable)),
      `${state.version}/plugins/${composition.name}`,
    ],
    [root, `plugins/${composition.name}`],
    [root, `plugins/${composition.name}/dist`],
  ];
  for (const [trustedRoot, relative] of bases) {
    if (!trustedRoot || !relative) continue;
    const base = path.join(trustedRoot, relative);
    // An emitted package must remain inside its inspected installation/project tree.
    let ancestor = trustedRoot;
    for (const part of relative.split("/")) {
      ancestor = path.join(ancestor, part);
      if ((await stat(ancestor)) === null) break;
    }
    for (const [original, candidate] of [
      [path.join(base, state.harness), path.join(base, target)],
      [base, base],
    ] as const) {
      // A composed stamp names bytes and version, never an arbitrary path to execute.
      if (
        !(await stat(path.join(original, MANIFEST_DIR[state.harness], "plugin.json"))) ||
        !(await stat(path.join(candidate, MANIFEST_DIR[target], "plugin.json")))
      )
        continue;
      const source = await packageFiles(original);
      if (
        packageVersion(source, state.harness, composition.name) !== composition.version ||
        sourceHash(source) !== composition.sourceHash
      )
        continue;
      const destination = original === candidate ? source : await packageFiles(candidate);
      if (
        packageVersion(destination, target, composition.name) !== composition.version ||
        !destination.has("hooks/compose.ts")
      )
        continue;
      return {
        name: composition.name,
        version: composition.version,
        root: candidate,
        hash: packageHash(destination),
        sourceHash: sourceHash(destination),
      };
    }
  }
  return unsupported(
    `${composition.name} ${composition.version} の検証済み ${state.harness} 元パッケージまたは ${target} 向け出力が見つかりません`,
  );
}

/** Snapshot each relevant install; an addition must not silently choose between divergent graphs. */
export async function capturePluginInputs(
  root: string,
  target: HarnessId,
  install: NativeInstall,
): Promise<PluginInputs> {
  const detected = detectHarnesses(root).harnesses.map(({ id }) => id);
  const harnesses = detected.includes(target) ? [target] : detected;
  const captured: Array<[string, string | null]> = [];
  const states: SourceState[] = [];
  for (const harness of harnesses) {
    const data = path.join(root, HARNESS_DIRECTORIES[harness], "tools", "data");
    const capture = async (name: string) => {
      const content = await bytes(path.join(data, name));
      captured.push([`${harness}/${name}`, content === null ? null : digest(content)]);
      return content;
    };
    const metadata = parse(await capture("harness.json"), path.join(data, "harness.json"));
    let selected: string[] | null = null;
    if (metadata && Object.hasOwn(metadata, "plugins")) {
      if (
        !Array.isArray(metadata.plugins) ||
        !metadata.plugins.length ||
        !metadata.plugins.every(
          (name): name is string => typeof name === "string" && KEY.test(name),
        )
      )
        unsupported(`プラグイン選択が不正です: ${data}`);
      selected = [...new Set(metadata.plugins)].sort();
    }
    const stamp = parse(await capture("aidlc-stamp.json"), path.join(data, "aidlc-stamp.json"));
    const composed: Composition[] = [];
    const evidence = new Set<string>();
    if (await stat(data)) {
      for (const name of (await readdir(data)).sort()) {
        const match = /^plugin-(compose|owned|contrib)-([a-z][a-z0-9-]*)\.json$/.exec(name);
        if (!match?.[2]) continue;
        const key = match[2];
        evidence.add(key);
        const record = parse(await capture(name), path.join(data, name));
        if (match[1] !== "compose") continue;
        if (
          record?.schemaVersion !== 1 ||
          record.name !== key ||
          typeof record.version !== "string" ||
          !VERSION.test(record.version) ||
          typeof record.sourceHash !== "string" ||
          !HASH.test(record.sourceHash)
        )
          unsupported(`構成記録が不正です: ${name}`);
        composed.push(record as Composition);
      }
    }
    const graphBytes = await capture("stage-graph.json");
    if (graphBytes !== null) {
      let graph: unknown;
      try {
        graph = JSON.parse(graphBytes.toString("utf8"));
      } catch {
        unsupported(`ステージ構成を確認できません: ${data}`);
      }
      if (!Array.isArray(graph)) unsupported(`ステージ構成を確認できません: ${data}`);
      for (const node of graph)
        if (object(node) && typeof node.plugin === "string" && node.plugin !== "aidlc")
          evidence.add(node.plugin);
    }
    for (const name of [...evidence, ...(selected ?? []).filter((name) => name !== "aidlc")])
      if (!composed.some((plugin) => plugin.name === name))
        unsupported(`${name} の元パッケージを証明する構成記録がありません (${harness})`);
    if (
      composed.length &&
      (typeof stamp?.frameworkVersion !== "string" || !VERSION.test(stamp.frameworkVersion))
    )
      unsupported(`本体の版を確認できません: ${data}`);
    states.push({
      harness,
      version: String(stamp?.frameworkVersion ?? install.version),
      selected,
      composed,
    });
  }
  const state = states[0];
  const signature = (value: SourceState) =>
    JSON.stringify([value.selected, value.composed.map(({ name, version }) => [name, version])]);
  if (state && states.some((value) => signature(value) !== signature(state)))
    unsupported("既存ツール間でプラグインの選択または版が異なります");
  const packages: PackageInput[] = [];
  if (state) {
    for (const composition of state.composed) {
      const selectedPackage = await findPackage(root, target, state, composition, install);
      for (const peer of states.slice(1)) {
        const peerComposition = peer.composed.find(({ name }) => name === composition.name);
        if (!peerComposition) unsupported(`${composition.name} の構成記録が一致しません`);
        const other = await findPackage(root, target, peer, peerComposition, install);
        if (other.hash !== selectedPackage.hash)
          unsupported(`${composition.name} の元パッケージが既存ツール間で異なります`);
      }
      packages.push(selectedPackage);
    }
  }
  return {
    selected: state?.selected ?? null,
    packages,
    hash: digest(JSON.stringify([captured, packages])),
  };
}

/** Replay native plugin APIs on a pristine candidate, never copy generated source harness files. */
export async function applyCandidatePlugins(
  install: NativeInstall,
  candidate: string,
  target: HarnessId,
  inputs: PluginInputs,
  runner: SetupRunner,
  options: ConfigureNativeOptions = {},
): Promise<void> {
  if (inputs.selected === null && inputs.packages.length === 0) return;
  const checkCurrent = () => {
    options.signal?.throwIfAborted();
    if (options.isCurrent?.() === false) throw new Error("設定を中止しました。");
  };
  const harnessDir = HARNESS_DIRECTORIES[target];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AIDLC_HARNESS_DIR: harnessDir,
    AIDLC_HARNESS_NAME: target,
  };
  // Keep the native command independent of a host hook's ambient plugin root.
  for (const key of [
    "CLAUDE_PLUGIN_ROOT",
    "PLUGIN_ROOT",
    "AIDLC_PLUGIN_ROOT",
    "CLAUDE_PROJECT_DIR",
    "AIDLC_PROJECT_DIR",
  ])
    delete env[key];
  const command = async (args: string[], extra: NodeJS.ProcessEnv = {}) => {
    checkCurrent();
    const result = await runner(
      install.executable,
      ["engine", ...args, "--project-dir", candidate],
      candidate,
      { ...env, ...extra },
      options.signal,
    );
    checkCurrent();
    if (result.code !== 0)
      unsupported(result.stderr || result.stdout || "公式のプラグイン構成処理に失敗しました");
  };
  for (const plugin of inputs.packages) {
    if (packageHash(await packageFiles(plugin.root)) !== plugin.hash)
      unsupported(`${plugin.name} の元パッケージが確認後に変更されました`);
    await command(["plugin", "sync"], { AIDLC_PLUGIN_ROOT: plugin.root });
    if (packageHash(await packageFiles(plugin.root)) !== plugin.hash)
      unsupported(`${plugin.name} の元パッケージが構成中に変更されました`);
    const record = parse(
      await bytes(
        path.join(candidate, harnessDir, "tools", "data", `plugin-compose-${plugin.name}.json`),
      ),
      plugin.name,
    );
    if (
      record?.name !== plugin.name ||
      record.version !== plugin.version ||
      record.sourceHash !== plugin.sourceHash
    )
      unsupported(`${plugin.name} の再構成結果が元パッケージと一致しません`);
  }
  if (inputs.selected !== null) await command(["plugin", "select", inputs.selected.join(",")]);
  // Native selection may remove runners. Update only native's existing baseline rows.
  const manifestPath = path.join(candidate, harnessDir, "tools", "data", "aidlc-manifest.json");
  const manifest = parse(await bytes(manifestPath), manifestPath);
  if (!manifest || !object(manifest.files)) unsupported("設定候補のマニフェストを確認できません");
  for (const relative of Object.keys(manifest.files)) {
    if (
      !relative ||
      /[\\:\0]/.test(relative) ||
      relative.split("/").some((part) => !part || part === "." || part === "..")
    )
      unsupported(`管理対象のパスが不正です: ${relative}`);
    const content = await bytes(path.join(candidate, relative));
    if (content === null) delete manifest.files[relative];
    else manifest.files[relative] = digest(content);
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  // The pristine candidate contains no user records. Remove only native-created scratch;
  // method seeds and the space cursor are the only aidlc files eligible for import.
  const workspace = path.join(candidate, "aidlc");
  const clean = async (relative: string): Promise<void> => {
    const file = path.join(workspace, relative);
    const value = await stat(file);
    if (value === null) return;
    if (value.isDirectory()) {
      for (const name of await readdir(file)) await clean(relative ? `${relative}/${name}` : name);
      if (relative && !(await readdir(file)).length) await rmdir(file);
    } else if (relative !== "active-space" && !/^spaces\/[^/]+\/memory\//.test(relative))
      await unlink(file);
  };
  await clean("");
}
