import {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDelayedLoading } from "@/hooks/useDelayedLoading.ts";

const LoadingContext = createContext<{
  visible: boolean;
  register: () => () => void;
} | null>(null);

/** Keep one delay across a page's chunk, data and Markdown loading stages. */
export function LoadingSequence({ children }: { children: ReactNode }): ReactNode {
  const [active, setActive] = useState(false);
  const pending = useRef(0);
  const visible = useDelayedLoading(active);
  const register = useCallback(() => {
    pending.current += 1;
    setActive(true);
    return () => {
      pending.current -= 1;
      // React removes the old fallback before mounting its replacement in
      // the same commit. Reset only after both effects have run, so a new
      // loading stage keeps the elapsed time. A completed/error view resets
      // the delay for the next request, including manual refreshes.
      queueMicrotask(() => {
        if (pending.current === 0) setActive(false);
      });
    };
  }, []);
  const value = useMemo(() => ({ visible, register }), [visible, register]);
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useSkeletonVisible(): boolean {
  const sequence = useContext(LoadingContext);
  const localVisible = useDelayedLoading(sequence === null);
  const register = sequence?.register;
  useEffect(() => register?.(), [register]);
  return sequence?.visible ?? localVisible;
}

export function LoadingSuspense({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}): ReactNode {
  return (
    <LoadingSequence>
      <Suspense fallback={fallback}>{children}</Suspense>
    </LoadingSequence>
  );
}
