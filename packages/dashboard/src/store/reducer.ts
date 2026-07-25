import type {
  IntentList,
  Matrix,
  MatrixCell,
  ProjectLink,
  ReadResult,
  StageDoc,
  WsMessage,
} from "@aidlc-guide/shared-types";
import { deriveViewState, deriveWorkflow, matrixNotes } from "./deriveViewState.ts";
import type { AppState, Selection, Theme, ViewState, WorkflowPayload } from "./state.ts";

/** `GET /api/matrix` answers `{building:true}` while the background scan runs. */
export type MatrixResponse = ReadResult<Matrix> | { building: true };

export type Action =
  | { type: "workflow"; result: ReadResult<WorkflowPayload> }
  | { type: "matrix"; result: MatrixResponse }
  | { type: "intents"; result: ReadResult<IntentList> }
  | { type: "stage-doc"; slug: string; state: ViewState<StageDoc> }
  | { type: "links"; result: ReadResult<ProjectLink[]> }
  // `receivedAt` is stamped at the socket (services/live.ts). Required, not
  // optional: the reducer reads no clock, so a caller that omitted it would
  // silently stop 「最終更新」 from advancing.
  | { type: "ws"; message: WsMessage; receivedAt: string }
  | { type: "live"; connected: boolean }
  | { type: "select"; selection: Selection }
  | { type: "theme"; theme: Theme }
  | { type: "reloading" };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "workflow": {
      const { workflow, nextStep, hostMode } = deriveWorkflow(action.result);
      // `hostMode` is sticky against read failures. `refetchAll` re-runs on
      // every reconnect, so without this a blip (or `no-active-intent`) would
      // silently downgrade the client out of participant mode (S-MM-5).
      return { ...state, workflow, nextStep, hostMode: hostMode ?? state.hostMode };
    }

    case "matrix":
      return {
        ...state,
        matrix:
          "building" in action.result
            ? { kind: "loading" }
            : deriveViewState(action.result, matrixNotes),
      };

    case "intents":
      return { ...state, intents: deriveViewState(action.result) };

    case "stage-doc":
      return { ...state, stageDoc: { ...state.stageDoc, [action.slug]: action.state } };

    case "links":
      return { ...state, projectLinks: deriveViewState(action.result) };

    case "ws":
      return applyWs(state, action.message, action.receivedAt);

    case "live":
      // Reconnecting clears `degraded` (and its reason): the server
      // re-announces liveness loss on the new socket if it is still degraded
      // (push.ts `degrade`). `lastChangeAt` survives — it is a fact about
      // changes received, not about the current socket.
      return {
        ...state,
        live: action.connected
          ? {
              connected: true,
              degraded: false,
              everConnected: true,
              ...carry(state.live.lastChangeAt),
            }
          : { ...state.live, connected: false },
      };

    case "select":
      return { ...state, selected: action.selection };

    case "theme":
      return { ...state, theme: action.theme };

    case "reloading":
      // Retry after a server outage: back to skeletons for the three startup
      // slices only. `stageDoc` memoisation and the selection survive.
      return {
        ...state,
        workflow: { kind: "loading" },
        nextStep: { kind: "loading" },
        matrix: { kind: "loading" },
      };
  }
}

/** Spread helper: keep an optional field out of the object when it is unset. */
function carry(lastChangeAt: string | undefined): { lastChangeAt?: string } {
  return lastChangeAt === undefined ? {} : { lastChangeAt };
}

function applyWs(state: AppState, message: WsMessage, receivedAt: string): AppState {
  switch (message.type) {
    case "matrix-ready":
      return {
        ...state,
        matrix: deriveViewState({ ok: true, value: message.matrix }, matrixNotes),
      };

    case "live-status":
      // Rebuilt rather than spread: a `degraded:false` message with no reason
      // must not leave the previous reason standing.
      return {
        ...state,
        live: {
          connected: state.live.connected,
          everConnected: state.live.everConnected,
          degraded: message.degraded,
          ...carry(state.live.lastChangeAt),
          ...(message.reason === undefined ? {} : { reason: message.reason }),
        },
      };

    case "change": {
      // Any change push proves the watch pipeline is alive, so the timestamp
      // is stamped once here for every scope — including `audit`, which
      // renders nothing but is still evidence of liveness.
      const live = { ...state.live, lastChangeAt: receivedAt };

      switch (message.scope) {
        case "state": {
          const { workflow, nextStep } = deriveWorkflow({
            ok: true,
            value: {
              workflow: message.workflow,
              nextStep: message.nextStep,
              serverMode: { hostMode: state.hostMode },
            },
          });
          return { ...state, live, workflow, nextStep };
        }

        case "audit":
          // Explicitly ignored, not defaulted: this unit renders no audit view
          // (SC-UI-3 / BLM step 4). A future audit surface adds a case here
          // instead of silently inheriting a fallthrough. Only `live` moves.
          return { ...state, live };

        default:
          return applyMatrixScope({ ...state, live }, message.scope, message.cells);
      }
    }
  }
}

/** `matrix:<unit>` — replace only that unit's row (BR-DS-5 on the wire). */
function applyMatrixScope(state: AppState, scope: string, cells: MatrixCell[]): AppState {
  const current = state.matrix;
  // Nothing to merge into yet; the pending full fetch will carry the change.
  if (current.kind !== "success" && current.kind !== "partial") return state;

  const unit = scope.slice("matrix:".length);
  const merged: Matrix = {
    units: current.value.units,
    stages: current.value.stages,
    cells: [...current.value.cells.filter((cell) => cell.unit !== unit), ...cells],
  };
  return { ...state, matrix: deriveViewState({ ok: true, value: merged }, matrixNotes) };
}
