const LOOPBACK_NAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Only local same-origin pages may access mutable customization data. */
export function acceptsCustomizationOrigin(request: Request, developmentOrigin?: string): boolean {
  const target = new URL(request.url);
  if (!LOOPBACK_NAMES.has(target.hostname)) return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    const caller = new URL(origin);
    if (caller.origin === target.origin) return true;
    if (!developmentOrigin) return false;
    const development = new URL(developmentOrigin);
    return (
      LOOPBACK_NAMES.has(development.hostname) &&
      development.protocol === target.protocol &&
      caller.origin === development.origin
    );
  } catch {
    return false;
  }
}

export async function readCustomizationBody(
  request: Request,
  limit = 72 * 1024 * 1024,
): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")
    throw new Error("json-required");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new Error("body-too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("bad-request");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new Error("body-too-large");
      }
      chunks.push(chunk.value);
    }
    const all = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all)) as unknown;
  } finally {
    reader.releaseLock();
  }
}
