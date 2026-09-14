import { type RefObject, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Mounted after the lazy renderer commits; never falls back to fuzzy text matching. */
export function EvidenceApplier({
  articleRef,
  contentKey,
}: {
  articleRef: RefObject<HTMLElement | null>;
  contentKey: string;
}) {
  const [missing, setMissing] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a repeated citation click must scroll again
  useEffect(() => {
    const target = articleRef.current?.querySelector<HTMLElement>('[data-doc-evidence="true"]');
    setMissing(!target);
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.focus({ preventScroll: true });
    }
  }, [articleRef, contentKey]);
  return missing ? (
    <Alert>
      <AlertDescription>
        この箇所はハイライト表示に対応していません。上の引用文と文書本文を照らし合わせてください。
      </AlertDescription>
    </Alert>
  ) : null;
}
