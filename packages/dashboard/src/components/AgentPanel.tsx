import { ChevronLeftIcon } from "lucide-react";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { formatStageLabel } from "../data/stage-numbers.ts";
import { useFetchView } from "../hooks/useFetchView.ts";
import { fetchAgent, fetchAgentKnowledge } from "../services/api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { MarkdownSurface } from "../viewer/lazy-markdown.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { NavList, NavListButton } from "./NavList.tsx";
import { PanelBody, PanelShell } from "./PanelShell.tsx";

export function AgentPanel(): ReactNode {
  const agentOpen = useAppState().agentOpen;
  const dispatch = useDispatch();
  const [knowledgeView, setKnowledgeView] = useState<string | null>(null);

  const open = agentOpen !== null;
  const agentId = agentOpen?.id ?? null;

  // A new agent (or close/reopen) starts back at the persona, not a stale knowledge file.
  // biome-ignore lint/correctness/useExhaustiveDependencies: open/agentId are reset triggers, not read in the body
  useEffect(() => {
    setKnowledgeView(null);
  }, [open, agentId]);

  const agentView = useFetchView(open && agentId !== null ? () => fetchAgent(agentId) : null, [
    open,
    agentId,
  ]);
  const knowledgeDoc = useFetchView(
    open && agentId !== null && knowledgeView !== null
      ? () => fetchAgentKnowledge(agentId, knowledgeView)
      : null,
    [open, agentId, knowledgeView],
  );

  if (!open || agentId === null) return null;

  const agent = agentView === null ? null : viewValue(agentView);
  const knowledge = knowledgeDoc === null ? null : viewValue(knowledgeDoc);

  const onHome = (): void => {
    dispatch({ type: "home" });
  };
  const openStage = (slug: string): void => {
    dispatch({ type: "select", selection: { kind: "stage", slug } });
  };

  const title =
    knowledgeView === null ? (agent?.displayName ?? agentId) : (knowledge?.title ?? knowledgeView);

  return (
    <PanelShell
      headingId="agent-heading"
      testId="agent-panel"
      title={title}
      closeTestId="agent-close"
      onClose={onHome}
      leading={
        agentOpen.returnTo !== null ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            data-testid="agent-back"
            aria-label="ステージ詳細に戻る"
            title="ステージ詳細に戻る"
            onClick={() => {
              dispatch({ type: "close-agent" });
            }}
          >
            <ChevronLeftIcon />
          </Button>
        ) : null
      }
    >
      <PanelBody data-testid="agent-body">
        {knowledgeView !== null ? (
          <>
            <Button
              type="button"
              variant="link"
              className="h-auto self-start p-0"
              data-testid="agent-knowledge-back"
              onClick={() => {
                setKnowledgeView(null);
              }}
            >
              エージェントに戻る
            </Button>
            {knowledgeDoc?.kind === "error" ? (
              <AreaError detail={knowledgeDoc.detail} />
            ) : knowledge === null ? (
              <Skeleton lines={8} label="ナレッジ本文" />
            ) : (
              <Suspense fallback={<Skeleton lines={8} label="ナレッジ本文" />}>
                <MarkdownSurface markdown={knowledge.markdown} editable={null} />
              </Suspense>
            )}
          </>
        ) : agentView?.kind === "error" ? (
          <AreaError detail={agentView.detail} />
        ) : agent === null ? (
          <Skeleton lines={8} label="エージェント詳細" />
        ) : (
          <>
            {agent.description === "" ? null : (
              <p className="text-sm text-muted-foreground">{agent.description}</p>
            )}
            {agent.markdown === "" ? null : (
              <Suspense fallback={<Skeleton lines={8} label="エージェント本文" />}>
                <MarkdownSurface markdown={agent.markdown} editable={null} />
              </Suspense>
            )}
            <div>
              <CardDescription>担当ステージ</CardDescription>
              {agent.stages.length === 0 ? (
                <p>（なし）</p>
              ) : (
                <NavList>
                  {agent.stages.map((slug) => (
                    <li key={slug}>
                      <NavListButton
                        data-testid={`agent-stage-${slug}`}
                        onClick={() => {
                          openStage(slug);
                        }}
                      >
                        {formatStageLabel(slug)}
                      </NavListButton>
                    </li>
                  ))}
                </NavList>
              )}
            </div>
            <div>
              <CardDescription>ナレッジ</CardDescription>
              {agent.knowledge.length === 0 ? (
                <p>（なし）</p>
              ) : (
                <NavList>
                  {agent.knowledge.map((item) => (
                    <li key={item.name}>
                      <NavListButton
                        data-testid={`agent-knowledge-${item.name}`}
                        onClick={() => {
                          setKnowledgeView(item.name);
                        }}
                      >
                        {item.title}
                      </NavListButton>
                    </li>
                  ))}
                </NavList>
              )}
            </div>
          </>
        )}
      </PanelBody>
    </PanelShell>
  );
}
