import { readdir } from "node:fs/promises";
import { guardPath, mapBounded, readBounded, withResult } from "@aidlc-guide/core-utils";
import type {
  EffectivenessPayload,
  IntentEffectiveness,
  ReadResult,
} from "@aidlc-guide/shared-types";
import { parseState } from "../parse/state.ts";
import { deriveEffectiveness } from "./derive.ts";
import { type MeasurementEvent, parseMeasurementEvents, sortMeasurementEvents } from "./events.ts";
import { auditUsageSummary, ledgerUsage, objectOf, selectUsage } from "./usage.ts";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_INTENTS = 500;
const MAX_SHARDS = 128;
const MAX_EVENTS = 100_000;
const MAX_SCAN_BYTES = 64 * 1024 * 1024;
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/;

interface ScanBudget {
  remaining: number;
}
async function readFile(
  root: string,
  relative: string,
  budget: ScanBudget,
  limit = MAX_FILE_BYTES,
) {
  const guarded = await guardPath(root, relative);
  if (!("ok" in guarded)) return { ok: false as const, reason: "outside-record" };
  if (budget.remaining <= 0) return { ok: false as const, reason: "scan-budget-exceeded" };
  // Reserve before awaiting to keep parallel reads within one request budget.
  const reserved = Math.min(limit, budget.remaining);
  budget.remaining -= reserved;
  const read = await readBounded(guarded.value, reserved);
  if (read.ok) budget.remaining += reserved - Buffer.byteLength(read.value);
  else budget.remaining += reserved;
  return read;
}

async function jsonFile(
  root: string,
  relative: string,
  budget: ScanBudget,
  warnings: string[],
): Promise<unknown> {
  const read = await readFile(root, relative, budget);
  if (!read.ok) {
    if (read.reason !== "not-found") warnings.push(`${relative}: ${read.reason}`);
    return null;
  }
  try {
    return JSON.parse(read.value);
  } catch {
    warnings.push(`${relative}: invalid JSON`);
    return null;
  }
}

