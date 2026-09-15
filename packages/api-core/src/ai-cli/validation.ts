/** Vendor events are data. Only plain JSON records may be inspected. */
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
