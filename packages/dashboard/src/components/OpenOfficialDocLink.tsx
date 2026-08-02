import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { fetchOfficialDocsStageMap } from "../services/api.ts";
import {
  buildOpenOfficialDocMessage,
  openOfficialDocInIde,
  stageDisplayName,
} from "../services/docs.ts";
import { useAppState } from "../store/context.tsx";

export interface OpenOfficialDocLinkProps {
  /** Stage slug used for GET /api/official-docs/stage/:slug. */
  slug: string;
  /**
   * Display name in accessible/visible label `Docs: <stageDisplayName>`.
   * Defaults to title-cased slug when omitted.
   */
  stageDisplayName?: string;
  /** Sync version label (StageDoc.sourceVersion). */
  sourceVersion?: string;
}

/**
 * StageCard control (Bolt 3): fetch stage map → post `open-official-doc`.
 * Must not call docsOpenHref / openDocInIde / open-doc on this path.
 */
export function OpenOfficialDocLink({
  slug,
  stageDisplayName: displayNameProp,
  sourceVersion,
}: OpenOfficialDocLinkProps): ReactNode {
  const locale = useAppState().officialDocsLocale;
  const label = `Docs: ${displayNameProp ?? stageDisplayName(slug)}`;

  const onActivate = (): void => {
    void fetchOfficialDocsStageMap(slug).then((result) => {
      const ref = "ok" in result && result.ok ? result.value : null;
      const message = buildOpenOfficialDocMessage(locale, ref);
      openOfficialDocInIde(message);
    });
  };

  return (
    <p>
      <Button
        type="button"
        variant="link"
        data-testid="open-official-doc"
        aria-label={label}
        onClick={onActivate}
      >
        {label}
      </Button>
      {sourceVersion === undefined ? null : (
        <>
          {" "}
          <span className="text-muted-foreground">（sync: {sourceVersion}）</span>
        </>
      )}
    </p>
  );
}
