import type {
  IntentList,
  Matrix,
  MatrixCell,
  OfficialDocsLocale,
  ProjectLink,
  ReadResult,
  StageDoc,
  TimingsPayload,
  WsMessage,
} from "@aidlc-guide/shared-types";
import {
  type AppRoute,
  type DocsDeepLink,
  HOME_ROUTE,
  routeSelection,
  selectionRoute,
} from "@/app/routes.ts";
import { deriveViewState, deriveWorkflow, matrixNotes } from "./derive-view-state.ts";
import type { AppState, Selection, Theme, ViewState, WorkflowPayload } from "./state.ts";

/** `GET /api/matrix` answers `{building:true}` while the background scan runs. */
export type MatrixResponse = ReadResult<Matrix> | { building: true };

export type Action =
  | { type: "workflow"; result: ReadResult<WorkflowPayload> }
  | { type: "matrix"; result: MatrixResponse }
  | { type: "timings"; result: ReadResult<TimingsPayload> }
  | { type: "intents"; result: ReadResult<IntentList> }
  | { type: "stage-doc"; slug: string; state: ViewState<StageDoc> }
  | { type: "links"; result: ReadResult<ProjectLink[]> }
  | {
      type: "docs-settings";
      docsBaseUrl: string | null;
      stageDocs: Readonly<Record<string, string>>;
    }
  // `receivedAt` is stamped at the socket (services/live.ts). Required, not
  // optional: the reducer reads no clock, so a caller that omitted it would
  // silently stop 「最終更新」 from advancing.
  | { type: "ws"; message: WsMessage; receivedAt: string }
  | { type: "live"; connected: boolean }
  | { type: "select"; selection: Selection }
  | { type: "guides"; open: boolean }
  | { type: "effectiveness"; open: boolean }
  | { type: "settings"; open: boolean }
  | { type: "customization"; open: boolean }
  | {
      type: "docs-shell";
      open: boolean;
      /** Required when setting a one-shot deep-link (host inject / mapped open). */
      locale?: OfficialDocsLocale;
      path?: string;
      anchor?: string;
      /** An extension guide opened inside the existing docs shell. UI only. */
      guide?: string;
    }
  | { type: "official-docs-locale"; locale: OfficialDocsLocale }
  | { type: "open-agent"; id: string }
  | { type: "close-agent" }
  /** Return to the home route and close every secondary route. */
  | { type: "home" }
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

    case "timings":
      return { ...state, timings: deriveViewState(action.result) };

    case "intents":
      return { ...state, intents: deriveViewState(action.result) };

    case "stage-doc":
      return { ...state, stageDoc: { ...state.stageDoc, [action.slug]: action.state } };

    case "links":
      return { ...state, projectLinks: deriveViewState(action.result) };

    case "docs-settings":
      return {
        ...state,
        docsBaseUrl: action.docsBaseUrl,
        stageDocs: action.stageDocs,
      };

    case "ws":
      return applyWs(state, action.message, action.receivedAt);

    case "live":
      // Reconnecting clears `degraded` (and its reason): the server
      // re-announces liveness loss on the new socket if it is still degraded
      // (push.ts `degrade`). `lastChangeAt` survives — it is a fact about
      // changes received, not about the current socket.
      return {
        ...state,
        customizationRefresh: state.customizationRefresh + (action.connected ? 1 : 0),
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
      // One in-webview route at a time: opening a stage parks sibling routes.
      return action.selection === null
        ? leaveRecordRoute(state)
        : go(state, selectionRoute(action.selection));

    case "guides":
      return action.open ? go(state, { name: "guides" }) : leaveNamed(state, "guides");

    case "docs-shell": {
      const [docs, extra] = docsRoute(action);
      return action.open ? go(state, docs, extra) : leaveNamed(state, "docs");
    }

    case "official-docs-locale":
      return { ...state, officialDocsLocale: action.locale };

    case "effectiveness":
      return action.open
        ? go(state, { name: "effectiveness" })
        : leaveNamed(state, "effectiveness");

    case "settings":
      return action.open ? go(state, { name: "settings" }) : leaveNamed(state, "settings");

    case "customization":
      return action.open
        ? go(state, { name: "customization" })
        : leaveNamed(state, "customization");

    case "open-agent":
      return go(state, {
        name: "agent",
        id: action.id,
        returnTo: routeSelection(state.route),
      });

    case "close-agent":
      return state.route.name === "agent" ? go(state, fromReturnTo(state.route.returnTo)) : state;

    case "home":
      return go(state, HOME_ROUTE);

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

    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Spread helper: keep an optional field out of the object when it is unset. */
function carry(lastChangeAt: string | undefined): { lastChangeAt?: string } {
  return lastChangeAt === undefined ? {} : { lastChangeAt };
}

function go(
  state: AppState,
  route: AppRoute,
  extra?: Partial<Pick<AppState, "officialDocsLocale">>,
): AppState {
  return extra === undefined ? { ...state, route } : { ...state, route, ...extra };
}

function leaveNamed(state: AppState, name: AppRoute["name"]): AppState {
  return state.route.name === name ? go(state, HOME_ROUTE) : state;
}

function isRecordRoute(route: AppRoute): boolean {
  return route.name === "stage" || route.name === "cell" || route.name === "agent";
}

function leaveRecordRoute(state: AppState): AppState {
  return isRecordRoute(state.route) ? go(state, HOME_ROUTE) : state;
}

function fromReturnTo(returnTo: Selection): AppRoute {
  return returnTo === null ? HOME_ROUTE : selectionRoute(returnTo);
}

function docsRoute(
  action: Extract<Action, { type: "docs-shell" }>,
): [AppRoute, Partial<Pick<AppState, "officialDocsLocale">>?] {
  // Deep-link when `locale` is present (host inject). Locale-only = Shell top.
  // A follow-up `{ open: true }` without locale consumes the one-shot target.
  if (action.locale === undefined) return [{ name: "docs" }];
  const deepLink: DocsDeepLink = {
    locale: action.locale,
    ...(action.path !== undefined && action.path !== "" ? { path: action.path } : {}),
    ...(action.guide !== undefined && action.guide !== "" ? { guide: action.guide } : {}),
    ...(action.anchor !== undefined && action.anchor !== "" ? { anchor: action.anchor } : {}),
  };
  return [{ name: "docs", deepLink }, { officialDocsLocale: action.locale }];
}

function applyWs(state: AppState, message: WsMessage, receivedAt: string): AppState {
  switch (message.type) {
    case "customization-changed":
      return { ...state, customizationRefresh: state.customizationRefresh + 1 };
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
            ...(message.warnings === undefined ? {} : { warnings: message.warnings }),
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

    case "intent-selected":
      // Close record-scoped UI and bump lastChangeAt so App's guarded
      // timings poll runs. Payload-free: REST refetch is live.ts / picker.
      return {
        ...state,
        route: isRecordRoute(state.route) ? HOME_ROUTE : state.route,
        stageDoc: {},
        timings: { kind: "loading" },
        live: { ...state.live, lastChangeAt: receivedAt },
      };

    default: {
      const _exhaustive: never = message;
      return _exhaustive;
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
