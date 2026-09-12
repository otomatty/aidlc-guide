import { useCallback, useEffect, useRef, useState } from "react";
import { onNowDisclosureRestore } from "../services/now-disclosure-inject.ts";
import { vsCodeApi } from "../services/vscode-api.ts";

/** Mount once in the dashboard so navigation retains this display preference. */
export function useNowDisclosure(): {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
} {
  const [expanded, setExpandedState] = useState(false);
  const changedByUser = useRef(false);

  useEffect(() => {
    if (vsCodeApi() === null) return;
    return onNowDisclosureRestore((restored) => {
      // A delayed bootstrap must never overwrite a more recent click.
      if (!changedByUser.current) setExpandedState(restored);
    });
  }, []);

  const setExpanded = useCallback((next: boolean) => {
    changedByUser.current = true;
    setExpandedState(next);
    vsCodeApi()?.postMessage({ type: "now-disclosure", expanded: next });
  }, []);

  return { expanded, setExpanded };
}
