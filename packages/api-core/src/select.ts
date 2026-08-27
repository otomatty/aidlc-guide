/**
 * Dashboard view-pin election. Does not read `active-intent`.
 * Spec: docs/superpowers/specs/2026-08-27-dashboard-intent-view-pin-design.md §4.
 */
export function electSelected(all: readonly string[], persisted: string | null): string | null {
  if (persisted !== null && all.includes(persisted)) return persisted;
  if (all.length === 1) return all[0] ?? null;
  return null;
}

/** True when `name` is a listed intent directory, not a path. */
export function isIntentDirName(name: string, all: readonly string[]): boolean {
  if (name === "" || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return false;
  }
  return all.includes(name);
}
