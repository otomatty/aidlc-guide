/** Find the registry row for a record, including the pre-dirName registry format. */
export function intentRecord(
  records: readonly Record<string, unknown>[],
  dirName: string,
): Record<string, unknown> | undefined {
  return (
    records.find((record) => record.dirName === dirName) ??
    records.find((record) => {
      if (record.dirName || typeof record.slug !== "string" || typeof record.uuid !== "string")
        return false;
      if (!dirName.startsWith(`${record.slug}-`)) return false;
      const suffix = dirName.slice(record.slug.length + 1);
      return (
        /^[0-9a-f]+$/.test(suffix) && record.uuid.replace(/-/g, "").slice(-suffix.length) === suffix
      );
    })
  );
}

/** UUIDv7 stores Unix milliseconds in its first 48 bits. */
function creationTime(dirName: string, records: readonly Record<string, unknown>[]): number | null {
  const uuid = intentRecord(records, dirName)?.uuid;
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
export function sortIntentNames(
  names: readonly string[],
  records: readonly Record<string, unknown>[],
): string[] {
  const times = new Map(names.map((name) => [name, creationTime(name, records)]));
  return [...names].sort((a, b) => {
    const aTime = times.get(a) ?? null;
    const bTime = times.get(b) ?? null;
    if (aTime === null && bTime !== null) return 1;
    if (bTime === null && aTime !== null) return -1;
    if (aTime !== null && bTime !== null && aTime !== bTime) return bTime - aTime;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
