import { buildMatrixForUnit, type Reader } from "@aidlc-guide/reader-core";
import type { ReadResult, WatchEvent, WsMessage } from "@aidlc-guide/shared-types";

/**
 * WS fan-out and the watch→broadcast mapping (P-DS-3 / BR-DS-6).
 *
 * Structurally typed on `send` alone rather than on Bun's `ServerWebSocket`, so
 * the fan-out rules are testable without a socket — and so this module stays
 * transport-shaped rather than Bun-shaped.
 */
export interface PushClient {
  send(data: string): void;
}

export interface Hub {
  add(client: PushClient): void;
  remove(client: PushClient): void;
  size(): number;
  broadcast(message: WsMessage): void;
  handleWatchEvent(event: WatchEvent): Promise<void>;
}

export interface HubDeps {
  reader: Reader;
  recordDir(): Promise<ReadResult<string>>;
  /** How many audit events an `audit` change re-sends. */
  auditLimit?: number;
}

const DEFAULT_AUDIT_LIMIT = 50;
const MATRIX_SCOPE = "matrix:";

export function createHub(deps: HubDeps): Hub {
  const clients = new Set<PushClient>();
  const auditLimit = deps.auditLimit ?? DEFAULT_AUDIT_LIMIT;

  /**
   * Serialise once, then send — not once per client. At mob scale the
   * difference is small, but it keeps the fan-out cost independent of the
   * connection count (P-DS-3/P-DS-4).
   */
  const broadcast = (message: WsMessage): void => {
    const data = JSON.stringify(message);
    for (const client of clients) {
      // A socket that died between the change and the send must not stop the
      // other clients from being told.
      try {
        client.send(data);
      } catch {
        clients.delete(client);
      }
    }
  };

  /** Freshness can no longer be trusted — say so rather than going quiet. */
  const degrade = (reason: string): void =>
    broadcast({ type: "live-status", degraded: true, reason });

  const onState = async (): Promise<void> => {
    const [state, nextStep] = await Promise.all([
      deps.reader.getWorkflow(),
      deps.reader.getNextStep(),
    ]);
    if (!("ok" in state)) return degrade("workflow-unreadable");
    if (!("ok" in nextStep)) return degrade("next-step-unreadable");
    broadcast({
      type: "change",
      scope: "state",
      workflow: state.value,
      nextStep: nextStep.value,
    });
  };

  const onAudit = async (): Promise<void> => {
    const events = await deps.reader.getAuditEvents(auditLimit);
    if (!("ok" in events)) return degrade("audit-unreadable");
    broadcast({ type: "change", scope: "audit", events: events.value });
  };

  /** Only the changed unit is rebuilt — never the whole matrix (BR-DS-5). */
  const onMatrix = async (scope: `matrix:${string}`): Promise<void> => {
    const unit = scope.slice(MATRIX_SCOPE.length);
    const record = await deps.recordDir();
    if (!("ok" in record)) return degrade("no-record");
    // The construction slug set comes from the state file, so a scope change
    // follows automatically instead of being hardcoded here.
    const state = await deps.reader.getWorkflow();
    if (!("ok" in state)) return degrade("workflow-unreadable");
    const stages = state.value.stages.filter((s) => s.phase === "CONSTRUCTION").map((s) => s.slug);
    const cells = await buildMatrixForUnit(record.value, unit, stages);
    if (!("ok" in cells)) return degrade("matrix-unreadable");
    broadcast({ type: "change", scope, cells: cells.value });
  };

  return {
    add: (client) => {
      clients.add(client);
    },
    remove: (client) => {
      clients.delete(client);
    },
    size: () => clients.size,
    broadcast,

    async handleWatchEvent(event) {
      if (event.type === "watch-warning") {
        degrade(event.reason);
        return;
      }
      if (event.scope === "state") return await onState();
      if (event.scope === "audit") return await onAudit();
      if (event.scope.startsWith(MATRIX_SCOPE)) return await onMatrix(event.scope);
    },
  };
}
