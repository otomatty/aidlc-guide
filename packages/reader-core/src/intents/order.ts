export interface IntentRegistryIndex {
  byDirName: ReadonlyMap<string, Record<string, unknown>>;
  byLegacyName: ReadonlyMap<string, Record<string, unknown>>;
}

/** Index registered directories and legacy slug/UUID suffixes used by these names. */
export function indexIntentRecords(
  records: readonly Record<string, unknown>[],
  names: readonly string[],
): IntentRegistryIndex {
  const wanted = new Set(names);
  const suffixLengths = new Set<number>();
  for (const name of names) {
    const suffix = /-([0-9a-f]+)$/.exec(name)?.[1];
    if (suffix) suffixLengths.add(suffix.length);
  }

  const byDirName = new Map<string, Record<string, unknown>>();
  const byLegacyName = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    if (typeof record.dirName === "string" && !byDirName.has(record.dirName)) {
      byDirName.set(record.dirName, record);
    }
    if (record.dirName || typeof record.slug !== "string" || typeof record.uuid !== "string")
      continue;

    const uuidHex = record.uuid.replace(/-/g, "");
    for (const length of suffixLengths) {
      if (length > uuidHex.length) continue;
      const suffix = uuidHex.slice(-length);
      if (!/^[0-9a-f]+$/.test(suffix)) continue;
      const name = `${record.slug}-${suffix}`;
      if (wanted.has(name) && !byLegacyName.has(name)) byLegacyName.set(name, record);
    }
  }
  return { byDirName, byLegacyName };
}

/** Find a record by stored directory name, then by its legacy slug/UUID suffix. */
export function intentRecord(
  index: IntentRegistryIndex,
  dirName: string,
): Record<string, unknown> | undefined {
  return index.byDirName.get(dirName) ?? index.byLegacyName.get(dirName);
}

/** UUIDv7 stores Unix milliseconds in its first 48 bits. */
function creationTime(dirName: string, index: IntentRegistryIndex): number | null {
  const uuid = intentRecord(index, dirName)?.uuid;
  if (
    typeof uuid === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)
  ) {
    return Number.parseInt(uuid.slice(0, 8) + uuid.slice(9, 13), 16);
  }

  const dated = /^(\d{2})(\d{2})(\d{2})-/.exec(dirName);
  if (!dated) return null;
  const year = 2000 + Number(dated[1]);
  const month = Number(dated[2]);
  const day = Number(dated[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
    ? timestamp
    : null;
}

/** Newest creation first; names make ties and unknown dates deterministic. */
export function sortIntentNames(names: readonly string[], index: IntentRegistryIndex): string[] {
  const times = new Map(names.map((name) => [name, creationTime(name, index)]));
  return [...names].sort((a, b) => {
    const aTime = times.get(a) ?? null;
    const bTime = times.get(b) ?? null;
    if (aTime === null && bTime !== null) return 1;
    if (bTime === null && aTime !== null) return -1;
    if (aTime !== null && bTime !== null && aTime !== bTime) return bTime - aTime;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
