import type { NextStep, StageDoc, StageIoPaths } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canOpenDocsInIde,
  docsOpenHref,
  isExternal,
  openDocInIde,
  openFileInIde,
} from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { NextStepCallout } from "./NextStepCallout.tsx";

export interface StageCardProps {
  doc: StageDoc;
  isCurrent: boolean;
  nextStep?: NextStep;
  onOpenStage: (slug: string) => void;
  ioPaths?: StageIoPaths | null;
}

function List({
  label,
  items,
  paths,
}: {
  label: string;
  items: string[];
  paths: Record<string, string | null> | null;
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
                {typeof path === "string" && canOpen ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-normal underline"
                    data-testid={`io-open-${item}`}
                    onClick={() => {
                      openFileInIde({ path, line: null }, { beside: true, base: "record" });
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
  const href = docsOpenHref(doc.slug, doc.deepLink, { docsBaseUrl, stageDocs });
  const link = doc.deepLink;

  if (href !== null) {
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

  if (link !== null && canOpenDocsInIde()) {
    return (
      <p>
        <Button
          type="button"
          variant="link"
          data-testid="docs-open-ide"
          onClick={() => {
            openDocInIde(link);
          }}
        >
          docs を開く
        </Button>{" "}
        <span className="text-muted-foreground">（sync: {doc.sourceVersion}）</span>
      </p>
    );
  }

  return null;
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
}: StageCardProps): ReactNode {
  return (
    <Card className="overflow-visible" data-testid={`stage-card-${doc.slug}`}>
      <CardHeader>
        <CardTitle>目的</CardTitle>
        <CardDescription>{doc.purpose}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <List label="入力" items={doc.inputs} paths={ioPaths?.inputs ?? null} />
        <List label="出力" items={doc.outputs} paths={ioPaths?.outputs ?? null} />
        <div>
          <CardDescription>担当エージェント</CardDescription>
          <AgentLink agentId={doc.agent} label={doc.agentDisplayName} />
        </div>
        <div>
          <CardDescription>ゲート要求</CardDescription>
          <p>{doc.gateRequirement}</p>
        </div>
        <DocsLink doc={doc} />
        {doc.excerpt === null ? null : (
          <Accordion data-testid="docs-excerpt">
            <AccordionItem value="excerpt">
              <AccordionTrigger>docs の該当箇所</AccordionTrigger>
              <AccordionContent>
                <pre className="viewer__raw mb-0">{doc.excerpt}</pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
      {isCurrent && nextStep !== undefined ? (
        <CardFooter>
          <NextStepCallout nextStep={nextStep} onOpenNext={onOpenStage} />
        </CardFooter>
      ) : null}
    </Card>
  );
}
