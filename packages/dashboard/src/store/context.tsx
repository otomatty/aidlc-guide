import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { type Action, reducer } from "./reducer.ts";
import { type AppState, initialState } from "./state.ts";

/**
 * Single store, area slices (domain-entities.md ライフサイクル). State and
 * dispatch live in separate contexts so a component that only dispatches does
 * not re-render on every state change (P-UI-3).
 */

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({
  children,
  preloaded,
}: {
  children: ReactNode;
  preloaded?: Partial<AppState>;
}): ReactNode {
  const start = useMemo(() => ({ ...initialState, ...preloaded }), [preloaded]);
  const [state, dispatch] = useReducer(reducer, start);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(StateContext);
  if (state === null) throw new Error("useAppState must be used inside <StoreProvider>");
  return state;
}

export function useDispatch(): Dispatch<Action> {
  const dispatch = useContext(DispatchContext);
  if (dispatch === null) throw new Error("useDispatch must be used inside <StoreProvider>");
  return dispatch;
}
