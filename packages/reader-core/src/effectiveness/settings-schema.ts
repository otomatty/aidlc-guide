import { isAbsolute } from "node:path";
import { objectOf } from "./usage.ts";

type RecordValue = Record<string, unknown>;
type Check = (value: unknown) => boolean;
const nonempty: Check = (value) => typeof value === "string" && value.trim().length > 0;
const boolean: Check = (value) => typeof value === "boolean";
const member =
  (values: readonly string[]): Check =>
  (value) =>
    typeof value === "string" && values.includes(value);
const effort = member(["low", "medium", "high", "xhigh", "max"]);
const profileName = /^[a-z0-9][a-z0-9-]*$/;
const bypass = member([
  "AIDLC_SKIP_ARTIFACT_GUARD",
  "AIDLC_SKIP_REVISION_BACKSTOP",
  "AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD",
  "AIDLC_SKIP_HUMAN_PRESENCE_GUARD",
  "AIDLC_DISABLE_ENSEMBLE_EVIDENCE",
  "AIDLC_DISABLE_PLAN_APPROVAL_GUARD",
  "AIDLC_DISABLE_REVIEWER_SCOPE_HOOK",
  "AIDLC_DISABLE_REVIEW_FREEZE_HOOK",
  "AIDLC_DISABLE_USAGE_TRACKING",
]);
function keys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function optional(value: RecordValue, key: string, check: Check): boolean {
  return value[key] === undefined || check(value[key]);
}
function entries(value: unknown, check: (key: string, entry: unknown) => boolean): boolean {
  const record = objectOf(value);
  return record !== null && Object.entries(record).every(([key, entry]) => check(key, entry));
}
function groups(value: unknown): boolean {
  return entries(value, (name, raw) => {
    const policy = objectOf(raw);
    return (
      member(["deciding", "reviewing", "writing-up"])(name) &&
      policy !== null &&
      keys(policy, ["effort"]) &&
      effort(policy.effort)
    );
  });
}
function models(value: unknown): boolean {
  if (value === null) return true;
  const model = objectOf(value);
  return (
    model !== null &&
    model.schemaVersion === 1 &&
    keys(model, ["schemaVersion", "preset", "groups", "agents", "profiles"]) &&
    optional(model, "preset", member(["thorough", "balanced", "minimal"])) &&
    optional(model, "groups", groups) &&
    optional(model, "agents", (raw) =>
      entries(raw, (name, entry) => {
        const agent = objectOf(entry);
        return (
          profileName.test(name) &&
          agent !== null &&
          keys(agent, ["effort", "model"]) &&
          optional(agent, "effort", effort) &&
          optional(agent, "model", (map) =>
            entries(
              map,
              (harness, id) =>
                member(["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"])(
                  harness,
                ) && nonempty(id),
            ),
          )
        );
      }),
    ) &&
    optional(model, "profiles", (raw) =>
      entries(raw, (name, entry) => {
        const profile = objectOf(entry);
        return (
          profileName.test(name) &&
          profile !== null &&
          keys(profile, ["groups"]) &&
          groups(profile.groups)
        );
      }),
    )
  );
}
function flags(value: unknown): boolean {
  if (value === null) return true;
  const flag = objectOf(value);
  return (
    flag !== null &&
    flag.schemaVersion === 1 &&
    keys(flag, [
      "schemaVersion",
      "defaultScope",
      "swarm",
      "hookDebug",
      "sensorTimeoutMs",
      "bypasses",
    ]) &&
    optional(
      flag,
      "defaultScope",
      (scope) => typeof scope === "string" && /^[a-z][a-z0-9-]*$/.test(scope),
    ) &&
    optional(flag, "swarm", boolean) &&
    optional(flag, "hookDebug", boolean) &&
    optional(
      flag,
      "sensorTimeoutMs",
      (timeout) => typeof timeout === "number" && Number.isInteger(timeout) && timeout > 0,
    ) &&
    optional(flag, "bypasses", (list) => Array.isArray(list) && list.every(bypass))
  );
}
function releaseUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

/** Validation parity with AI-DLC 2.8.0 normalizeAidlcSettings; no normalization or workspace execution. */
export function validUsageSettings(value: unknown, layer: string): value is RecordValue {
  const record = objectOf(value);
  const machineKeys = ["update-check", "offline", "release-base-url", "ca-bundle"];
  return (
    record !== null &&
    record.schemaVersion === 1 &&
    keys(record, ["$schema", "schemaVersion", "models", "flags", ...machineKeys]) &&
    (layer === "machine" || machineKeys.every((key) => record[key] === undefined)) &&
    optional(record, "$schema", nonempty) &&
    optional(record, "models", models) &&
    optional(record, "flags", flags) &&
    optional(record, "update-check", boolean) &&
    optional(record, "offline", boolean) &&
    optional(record, "release-base-url", releaseUrl) &&
    optional(record, "ca-bundle", (bundle) => typeof bundle === "string" && isAbsolute(bundle))
  );
}
