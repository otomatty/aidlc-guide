type RestoreHandler = (expanded: boolean) => void;

const handlers = new Set<RestoreHandler>();
// The transport is initialized before React, so `ready` may be answered first.
let pendingRestore: boolean | undefined;

export function onNowDisclosureRestore(handler: RestoreHandler): () => void {
  handlers.add(handler);
  if (pendingRestore !== undefined) {
    const expanded = pendingRestore;
    pendingRestore = undefined;
    handler(expanded);
  }
  return () => {
    handlers.delete(handler);
  };
}

export function deliverNowDisclosureRestore(expanded: boolean): void {
  if (handlers.size === 0) {
    pendingRestore = expanded;
    return;
  }
  pendingRestore = undefined;
  for (const handler of handlers) handler(expanded);
}