async function directory(
  root: string,
  relative: string,
  warnings: string[],
  directoriesOnly = false,
): Promise<string[]> {
  const guarded = await guardPath(root, relative);
  if (!("ok" in guarded)) {
    warnings.push(`${relative}: outside-record`);
    return [];
  }
  try {
    const entries = await readdir(guarded.value, { withFileTypes: true });
    if (directoriesOnly)
      for (const entry of entries) {
        if (entry.isSymbolicLink())
          warnings.push(`${relative}/${entry.name}: linked intent ignored`);
      }
    return entries
      .filter((entry) => !directoriesOnly || entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      warnings.push(`${relative}: unreadable directory`);
    return [];
  }
}

async function auditEvents(
  root: string,
  budget: ScanBudget,
  warnings: string[],
): Promise<MeasurementEvent[]> {
  const shards = (await directory(root, "audit", warnings)).filter((name) => name.endsWith(".md"));
  if (shards.length > MAX_SHARDS) warnings.push("audit shard limit reached");
  const reads = await mapBounded(shards.slice(0, MAX_SHARDS), 2, async (shard) => {
    const read = await readFile(root, `audit/${shard}`, budget);
    if (!read.ok) {
      warnings.push(`audit ${shard}: ${read.reason}`);
      return [];
    }
    const parsed = parseMeasurementEvents(read.value, shard);
    warnings.push(...parsed.warnings.slice(0, 50));
    return parsed.events;
  });
  const events = reads.flat();
  if (events.length > MAX_EVENTS) {
    warnings.push("audit event limit reached");
    events.length = MAX_EVENTS;
  }
  return sortMeasurementEvents(events);
}

/** Active-space comparison. No workflow engine execution, transcript reads or runtime writes. */
export function getEffectiveness(
  rootPath: string,
  now = Date.now(),
): Promise<ReadResult<EffectivenessPayload>> {
  return withResult(async () => {
    if (!Number.isFinite(now) || Math.abs(now) > 8.64e15)
      return { error: true, reason: "invalid measurement time" };
    const budget: ScanBudget = { remaining: MAX_SCAN_BYTES };
    const warnings: string[] = [];
    const cursor = await readFile(rootPath, "aidlc/active-space", budget, 4096);
    if (!cursor.ok && cursor.reason !== "not-found") return { error: true, reason: cursor.reason };
    const space = cursor.ok ? cursor.value.split(/\r?\n/)[0]?.trim() || "default" : "default";
    if (!SAFE_SEGMENT.test(space) || space === "." || space === "..")
      return { error: true, reason: "outside-record" };
    const intentRoot = `aidlc/spaces/${space}/intents`;
    const names = (await directory(rootPath, intentRoot, warnings, true)).filter(
      (name) => SAFE_SEGMENT.test(name) && name !== "." && name !== "..",
    );
    const catalog = await jsonFile(rootPath, `${intentRoot}/intents.json`, budget, warnings);
    const records = Array.isArray(catalog) ? catalog.map(objectOf).filter((r) => r !== null) : [];
    const ledger = await jsonFile(
      rootPath,
      "aidlc/.aidlc-sessions/usage-ledger.json",
      budget,
      warnings,
    );
    const rates = objectOf(
      await jsonFile(rootPath, ".claude/tools/data/model-rates.json", budget, warnings),
    );
    const knownModels = new Set(
      Object.entries(objectOf(rates?.rates) ?? {})
        .filter(([, value]) => {
          const rate = objectOf(value);
          return ["input", "output", "cacheWrite5m", "cacheWrite1h", "cacheRead"].every(
            (field) =>
              typeof rate?.[field] === "number" && Number.isFinite(rate[field]) && rate[field] >= 0,
          );
        })
        .map(([model]) => model),
    );
    if (names.length > MAX_INTENTS) warnings.push("intent limit reached");
    const intents = await mapBounded(
      names.slice(0, MAX_INTENTS),
      4,
      async (dirName): Promise<IntentEffectiveness | null> => {
        const record = `${intentRoot}/${dirName}`;
        const rowWarnings: string[] = [];
        const recordGuard = await guardPath(rootPath, record);
        if (!("ok" in recordGuard)) {
          warnings.push(`${dirName}: outside-record`);
          return null;
        }
        const state = await readFile(recordGuard.value, "aidlc-state.md", budget, 256 * 1024);
        if (!state.ok && state.reason === "not-found") return null;
        if (!state.ok) rowWarnings.push(`state: ${state.reason}`);
        const parsed = state.ok ? parseState(state.value) : null;
        const model = parsed && "ok" in parsed ? parsed.value : null;
        if (parsed && !("ok" in parsed))
          rowWarnings.push("state schema unavailable or unsupported");
        if (parsed && "ok" in parsed) rowWarnings.push(...(parsed.warnings ?? []));
        const metadata = records.find((r) => r.dirName === dirName);
        const id =
          typeof metadata?.uuid === "string" && /^[0-9a-f-]{16,64}$/i.test(metadata.uuid)
            ? metadata.uuid
            : null;
        const statusMatch = state.ok
          ? /^(?:-\s*)?\*\*Status\*\*:[ \t]*([^\r\n]{1,80})$/m.exec(state.value)
          : null;
        const events = model ? await auditEvents(recordGuard.value, budget, rowWarnings) : [];
        const measurements = deriveEffectiveness(events, now);
        const status =
          statusMatch?.[1]?.trim() ??
          (typeof metadata?.status === "string" ? metadata.status.slice(0, 80) : null);
        if (
          status &&
          /^(?:complete(?:d)?|cancelled|canceled|aborted|archived)$/i.test(status) &&
          !measurements.completedAt
        ) {
          measurements.elapsedMs = null;
          rowWarnings.push("terminal workflow state has no recorded completion boundary");
        }
        const usage = model
          ? selectUsage(
              ledgerUsage(ledger, space, dirName, id, knownModels, rowWarnings),
              auditUsageSummary(events, rowWarnings),
              rowWarnings,
            )
          : null;
        return {
          dirName,
          id,
          name: model?.project ?? dirName,
          scope: model?.scope ?? null,
          depth: model?.depth ?? null,
          status,
          ...measurements,
          usage,
          warnings: [...new Set([...rowWarnings, ...measurements.warnings])].slice(0, 100),
        };
      },
    );
    const value: EffectivenessPayload = {
      space,
      generatedAt: new Date(now).toISOString(),
      intents: intents.filter((row) => row !== null),
      warnings: [...new Set(warnings)].slice(0, 100),
    };
    return { ok: true, value, ...(warnings.length ? { warnings: value.warnings } : {}) };
  });
}
