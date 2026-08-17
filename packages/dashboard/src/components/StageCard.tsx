import type { NextStep, StageDoc, StageIoPaths } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canOpenDocsInIde, docsOpenHref, isExternal } from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { NextStepCallout } from "./NextStepCallout.tsx";
import { OpenOfficialDocLink } from "./OpenOfficialDocLink.tsx";

export interface StageCardProps {
  doc: StageDoc;
  isCurrent: boolean;
  nextStep?: NextStep;
  onOpenStage: (slug: string) => void;
  ioPaths?: StageIoPaths | null;
  /** Open a resolved I/O Markdown path in the dashboard preview (issue #32). */
  onPreviewIo?: (path: string) => void;
}

function List({
  label,
  items,
  paths,
  onPreviewIo,
}: {
  label: string;
  items: string[];
  paths: Record<string, string | null> | null;
  onPreviewIo?: (path: string) => void;
}): ReactNode {
  const canOpen = canOpenDocsInIde();
  return (
    <div>
      <CardDescription>{label}</CardDescription>
      {items.length === 0 ? (
        <p>（なし）</p>
      ) : (
        <ul className="list-disc pl-5">
          {items.map((item) => {
            const path = paths?.[item];
            return (
              <li key={item}>
                {typeof path === "string" && canOpen && onPreviewIo !== undefined ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-normal underline"
                    data-testid={`io-open-${item}`}
                    onClick={() => {
                      onPreviewIo(path);
                    }}
                  >
                    {item}
                  </Button>
                ) : (
                  <span className="text-muted-foreground">{item}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DocsLink({ doc }: { doc: StageDoc }): ReactNode {
  const { docsBaseUrl, stageDocs } = useAppState();
  const inIde = canOpenDocsInIde();

  // Bolt 3: VS Code webview uses Official Docs Shell (open-official-doc).
  // Must not call docsOpenHref / openDocInIde / open-doc on this path (FR-B3-5.1).
  if (inIde) {
    return <OpenOfficialDocLink slug={doc.slug} sourceVersion={doc.sourceVersion} />;
  }

  // Browser / Mob: legacy Confluence override or docsBaseUrl href (not Fail for NFR-B3-2).
  const href = docsOpenHref(doc.slug, doc.deepLink, { docsBaseUrl, stageDocs });
  if (href === null) return null;

  return (
    <p>
      <a
        href={href}
        className="text-primary underline-offset-4 hover:underline"
        rel="noopener noreferrer"
        {...(isExternal(href) ? { target: "_blank" } : {})}
      >
        docs を開く
      </a>{" "}
      <span className="text-muted-foreground">（sync: {doc.sourceVersion}）</span>
    </p>
  );
}

function AgentLink({ agentId, label }: { agentId: string; label: string }): ReactNode {
  const dispatch = useDispatch();
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0 font-normal underline"
      data-testid={`agent-link-${agentId}`}
      title={agentId}
      onClick={() => {
        dispatch({ type: "open-agent", id: agentId });
      }}
    >
      {label}
    </Button>
  );
}

export function StageCard({
  doc,
  isCurrent,
  nextStep,
  onOpenStage,
  ioPaths = null,
  onPreviewIo,
}: StageCardProps): ReactNode {
  return (
    <Card className="overflow-visible" data-testid={`stage-card-${doc.slug}`}>
      <CardHeader>
        <CardTitle>目的</CardTitle>
        <CardDescription>{doc.purpose}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <List
          label="入力"
          items={doc.inputs}
          paths={ioPaths?.inputs ?? null}
          onPreviewIo={onPreviewIo}
        />
        <List
          label="出力"
          items={doc.outputs}
          paths={ioPaths?.outputs ?? null}
          onPreviewIo={onPreviewIo}
        />
        <div>
          <CardDescription>担当エージェント</CardDescription>
          <AgentLink agentId={doc.agent} label={doc.agentDisplayName} />
        </div>
        <div>
          <CardDescription>ゲート要求</CardDescription>
          <p>{doc.gateRequirement}</p>
        </div>
        <DocsLink doc={doc} />
        {/* Bolt 4 / FR-B4-1: never mount doc.excerpt as article (UI-only; API may still return it). */}
      </CardContent>
      {isCurrent && nextStep !== undefined ? (
        <CardFooter>
          <NextStepCallout nextStep={nextStep} onOpenNext={onOpenStage} />
        </CardFooter>
      ) : null}
    </Card>
  );
}
