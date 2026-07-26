import type { AgentDoc } from "@aidlc-guide/shared-types";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { ChevronLeftIcon, XIcon } from "lucide-react";
import {
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { formatStageLabel } from "../data/stage-numbers.ts";
import { fetchAgent, fetchAgentKnowledge } from "../services/api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { AreaError, Skeleton } from "./atoms.tsx";

const MarkdownSurface = lazy(async () => {
  const mod = await import("../viewer/MarkdownSurface.tsx");
  return { default: mod.MarkdownSurface };
});

const preventDefault = (event: Event): void => {
  event.preventDefault();
};

export function AgentPanel(): ReactNode {
  const agentOpen = useAppState().agentOpen;
  const dispatch = useDispatch();
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<Element | null>(null);
  const [agent, setAgent] = useState<AgentDoc | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [knowledgeView, setKnowledgeView] = useState<string | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState<string>("");
  const [knowledgeMarkdown, setKnowledgeMarkdown] = useState<string | null>(
    null,
  );
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);

  const open = agentOpen !== null;
  const agentId = agentOpen?.id ?? null;

  const onHome = (): void => {
    dispatch({ type: "home" });
  };

  const onBack = (): void => {
    dispatch({ type: "close-agent" });
  };

  useEffect(() => {
    if (!open) {
      setKnowledgeView(null);
      setAgent(null);
      setAgentError(null);
      return;
    }
    trigger.current = document.activeElement;
    heading.current?.focus();
    return () => {
      const opener = trigger.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || agentId === null) return;
    let live = true;
    setLoadingAgent(true);
    setAgentError(null);
    setAgent(null);
    setKnowledgeView(null);
    void fetchAgent(agentId).then((result) => {
      if (!live) return;
      setLoadingAgent(false);
      if ("ok" in result) {
        setAgent(result.value);
      } else if ("error" in result) {
        setAgentError(result.reason);
      }
    });
    return () => {
      live = false;
    };
  }, [open, agentId]);

  useEffect(() => {
    if (!open || agentId === null || knowledgeView === null) return;
    let live = true;
    setLoadingKnowledge(true);
    setKnowledgeError(null);
    setKnowledgeMarkdown(null);
    void fetchAgentKnowledge(agentId, knowledgeView).then((result) => {
      if (!live) return;
      setLoadingKnowledge(false);
      if ("ok" in result) {
        setKnowledgeTitle(result.value.title);
        setKnowledgeMarkdown(result.value.markdown);
      } else if ("error" in result) {
        setKnowledgeError(result.reason);
      }
    });
    return () => {
      live = false;
    };
  }, [open, agentId, knowledgeView]);

  if (!open || agentId === null) return null;

  const title =
    knowledgeView === null
      ? (agent?.displayName ?? agentId)
      : knowledgeTitle || knowledgeView;

  const openStage = (slug: string): void => {
    dispatch({ type: "select", selection: { kind: "stage", slug } });
  };

  return (
    <FocusScope asChild trapped={false} onUnmountAutoFocus={preventDefault}>
      <DismissableLayer
        asChild
        onEscapeKeyDown={() => {
          onHome();
        }}
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
      >
        <aside
          className="panel"
          aria-labelledby="agent-heading"
          data-testid="agent-panel"
        >
          <div className="panel__bar">
            {agentOpen.returnTo !== null ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-testid="agent-back"
                aria-label="ステージ詳細に戻る"
                title="ステージ詳細に戻る"
                onClick={onBack}
              >
                <ChevronLeftIcon />
              </Button>
            ) : null}
            <h2
              id="agent-heading"
              className="panel__heading"
              ref={heading}
              tabIndex={-1}
            >
              {title}
            </h2>
            <div className="panel__actions">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onHome}
                data-testid="agent-close"
                aria-label="閉じる"
                title="閉じる"
              >
                <XIcon />
              </Button>
            </div>
          </div>

          <div className="panel__body" data-testid="agent-body">
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
                {knowledgeError !== null ? (
                  <AreaError detail={knowledgeError} />
                ) : loadingKnowledge || knowledgeMarkdown === null ? (
                  <Skeleton lines={8} label="ナレッジ本文" />
                ) : (
                  <Suspense
                    fallback={<Skeleton lines={8} label="ナレッジ本文" />}
                  >
                    <MarkdownSurface
                      markdown={knowledgeMarkdown}
                      editable={null}
                    />
                  </Suspense>
                )}
              </>
            ) : agentError !== null ? (
              <AreaError detail={agentError} />
            ) : loadingAgent || agent === null ? (
              <Skeleton lines={8} label="エージェント詳細" />
            ) : (
              <>
                {agent.description === "" ? null : (
                  <p className="text-sm text-muted-foreground">
                    {agent.description}
                  </p>
                )}
                {agent.markdown === "" ? null : (
                  <Suspense
                    fallback={<Skeleton lines={8} label="エージェント本文" />}
                  >
                    <MarkdownSurface
                      markdown={agent.markdown}
                      editable={null}
                    />
                  </Suspense>
                )}
                <div>
                  <CardDescription>担当ステージ</CardDescription>
                  {agent.stages.length === 0 ? (
                    <p>（なし）</p>
                  ) : (
                    <ul className="guides__list">
                      {agent.stages.map((slug) => (
                        <li key={slug}>
                          <button
                            type="button"
                            className="guides__item"
                            data-testid={`agent-stage-${slug}`}
                            onClick={() => {
                              openStage(slug);
                            }}
                          >
                            {formatStageLabel(slug)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <CardDescription>ナレッジ</CardDescription>
                  {agent.knowledge.length === 0 ? (
                    <p>（なし）</p>
                  ) : (
                    <ul className="guides__list">
                      {agent.knowledge.map((item) => (
                        <li key={item.name}>
                          <button
                            type="button"
                            className="guides__item"
                            data-testid={`agent-knowledge-${item.name}`}
                            onClick={() => {
                              setKnowledgeView(item.name);
                            }}
                          >
                            {item.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </DismissableLayer>
    </FocusScope>
  );
}
